import { expect, test } from "vitest";
import { capNotes, planFold } from "./fold";
import type { StoredMessage } from "./types";

const message = (id: number, direction: "in" | "out", length: number): StoredMessage => ({
  id,
  direction,
  kind: "text",
  text: "x".repeat(length),
  sent_at: "2026-11-11T14:02:00Z",
});

test("does nothing while the chat after the cursor is under the budget", () => {
  expect(planFold([message(1, "in", 40), message(2, "out", 60)], 100)).toBeNull();
});

test("folds about the oldest half and moves the cursor to the last folded message", () => {
  const plan = planFold(
    [message(1, "in", 30), message(2, "out", 30), message(3, "in", 30), message(4, "out", 30)],
    100,
  );
  expect(plan?.toFold.map((m) => m.id)).toEqual([1, 2]);
  expect(plan?.newCursor).toBe(2);
});

test("extends the fold so what is left starts on one of their messages", () => {
  const plan = planFold(
    [message(1, "in", 60), message(2, "out", 10), message(3, "out", 10), message(4, "in", 30)],
    100,
  );
  expect(plan?.toFold.map((m) => m.id)).toEqual([1, 2, 3]);
});

test("always leaves the newest message unfolded", () => {
  const plan = planFold([message(1, "in", 500)], 100);
  expect(plan).toBeNull();
});

test("caps the notes", () => {
  expect(capNotes("y".repeat(5000))).toHaveLength(2000);
});
