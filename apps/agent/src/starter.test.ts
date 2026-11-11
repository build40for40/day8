import { expect, test } from "vitest";
import { firstReply } from "./starter";

test("the first reply numbers the starter items from 1", () => {
  const reply = firstReply(["A laptop to borrow", "Wi-Fi covered for a month"]);
  expect(reply.join("\n")).toContain("1. A laptop to borrow\n2. Wi-Fi covered for a month");
});

test("the first reply is three bubbles: care, then the list, then what to do next", () => {
  const [care, list, next] = firstReply(["A laptop to borrow"]);
  expect(firstReply(["A laptop to borrow"])).toHaveLength(3);
  expect(care).toContain("none of this needs doing today");
  expect(care).not.toContain("1.");
  expect(list).toContain("1. A laptop to borrow");
  expect(next).toContain("I'll be here when you come back");
});
