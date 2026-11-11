import { generateText, type LanguageModel } from "ai";
import { model, providerOptions, STARTER_ITEMS, SYSTEM_PROMPT } from "./agent";
import {
  PASTE_MARKER,
  WEB_CHAT_ALLOWED_ORIGINS,
  WEB_CHAT_DAILY_CAP_USD,
  WEB_CHAT_INPUT_MICRO_USD_PER_TOKEN,
  WEB_CHAT_MAX_ASSISTANT_CHARS,
  WEB_CHAT_MAX_BODY_CHARS,
  WEB_CHAT_MAX_OUTPUT_TOKENS,
  WEB_CHAT_MAX_TURNS,
  WEB_CHAT_MAX_USER_CHARS,
  WEB_CHAT_MESSAGES_PER_HOUR,
  WEB_CHAT_OUTPUT_MICRO_USD_PER_TOKEN,
  WEB_CHAT_TIMEOUT_MS,
} from "./config";
import { buildInstructions, whatYouKnow, type ChatTurn } from "./context";
import { ukDayKey } from "./time";
import type { Env, Item } from "./types";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export const BACK_TOMORROW_REPLY =
  "That's me done for today: this demo has had all the chat it can take. Come back tomorrow and we'll pick it up.";

export const WEB_CHAT_RULES = `# How this chat is wired

- This is the demo chat on the Handup web page. You have no tools here and nothing is saved.
- The list under "What you know" is the starter list. Changes made in this chat are the truth, so keep track of the list from the conversation itself.
- Whenever your reply includes a message for the person to copy and paste, put a line containing only ${PASTE_MARKER} before that message, and put nothing after the message.
- If they want everything deleted, tell them nothing is kept: closing the page clears the chat.`;

export interface Counters {
  add(key: string, amount: number, expiresAt: number): Promise<number>;
  get(key: string): Promise<number>;
  purge(now: number): Promise<void>;
}

export function d1Counters(db: D1Database): Counters {
  return {
    async add(key, amount, expiresAt) {
      const row = await db
        .prepare(
          "INSERT INTO web_chat_counters (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = value + excluded.value RETURNING value",
        )
        .bind(key, amount, expiresAt)
        .first<{ value: number }>();
      return row?.value ?? amount;
    },
    async get(key) {
      const row = await db
        .prepare("SELECT value FROM web_chat_counters WHERE key = ?")
        .bind(key)
        .first<{ value: number }>();
      return row?.value ?? 0;
    },
    async purge(now) {
      await db.prepare("DELETE FROM web_chat_counters WHERE expires_at < ?").bind(now).run();
    },
  };
}

export function parseTurns(body: unknown): ChatTurn[] | string {
  const turns = (body as { turns?: unknown } | null)?.turns;
  if (!Array.isArray(turns) || turns.length === 0) return "turns must be a list with at least one message";
  if (turns.length > WEB_CHAT_MAX_TURNS) return `No more than ${WEB_CHAT_MAX_TURNS} turns`;
  const parsed: ChatTurn[] = [];
  for (const turn of turns) {
    const { role, content } = (turn ?? {}) as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return "Each turn needs a role of user or assistant";
    if (typeof content !== "string" || content.trim() === "") return "Each turn needs some text";
    const limit = role === "user" ? WEB_CHAT_MAX_USER_CHARS : WEB_CHAT_MAX_ASSISTANT_CHARS;
    if (content.length > limit) return `No more than ${limit} characters in one ${role} message`;
    parsed.push({ role, content });
  }
  if (parsed[parsed.length - 1].role !== "user") return "The last turn must be from the user";
  while (parsed[0].role === "assistant") parsed.shift();
  return parsed;
}

export function webChatInstructions(now: string): string {
  const items: Item[] = STARTER_ITEMS.map((text, i) => ({
    id: i + 1,
    number: i + 1,
    text,
    why: null,
    status: "open",
    claims: [],
  }));
  return buildInstructions(
    SYSTEM_PROMPT,
    whatYouKnow({ now, listStartedAt: now, profile: null, notes: "", items }),
    WEB_CHAT_RULES,
  );
}

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (WEB_CHAT_ALLOWED_ORIGINS.includes(origin)) return origin;
  return env.WEB_CHAT_DEV_ORIGIN && origin === env.WEB_CHAT_DEV_ORIGIN ? origin : null;
}

export async function visitorHash(request: Request): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return [...new Uint8Array(digest).slice(0, 16)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function visitorKey(request: Request, now: number): Promise<string> {
  return `ip:${await visitorHash(request)}:${Math.floor(now / HOUR_MS)}`;
}

export async function handleWebChat(
  request: Request,
  env: Env,
  deps: { model?: LanguageModel; counters?: Counters } = {},
): Promise<Response> {
  const origin = allowedOrigin(request, env);
  if (!origin) return Response.json({ error: "Not allowed from this page" }, { status: 403 });

  const cors = { "access-control-allow-origin": origin, vary: "Origin" };
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    Response.json(body, { status, headers: { ...cors, ...headers } });

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
      },
    });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const raw = await request.text();
  if (raw.length > WEB_CHAT_MAX_BODY_CHARS) return json({ error: "Too long" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }
  const turns = parseTurns(body);
  if (typeof turns === "string") return json({ error: turns }, 400);

  const now = Date.now();
  const counters = deps.counters ?? d1Counters(env.DB);

  const hourEnds = (Math.floor(now / HOUR_MS) + 1) * HOUR_MS;
  const sentThisHour = await counters.add(await visitorKey(request, now), 1, hourEnds);
  if (sentThisHour > WEB_CHAT_MESSAGES_PER_HOUR) {
    return json({ error: "Too many messages, try again in a bit" }, 429, {
      "retry-after": String(Math.ceil((hourEnds - now) / 1000)),
    });
  }

  const spendKey = `spend:${ukDayKey(new Date(now).toISOString())}`;
  if ((await counters.get(spendKey)) >= WEB_CHAT_DAILY_CAP_USD * 1_000_000) {
    return json({ text: BACK_TOMORROW_REPLY });
  }

  try {
    const result = await generateText({
      model: deps.model ?? model(env),
      instructions: webChatInstructions(new Date(now).toISOString()),
      messages: turns,
      maxOutputTokens: WEB_CHAT_MAX_OUTPUT_TOKENS,
      abortSignal: AbortSignal.timeout(WEB_CHAT_TIMEOUT_MS),
      providerOptions,
    });
    const spent =
      (result.usage.inputTokens ?? 0) * WEB_CHAT_INPUT_MICRO_USD_PER_TOKEN +
      (result.usage.outputTokens ?? 0) * WEB_CHAT_OUTPUT_MICRO_USD_PER_TOKEN;
    await counters.add(spendKey, spent, now + 2 * DAY_MS);
    await counters.purge(now);
    if (!result.text.trim()) throw new Error(`Empty reply (${result.finishReason})`);
    return json({ text: result.text });
  } catch (error) {
    console.error("web chat failed", error);
    return json({ error: "Handup couldn't answer just now" }, 502);
  }
}
