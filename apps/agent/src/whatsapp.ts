import type { Channel, InboundMessage } from "./channel";
import { WHATSAPP_GRAPH_VERSION } from "./config";
import type { Env } from "./types";

export function verifyChallenge(url: URL, verifyToken: string | undefined): Response {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function signBody(body: string, appSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}

export async function isSignatureValid(
  body: string,
  header: string | null,
  appSecret: string | undefined,
): Promise<boolean> {
  if (!header || !appSecret) return false;
  const expected = await signBody(body, appSecret);
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

interface WhatsAppPayload {
  entry?: {
    changes?: {
      value?: {
        messages?: { id: string; from: string; timestamp: string; type: string; text?: { body: string } }[];
      };
    }[];
  }[];
}

export function parseInbound(payload: WhatsAppPayload): InboundMessage[] {
  const seen = new Set<string>();
  const inbound: InboundMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (seen.has(message.id)) continue;
        seen.add(message.id);
        const isText = message.type === "text" && typeof message.text?.body === "string";
        inbound.push({
          channelMessageId: message.id,
          from: message.from,
          kind: isText ? "text" : "other",
          text: isText ? message.text!.body : `[sent something that is not text (${message.type}), which Handup cannot read]`,
          sentAt: new Date(Number(message.timestamp) * 1000).toISOString(),
        });
      }
    }
  }
  return inbound;
}

async function post(env: Env, to: string, message: Record<string, unknown>): Promise<void> {
  const response = await fetch(
    `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", to, ...message }),
    },
  );
  if (!response.ok) throw new Error(`WhatsApp send failed with ${response.status}`);
}

const canSend = (env: Env) => Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);

export function whatsAppChannel(env: Env): Channel {
  return {
    async send(to, text) {
      if (!canSend(env)) {
        console.log(`[dry run] to …${to.slice(-4)}:\n${text}`);
        return;
      }
      await post(env, to, { type: "text", text: { body: text, preview_url: false } });
    },
  };
}

export async function sendTemplate(
  env: Env,
  to: string,
  template: { name: string; language: string; params: string[] },
): Promise<void> {
  if (!canSend(env)) {
    console.log(`[dry run] template ${template.name} to …${to.slice(-4)}: ${template.params.join(" | ")}`);
    return;
  }
  await post(env, to, {
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      components: [{ type: "body", parameters: template.params.map((text) => ({ type: "text", text })) }],
    },
  });
}
