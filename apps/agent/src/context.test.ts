import { expect, test } from "vitest";
import { buildInstructions, toChatTurns, whatYouKnow } from "./context";
import type { StoredMessage } from "./types";

const message = (id: number, direction: "in" | "out", text: string): StoredMessage => ({
  id,
  direction,
  kind: "text",
  text,
  sent_at: "2026-11-11T14:02:00Z",
});

test("timestamps user messages and merges messages sent back to back", () => {
  expect(
    toChatTurns([message(1, "in", "hello"), message(2, "out", "Hi"), message(3, "in", "one"), message(4, "in", "two")]),
  ).toEqual([
    { role: "user", content: "[Wed 11 Nov, 14:02] hello" },
    { role: "assistant", content: "Hi" },
    { role: "user", content: "[Wed 11 Nov, 14:02] one\n[Wed 11 Nov, 14:02] two" },
  ]);
});

test("never opens on an assistant message", () => {
  expect(toChatTurns([message(1, "out", "Hi"), message(2, "in", "hello")])).toEqual([
    { role: "user", content: "[Wed 11 Nov, 14:02] hello" },
  ]);
});

test("the what-you-know block follows the shape the prompt expects", () => {
  const block = whatYouKnow({
    now: "2026-11-14T09:00:00Z",
    listStartedAt: "2026-11-11T14:02:00Z",
    profile: null,
    notes: "- Goes by Sam.",
    items: [{ id: 1, number: 1, text: "A laptop to borrow", why: null, status: "open", claims: [] }],
  });
  expect(block).toBe(
    [
      "Profile: nothing yet",
      "List started: 11 November 2026",
      "Today's date: 14 November 2026",
      "List:",
      "1. A laptop to borrow [open]",
      "Notes from earlier chats: - Goes by Sam.",
    ].join("\n"),
  );
});

test("the what-you-know block carries the list page link when there is one", () => {
  const block = whatYouKnow({
    now: "2026-11-14T09:00:00Z",
    listStartedAt: "2026-11-11T14:02:00Z",
    profile: null,
    notes: "",
    items: [],
    listPage: "https://build40for40.com/handup/l/0123456789abcdef",
  });
  expect(block.split("\n")[3]).toBe("List page: https://build40for40.com/handup/l/0123456789abcdef");
});

test("the wiring rules go in just before the what-you-know section", () => {
  const instructions = buildInstructions("You are Handup.\n\n# What you know\n\nBelow is what you know.", "Profile: nothing yet");
  expect(instructions.indexOf("---PASTE---")).toBeGreaterThan(0);
  expect(instructions.indexOf("---PASTE---")).toBeLessThan(instructions.indexOf("# What you know"));
  expect(instructions.endsWith("Below is what you know.\n\nProfile: nothing yet")).toBe(true);
});
