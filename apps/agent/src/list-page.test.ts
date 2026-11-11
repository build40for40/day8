import { beforeEach, expect, test, vi } from "vitest";
import * as db from "./db";
import { handleListPage, listPageUrl, renderListPage } from "./list-page";
import type { Env, Item, ListRow } from "./types";

vi.mock("./db");

const SLUG = "0123456789abcdef";
const env = {} as Env;
const list: ListRow = { id: 1, user_id: 1, slug: SLUG, status: "live", created_at: "2026-11-11T10:00:00Z" };
const claim = { said: "Dad sent the laptop", source: "told_by_user", claimed_at: "2026-11-11T12:00:00Z" } as const;
const items: Item[] = [
  {
    id: 2,
    number: 2,
    text: "A desk <b>to work from</b>",
    why: null,
    status: "covered",
    claims: [{ ...claim, helper_first_name: "Sara", show_name: true }],
  },
  {
    id: 3,
    number: 3,
    text: "A practice interview",
    why: null,
    status: "covered",
    claims: [{ ...claim, helper_first_name: "Priya", show_name: false }],
  },
  { id: 4, number: 4, text: "A lift to an interview", why: null, status: "removed", claims: [] },
  { id: 5, number: 5, text: "A laptop to borrow", why: null, status: "open", claims: [] },
];

beforeEach(() => {
  vi.mocked(db.getLiveListBySlug).mockResolvedValue(list);
  vi.mocked(db.getItems).mockResolvedValue(items);
  vi.mocked(db.lastListChange).mockResolvedValue("2026-11-11T14:02:00Z");
});

test("shows open items first, then sorted ones with when, and leaves out removed ones", () => {
  const page = renderListPage(items, "2026-11-11T14:02:00Z");
  expect(page).toContain("<b>2 of 3</b> sorted, 1 still open");
  expect(page).toContain('<span class="n">5</span><span class="t">A laptop to borrow</span>');
  expect(page).toContain('<span class="by">Sorted by Sara</span><span class="when">Wed 11 Nov, 12:00</span>');
  expect(page.indexOf("A laptop to borrow")).toBeLessThan(page.indexOf("Already sorted"));
  expect(page.indexOf("Already sorted")).toBeLessThan(page.indexOf("A desk"));
  expect(page).not.toContain("A lift to an interview");
  expect(page).toContain("Last changed Wed 11 Nov, 14:02, UK time.");
});

test("keeps private things off the page: hidden helper names, what was said, and raw HTML", () => {
  const page = renderListPage(items, null);
  expect(page).not.toContain("Priya");
  expect(page).not.toContain("Dad sent the laptop");
  expect(page).toContain("A desk &lt;b&gt;to work from&lt;/b&gt;");
});

test("serves a live list at its link, uncached and unindexed", async () => {
  const response = await handleListPage(new Request(listPageUrl(SLUG)), env);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-robots-tag")).toContain("noindex");
  expect(await response.text()).toContain("A laptop to borrow");
});

test("an unknown, taken down or malformed link gets the not-here page", async () => {
  vi.mocked(db.getLiveListBySlug).mockResolvedValue(null);
  const unknown = await handleListPage(new Request(listPageUrl(SLUG)), env);
  expect(unknown.status).toBe(404);
  expect(await unknown.text()).toContain("This list isn't here");

  vi.mocked(db.getLiveListBySlug).mockClear();
  const malformed = await handleListPage(new Request(listPageUrl("../etc")), env);
  expect(malformed.status).toBe(404);
  expect(db.getLiveListBySlug).not.toHaveBeenCalled();
});
