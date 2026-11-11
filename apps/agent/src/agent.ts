import { createAnthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { generateText, isStepCount, type LanguageModel, type ModelMessage, type ToolSet } from "ai";
import agentPromptDoc from "../../../docs/agent-prompt.md";
import { MAX_OUTPUT_TOKENS, MAX_TOOL_STEPS, MODEL_EFFORT, MODEL_ID, MODEL_TIMEOUT_MS } from "./config";
import { buildInstructions, toChatTurns, whatYouKnow } from "./context";
import { listPageUrl } from "./list-page";
import { capNotes, FOLD_INSTRUCTIONS, foldPrompt } from "./fold";
import { extractPrompt, extractStarterItems } from "./prompt";
import { makeTools, type ToolContext } from "./tools";
import type { Env, Item, StoredMessage } from "./types";

export const SYSTEM_PROMPT = extractPrompt(agentPromptDoc);
export const STARTER_ITEMS = extractStarterItems(SYSTEM_PROMPT);

export const providerOptions = {
  anthropic: { effort: MODEL_EFFORT, fallbacks: "default" } satisfies AnthropicLanguageModelOptions,
};

export function model(env: Env) {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined })(MODEL_ID);
}

export interface LoopResult {
  text: string;
  steps: number;
  toolCalls: string[];
  finishReason: string;
}

export async function runLoop(input: {
  model: LanguageModel;
  instructions: string;
  messages: ModelMessage[];
  tools: ToolSet;
}): Promise<LoopResult> {
  const result = await generateText({
    ...input,
    stopWhen: isStepCount(MAX_TOOL_STEPS),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    providerOptions,
  });
  return {
    text: result.text,
    steps: result.steps.length,
    toolCalls: result.steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)),
    finishReason: result.finishReason,
  };
}

export async function reply(
  env: Env,
  input: { items: Item[]; messages: StoredMessage[]; tools: ToolContext },
): Promise<string> {
  const started = Date.now();
  const { user, list } = input.tools;
  const result = await runLoop({
    model: model(env),
    instructions: buildInstructions(
      SYSTEM_PROMPT,
      whatYouKnow({
        now: new Date().toISOString(),
        listStartedAt: list.created_at,
        profile: user.first_name ? `Goes by ${user.first_name}.` : null,
        notes: user.notes,
        items: input.items,
        listPage: listPageUrl(list.slug),
      }),
    ),
    messages: toChatTurns(input.messages),
    tools: makeTools(input.tools),
  });
  console.log(
    "turn",
    JSON.stringify({
      ms: Date.now() - started,
      steps: result.steps,
      tools: result.toolCalls,
      finish: result.finishReason,
    }),
  );
  return result.text;
}

export async function foldNotes(env: Env, currentNotes: string, toFold: StoredMessage[]): Promise<string> {
  const result = await generateText({
    model: model(env),
    instructions: FOLD_INSTRUCTIONS,
    prompt: foldPrompt(currentNotes, toFold),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    providerOptions,
  });
  return capNotes(result.text);
}
