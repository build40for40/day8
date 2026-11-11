import {
  LIST_PAGE_PATH,
  OFFER_NAME_MAX_CHARS,
  OFFER_TEMPLATE_LANGUAGE,
  OFFER_TEMPLATE_NAME,
  OFFERS_PER_LIST_PER_DAY,
  OFFERS_PER_VISITOR_PER_HOUR,
  WHATSAPP_WINDOW_MS,
} from "./config";
import * as db from "./db";
import { hasAmount, privateDetail } from "./guard";
import type { Env, ListRow } from "./types";
import { d1Counters, visitorHash, type Counters } from "./web-chat";
import { sendTemplate, whatsAppChannel } from "./whatsapp";

const HOUR_MS = 3_600_000;
const NAME = /^\p{L}[\p{L}'’-]*(?: \p{L}[\p{L}'’-]*)?$/u;

export type OfferNotice = "offered" | "name" | "taken" | "gone" | "busy";

export function cleanHelperName(raw: string): string | null {
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (name.length === 0 || name.length > OFFER_NAME_MAX_CHARS) return null;
  if (!NAME.test(name) || hasAmount(name) || privateDetail(name)) return null;
  return name;
}

export function offerMessage(helper: string, number: number, itemText: string): { text: string; params: string[] } {
  const item = itemText.replace(/\s+/g, " ").trim();
  return {
    text: `A friend has offered to help. ${helper} says they can do number ${number} on your Handup list: ${item}. Is that right? Reply yes and I'll tick it off, or no and I'll leave it open.`,
    params: [helper, String(number), item],
  };
}

export interface Notifier {
  text(to: string, text: string): Promise<void>;
  template(to: string, params: string[]): Promise<void>;
}

export function whatsAppNotifier(env: Env): Notifier {
  return {
    text: (to, text) => whatsAppChannel(env).send(to, text),
    template: (to, params) =>
      sendTemplate(env, to, { name: OFFER_TEMPLATE_NAME, language: OFFER_TEMPLATE_LANGUAGE, params }),
  };
}

/** Tells the person about an offer: plain text inside WhatsApp's 24-hour window, the approved template outside it. */
export async function notifyOffer(
  env: Env,
  notifier: Notifier,
  offer: { list: ListRow; offerId: number; helper: string; number: number; itemText: string },
  now = Date.now(),
): Promise<void> {
  const user = await db.getUserById(env.DB, offer.list.user_id);
  if (!user) return;
  const message = offerMessage(offer.helper, offer.number, offer.itemText);
  const lastInbound = await db.lastInboundAt(env.DB, user.id);
  const inWindow = lastInbound !== null && now - Date.parse(lastInbound) < WHATSAPP_WINDOW_MS;
  if (inWindow) await notifier.text(user.phone, message.text);
  else await notifier.template(user.phone, message.params);
  await db.insertOutbound(env.DB, user.id, message.text);
  await db.markOfferNotified(env.DB, offer.offerId);
}

function isSameSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && URL.canParse(origin) && new URL(origin).host === new URL(request.url).host;
}

function back(request: Request, slug: string, notice: OfferNotice, number?: number): Response {
  const url = new URL(`${LIST_PAGE_PATH}${slug}`, request.url);
  url.searchParams.set("r", notice);
  if (number) url.hash = `i${number}`;
  return new Response(null, { status: 303, headers: { location: `${url.pathname}${url.search}${url.hash}`, "cache-control": "no-store" } });
}

export async function handleOffer(
  request: Request,
  env: Env,
  list: ListRow,
  deps: { counters?: Counters; notifier?: Notifier; defer?: (work: Promise<unknown>) => void } = {},
): Promise<Response> {
  if (!isSameSite(request)) return new Response("Not allowed from this page", { status: 403 });
  const form = await request.formData().catch(() => null);
  const number = Number(form?.get("number"));
  const helper = cleanHelperName(String(form?.get("name") ?? ""));
  if (!Number.isInteger(number) || number < 1) return back(request, list.slug, "gone");
  if (!helper) return back(request, list.slug, "name", number);

  const now = Date.now();
  const counters = deps.counters ?? d1Counters(env.DB);
  const hour = Math.floor(now / HOUR_MS);
  const day = Math.floor(now / (24 * HOUR_MS));
  const byVisitor = await counters.add(`offer:ip:${await visitorHash(request)}:${hour}`, 1, (hour + 1) * HOUR_MS);
  const byList = await counters.add(`offer:list:${list.id}:${day}`, 1, (day + 1) * 24 * HOUR_MS);
  if (byVisitor > OFFERS_PER_VISITOR_PER_HOUR || byList > OFFERS_PER_LIST_PER_DAY) return back(request, list.slug, "busy");

  const result = await db.addOffer(env.DB, list.id, number, helper);
  if (!result.ok) return back(request, list.slug, result.reason, number);

  const notify = notifyOffer(env, deps.notifier ?? whatsAppNotifier(env), {
    list,
    offerId: result.offerId,
    helper,
    number,
    itemText: result.text,
  }).catch((error) => console.error("offer notification failed", error instanceof Error ? error.message : error));
  if (deps.defer) deps.defer(notify);
  else await notify;
  return back(request, list.slug, "offered", number);
}
