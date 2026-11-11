import { tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { z } from "zod";
import { runLoop } from "./agent";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

test("runs the tool the model asks for, then returns its reply", async () => {
  const changed: number[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: [
      {
        content: [{ type: "tool-call", toolCallId: "call-1", toolName: "remove_item", input: '{"number":4}' }],
        finishReason: { unified: "tool-calls", raw: undefined },
        usage,
        warnings: [],
      },
      {
        content: [{ type: "text", text: "Dropped 4." }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      },
    ],
  });

  const result = await runLoop({
    model,
    instructions: "You keep a list.",
    messages: [{ role: "user", content: "drop number 4" }],
    tools: {
      remove_item: tool({
        inputSchema: z.object({ number: z.number() }),
        execute: async ({ number }) => {
          changed.push(number);
          return { ok: true };
        },
      }),
    },
  });

  expect(changed).toEqual([4]);
  expect(result).toMatchObject({ text: "Dropped 4.", steps: 2, toolCalls: ["remove_item"], finishReason: "stop" });
  expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain('"ok":true');
});
