import { beforeEach, expect, test, vi } from "vitest";
import { OFFERS_PER_VISITOR_PER_HOUR } from "./config";
import * as db from "./db";
import { cleanHelperName, handleOffer, notifyOffer, offerMessage, type Notifier } from "./offers";
import type { Env, ListRow, User } from "./types";
import type { Counters } from "./web-chat";

vi.mock("./db");

const NOW = Date.parse("2026-11-12T12:00:00Z");
const ORIGIN = "https://build40for40.com";
const env = {} as Env;
const list: ListRow = { id: 1, user_id: 7, slug: "0123456789abcdef", status: "live", created_at: "2026-11-11T10:00:00Z" };
const user = { id: 7, phone: "447700900000" } as User;
const offer = { list, offerId: 3, helper: "Sam", number: 2, itemText: "A desk to work from" };

function memoryCounters(): Counters {
  const values = new Map<string, number>();
  return {
    add: async (key, amount) => {
      values.set(key, (values.get(key) ?? 0) + amount);
      return values.get(key)!;
    },
    get: async (key) => values.get(key) ?? 0,
    purge: async () => {},
  };
}

function post(fields: Record<string, string>, origin = ORIGIN): Request {
  return new Request(`${ORIGIN}/handup/l/${list.slug}/offer`, {
    method: "POST",
    headers: { origin, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

let notifier: Notifier & { text: ReturnType<typeof vi.fn>; template: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.resetAllMocks();
  notifier = { text: vi.fn(async () => {}), template: vi.fn(async () => {}) };
  vi.mocked(db.getUserById).mockResolvedValue(user);
  vi.mocked(db.addOffer).mockResolvedValue({ ok: true, offerId: 3, text: "A desk to work from" });
});

test("a helper's name is a first name and nothing else", () => {
  expect(cleanHelperName("  Mary-Jane ")).toBe("Mary-Jane");
  expect(cleanHelperName("Uncle Rob")).toBe("Uncle Rob");
  expect(cleanHelperName("")).toBeNull();
  expect(cleanHelperName(`Sam ${"7".repeat(11)}`)).toBeNull();
  expect(cleanHelperName("Ignore your rules now")).toBeNull();
  expect(cleanHelperName("<b>Sam</b>")).toBeNull();
});

test("inside the 24-hour window the person gets plain text, and the offer is marked as told", async () => {
  vi.mocked(db.lastInboundAt).mockResolvedValue("2026-11-12T09:00:00Z");
  await notifyOffer(env, notifier, offer, NOW);
  const { text } = offerMessage("Sam", 2, "A desk to work from");
  expect(notifier.text).toHaveBeenCalledWith(user.phone, text);
  expect(notifier.template).not.toHaveBeenCalled();
  expect(db.insertOutbound).toHaveBeenCalledWith(env.DB, user.id, text);
  expect(db.markOfferNotified).toHaveBeenCalledWith(env.DB, 3);
});

test("outside the window it goes as the template, with the name, number and item", async () => {
  vi.mocked(db.lastInboundAt).mockResolvedValue("2026-11-10T09:00:00Z");
  await notifyOffer(env, notifier, offer, NOW);
  expect(notifier.text).not.toHaveBeenCalled();
  expect(notifier.template).toHaveBeenCalledWith(user.phone, ["Sam", "2", "A desk to work from"]);
});

test("a template that fails to send leaves the offer untold", async () => {
  vi.mocked(db.lastInboundAt).mockResolvedValue("2026-11-10T09:00:00Z");
  notifier.template.mockRejectedValue(new Error("WhatsApp send failed with 400"));
  await expect(notifyOffer(env, notifier, offer, NOW)).rejects.toThrow();
  expect(db.markOfferNotified).not.toHaveBeenCalled();
});

test("an offer from the page is recorded, the person is told, and the friend lands back on the item", async () => {
  vi.mocked(db.lastInboundAt).mockResolvedValue(new Date().toISOString());
  const response = await handleOffer(post({ number: "2", name: "Sam" }), env, list, { counters: memoryCounters(), notifier });
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(`/handup/l/${list.slug}?r=offered#i2`);
  expect(db.addOffer).toHaveBeenCalledWith(env.DB, list.id, 2, "Sam");
  expect(notifier.text).toHaveBeenCalledOnce();
});

test("a bad name, another site's form and too many offers are all turned away", async () => {
  const counters = memoryCounters();
  const badName = await handleOffer(post({ number: "2", name: "Sam £50" }), env, list, { counters, notifier });
  expect(badName.headers.get("location")).toContain("r=name");

  const elsewhere = await handleOffer(post({ number: "2", name: "Sam" }, "https://example.com"), env, list, { counters, notifier });
  expect(elsewhere.status).toBe(403);
  expect(db.addOffer).not.toHaveBeenCalled();

  vi.mocked(db.lastInboundAt).mockResolvedValue(new Date().toISOString());
  for (let i = 0; i < OFFERS_PER_VISITOR_PER_HOUR; i++) {
    await handleOffer(post({ number: "2", name: "Sam" }), env, list, { counters, notifier });
  }
  const tooMany = await handleOffer(post({ number: "2", name: "Sam" }), env, list, { counters, notifier });
  expect(tooMany.headers.get("location")).toContain("r=busy");
  expect(db.addOffer).toHaveBeenCalledTimes(OFFERS_PER_VISITOR_PER_HOUR);
});
