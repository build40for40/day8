import { expect, test, vi } from "vitest";

vi.mock("./db");

import * as db from "./db";
import { makeTools, refuseItemText, type ToolContext } from "./tools";
import type { User } from "./types";

test("keeps money and private details off list items", () => {
  expect(refuseItemText("£200 towards a laptop")).toMatch(/No money/);
  expect(refuseItemText("Drop things round to 12 Acacia Road")).toMatch(/address/);
  expect(refuseItemText("A lift to the station")).toBeNull();
});

test("saving the same note again does not add a second line", async () => {
  const ctx = { db: {}, user: { id: 1, notes: "" } as User } as ToolContext;
  const saveNote = makeTools(ctx).save_note.execute!;
  const options = { toolCallId: "call-1", messages: [] } as never;

  await saveNote({ fact: "Goes by Sam" }, options);
  await saveNote({ fact: "goes by  Sam" }, options);

  expect(db.appendNote).toHaveBeenCalledTimes(1);
  expect(ctx.user.notes).toBe("- Goes by Sam");
});
