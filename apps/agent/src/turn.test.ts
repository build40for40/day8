import { expect, test, vi } from "vitest";

vi.mock("./agent", () => ({ reply: vi.fn(), foldNotes: vi.fn(), STARTER_ITEMS: [] }));
vi.mock("./db");

import { reply } from "./agent";
import * as db from "./db";
import { isForget, runTurn } from "./turn";
import type { Env, ListRow, StoredMessage, User } from "./types";

test("only a bare /forget counts as the delete command", () => {
  expect(isForget(" /Forget ")).toBe(true);
  expect(isForget("please /forget what I said about the desk")).toBe(false);
});

test("a failed model call fails the attempt and sends nothing", async () => {
  const pending = [{ id: 5, direction: "in", kind: "text", text: "drop 4", sent_at: "" }] as StoredMessage[];
  vi.mocked(db.getUser).mockResolvedValue({ id: 1, notes: "", delete_requested_at_message_id: null } as User);
  vi.mocked(db.pendingInbound).mockResolvedValue(pending);
  vi.mocked(db.getListForUser).mockResolvedValue({ id: 1 } as ListRow);
  vi.mocked(db.countInboundSince).mockResolvedValue(1);
  vi.mocked(reply).mockRejectedValue(new Error("model timed out"));
  const send = vi.fn();

  await expect(runTurn({ DB: {}, ANTHROPIC_API_KEY: "test" } as Env, { send }, "447700900000")).rejects.toThrow(
    "model timed out",
  );

  expect(send).not.toHaveBeenCalled();
  expect(db.markHandled).not.toHaveBeenCalled();
});
