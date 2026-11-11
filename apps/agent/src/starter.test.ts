import { expect, test } from "vitest";
import { firstReply } from "./starter";

test("the first reply numbers the starter items from 1", () => {
  const reply = firstReply(["A laptop to borrow", "Wi-Fi covered for a month"]);
  expect(reply).toContain("1. A laptop to borrow\n2. Wi-Fi covered for a month");
});
