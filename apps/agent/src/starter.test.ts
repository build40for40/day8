import { expect, test } from "vitest";
import { firstReply } from "./starter";

const LINK = "https://build40for40.com/handup/l/0123456789abcdef";

test("the first reply is three bubbles: care, then the link to the list, then what to do next", () => {
  const reply = firstReply(LINK);
  const [care, list, next] = reply;
  expect(reply).toHaveLength(3);
  expect(care).toContain("none of this needs doing today");
  expect(list.endsWith(`\n\n${LINK}`)).toBe(true);
  expect(reply.join("\n")).not.toMatch(/^1\. /m);
  expect(next).toContain("I'll be here when you come back");
});
