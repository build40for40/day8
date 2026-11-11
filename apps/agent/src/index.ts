import { LIST_PAGE_PATH, WEB_CHAT_PATH, WEBHOOK_PATH } from "./config";
import { handleListPage } from "./list-page";
import type { Env } from "./types";
import type { UserTurn } from "./user-turn";
import { handleWebChat } from "./web-chat";
import { isSignatureValid, parseInbound, verifyChallenge } from "./whatsapp";

export { UserTurn } from "./user-turn";

async function receiveWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  if (!(await isSignatureValid(body, request.headers.get("x-hub-signature-256"), env.WHATSAPP_APP_SECRET))) {
    return new Response("Bad signature", { status: 401 });
  }
  const messages = parseInbound(JSON.parse(body));
  await Promise.all(
    messages.map((message) => {
      const stub = env.USER_TURN.get(env.USER_TURN.idFromName(message.from)) as DurableObjectStub<UserTurn>;
      return stub.enqueue(message);
    }),
  );
  return new Response("ok");
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === WEBHOOK_PATH) {
      if (request.method === "GET") return verifyChallenge(url, env.WHATSAPP_VERIFY_TOKEN);
      if (request.method === "POST") return receiveWebhook(request, env);
      return new Response("Method not allowed", { status: 405 });
    }
    if (url.pathname === WEB_CHAT_PATH) return handleWebChat(request, env);
    if (url.pathname.startsWith(LIST_PAGE_PATH)) return handleListPage(request, env, (work) => ctx.waitUntil(work));
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
