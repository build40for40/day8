/// <reference types="node" />
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, expect, test } from "vitest";
import * as db from "./db";

function fakeD1(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync("migrations/0001_init.sql", "utf8"));
  sqlite.exec(readFileSync("migrations/0003_offers.sql", "utf8"));
  const statement = (sql: string, params: never[] = []) => {
    const execute = async () =>
      /^\s*select/i.test(sql)
        ? { results: sqlite.prepare(sql).all(...params), meta: { changes: 0 } }
        : { results: [], meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } };
    return {
      bind: (...values: never[]) => statement(sql, values),
      run: execute,
      all: execute,
      first: async () => sqlite.prepare(sql).get(...params) ?? null,
    };
  };
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: ReturnType<typeof statement>[]) => {
      const results = [];
      for (const s of statements) results.push(await s.run());
      return results;
    },
  } as unknown as D1Database;
}

let d1: D1Database;
let listId: number;
const TURN = 7;
const claim = { helper_first_name: "Priya", show_name: true, said: "I can do the desk", source: "told_by_user" } as const;

beforeEach(async () => {
  d1 = fakeD1();
  const user = await db.upsertUser(d1, "447700900000");
  listId = (await db.createListWithItems(d1, user.id, ["A laptop to borrow", "A desk to work from"])).id;
});

test("adding the same item again in one turn returns the first number", async () => {
  expect(await db.addItem(d1, listId, "A lift to the station", null, TURN)).toBe(3);
  expect(await db.addItem(d1, listId, " a lift to the station ", null, TURN)).toBe(3);
  expect(await db.getItems(d1, listId)).toHaveLength(3);
});

test("two different items in one turn are both added", async () => {
  expect(await db.addItem(d1, listId, "A lift to the station", null, TURN)).toBe(3);
  expect(await db.addItem(d1, listId, "A practice interview", null, TURN)).toBe(4);
});

test("ticking the same item again in one turn keeps one claim, and a second item still ticks", async () => {
  expect(await db.addClaim(d1, listId, 2, claim, TURN)).toBe(true);
  expect(await db.addClaim(d1, listId, 2, claim, TURN)).toBe(true);
  expect(await db.addClaim(d1, listId, 1, claim, TURN)).toBe(true);
  const items = await db.getItems(d1, listId);
  expect(items.map((item) => item.claims.length)).toEqual([1, 1]);
});

test("an item takes one offer at a time, and a no opens it up again", async () => {
  const first = await db.addOffer(d1, listId, 2, "Sam");
  expect(first).toMatchObject({ ok: true, text: "A desk to work from" });
  expect(await db.addOffer(d1, listId, 2, "Priya")).toEqual({ ok: false, reason: "taken" });
  expect((await db.getItems(d1, listId))[1].offer?.helper_first_name).toBe("Sam");

  expect(await db.resolveOffer(d1, listId, 2, "declined")).toBe(true);
  expect((await db.getItems(d1, listId))[1].offer).toBeNull();
  expect(await db.addOffer(d1, listId, 2, "Priya")).toMatchObject({ ok: true });
});

test("an offer on a ticked or missing item is turned away", async () => {
  await db.setItemStatus(d1, listId, 1, "covered");
  expect(await db.addOffer(d1, listId, 1, "Sam")).toEqual({ ok: false, reason: "gone" });
  expect(await db.addOffer(d1, listId, 99, "Sam")).toEqual({ ok: false, reason: "gone" });
});
