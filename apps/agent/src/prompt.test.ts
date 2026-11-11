import { expect, test } from "vitest";
import doc from "../../../docs/agent-prompt.md?raw";
import { extractPrompt, extractStarterItems } from "./prompt";

test("pulls the system prompt out of the doc", () => {
  const prompt = extractPrompt(doc);
  expect(prompt.startsWith("You are Handup")).toBe(true);
  expect(prompt).not.toContain("```");
});

test("finds the ten starter items in order", () => {
  const items = extractStarterItems(extractPrompt(doc));
  expect(items).toHaveLength(10);
  expect(items[0]).toMatch(/^A laptop to borrow/);
});
