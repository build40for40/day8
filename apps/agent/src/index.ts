import { TWILIO_MAX_WEBHOOK_CHARS, WEB_CHAT_PATH, WEBHOOK_PATH } from "./config";
import { emptyTwiml, isSignatureValid, parseInbound, signedUrlCandidates } from "./twilio";
import type { Env } from "./types";
import type { UserTurn } from "./user-turn";
import { handleWebChat } from "./web-chat";

export { UserTurn } from "./user-turn";

async function receiveWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  if (body.length > TWILIO_MAX_WEBHOOK_CHARS) return new Response("Too long", { status: 413 });
  const params = new URLSearchParams(body);
  const header = request.headers.get("x-twilio-signature");
  let signed = false;
  for (const url of signedUrlCandidates(request.url, env.PUBLIC_BASE_URL)) {
    if (await isSignatureValid(url, [...params], header, env.TWILIO_AUTH_TOKEN)) signed = true;
  }
  if (!signed) return new Response("Bad signature", { status: 401 });

  const message = parseInbound(params, { accountSid: env.TWILIO_ACCOUNT_SID, from: env.TWILIO_WHATSAPP_FROM });
  if (message) {
    const stub = env.USER_TURN.get(env.USER_TURN.idFromName(message.from)) as DurableObjectStub<UserTurn>;
    await stub.enqueue(message);
  }
  return emptyTwiml();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === WEBHOOK_PATH) {
      if (request.method === "POST") return receiveWebhook(request, env);
      return new Response("Method not allowed", { status: 405 });
    }
    if (url.pathname === WEB_CHAT_PATH) return handleWebChat(request, env);
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
