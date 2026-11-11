import type { Channel, InboundMessage } from "./channel";
import { TWILIO_MAX_CHARS, TWILIO_SEND_GAP_MS } from "./config";
import type { Env } from "./types";

export async function signTwilio(url: string, params: [string, string][], authToken: string): Promise<string> {
  const sorted = [...params].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const data = url + sorted.map(([name, value]) => name + value).join("");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  return btoa(String.fromCharCode(...bytes));
}

export async function isSignatureValid(
  url: string,
  params: [string, string][],
  header: string | null,
  authToken: string | undefined,
): Promise<boolean> {
  if (!header || !authToken) return false;
  const expected = await signTwilio(url, params, authToken);
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

// Twilio signs the address it called. Behind a tunnel the Worker sees another host, so PUBLIC_BASE_URL gives a second candidate.
export function signedUrlCandidates(requestUrl: string, publicBaseUrl: string | undefined): string[] {
  const candidates = [requestUrl];
  const base = publicBaseUrl?.trim().replace(/\/+$/, "");
  if (base) {
    const { pathname, search } = new URL(requestUrl);
    const viaBase = `${base}${pathname}${search}`;
    if (viaBase !== requestUrl) candidates.push(viaBase);
  }
  return candidates;
}

export function parseInbound(
  params: URLSearchParams,
  ours: { accountSid?: string; from?: string },
  now = new Date(),
): InboundMessage | null {
  const id = params.get("MessageSid") ?? "";
  if (!/^[A-Z]{2}[0-9a-f]{32}$/i.test(id)) return null;
  if (ours.accountSid && params.get("AccountSid") !== ours.accountSid) return null;
  if (ours.from && params.get("To") !== ours.from) return null;
  const from = params.get("From")?.match(/^whatsapp:\+(\d{5,20})$/)?.[1];
  if (!from) return null;

  const base = { channelMessageId: id, from, sentAt: now.toISOString() };
  const body = params.get("Body") ?? "";
  if (Number(params.get("NumMedia") ?? "0") > 0 || params.has("Latitude") || !body.trim()) {
    return { ...base, kind: "other", text: "[sent something that is not text, which Handup cannot read]" };
  }
  return { ...base, kind: "text", text: body };
}

export function emptyTwiml(): Response {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

export function splitForTwilio(text: string, max = TWILIO_MAX_CHARS): string[] {
  const pieces: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max + 1);
    let cut = window.lastIndexOf("\n\n");
    if (cut <= 0) cut = window.lastIndexOf("\n");
    if (cut <= 0) cut = window.lastIndexOf(" ");
    if (cut <= 0) cut = max;
    pieces.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

export function twilioChannel(env: Env, gapMs = TWILIO_SEND_GAP_MS): Channel {
  let lastSentAt = 0;
  return {
    async send(to, text) {
      const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_WHATSAPP_FROM: sender } = env;
      if (!sid || !token || !sender) {
        console.log(`[dry run] to …${to.slice(-4)}:\n${text}`);
        return;
      }
      for (const body of splitForTwilio(text)) {
        const wait = lastSentAt + gapMs - Date.now();
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: {
            authorization: `Basic ${btoa(`${sid}:${token}`)}`,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ From: sender, To: `whatsapp:+${to}`, Body: body }).toString(),
        });
        lastSentAt = Date.now();
        if (!response.ok) {
          const failure = (await response.json().catch(() => null)) as { code?: unknown } | null;
          throw new Error(`Twilio send failed with ${response.status}, code ${failure?.code ?? "unknown"}`);
        }
        await response.body?.cancel();
      }
    },
  };
}
