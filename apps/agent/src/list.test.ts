import { expect, test } from "vitest";
import { nextItemNumber, renderListForModel } from "./list";
import type { Item } from "./types";

const item = (number: number, status: Item["status"], claims: Item["claims"] = []): Item => ({
  id: number,
  number,
  text: `Thing ${number}`,
  why: null,
  status,
  claims,
});

test("new items take the next number, even after a removal, so numbers never move", () => {
  expect(nextItemNumber([])).toBe(1);
  expect(nextItemNumber([item(1, "open"), item(2, "removed"), item(3, "removed")])).toBe(4);
});

test("leaves removed items out and shows ticked items with who and when", () => {
  const rendered = renderListForModel([
    item(1, "open"),
    item(2, "removed"),
    item(3, "covered", [
      {
        helper_first_name: "Priya",
        show_name: true,
        said: "I've got a spare desk",
        source: "forwarded_message",
        claimed_at: "2026-11-11T14:02:00Z",
      },
    ]),
  ]);
  expect(rendered).toBe(["1. Thing 1 [open]", "3. Thing 3 [ticked, Priya, 11 Nov]"].join("\n"));
});
