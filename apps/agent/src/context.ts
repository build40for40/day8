import { PASTE_MARKER } from "./config";
import { renderListForModel } from "./list";
import { ukDateTime, ukLongDate } from "./time";
import type { Item, StoredMessage } from "./types";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export function toChatTurns(messages: StoredMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const message of messages) {
    const role = message.direction === "in" ? "user" : "assistant";
    const content = role === "user" ? `[${ukDateTime(message.sent_at)}] ${message.text}` : message.text;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content += `\n${content}`;
    else turns.push({ role, content });
  }
  while (turns.length > 0 && turns[0].role === "assistant") turns.shift();
  return turns;
}

export const SCAFFOLDING_RULES = `# How this chat is wired

- Whenever your reply includes a message for the person to copy and paste, put a line containing only ${PASTE_MARKER} before that message, and put nothing after the message.
- Your tools are get_list, set_item, add_item, remove_item, tick_item, reopen_item, save_note and reset_list. Change the list with them before you say it has changed. The list under "What you know" is the truth, not the chat.
- When you learn a lasting fact about the person, keep it with save_note, one fact per call.
- Each of their messages starts with the time it was sent. Several sent close together arrive as one turn, each on its own line.
- If they want everything deleted, they send /forget and then confirm. You can't delete it yourself.`;

const KNOW_HEADING = "# What you know";

export function buildInstructions(systemPrompt: string, block: string, rules = SCAFFOLDING_RULES): string {
  const at = systemPrompt.lastIndexOf(KNOW_HEADING);
  const withRules =
    at === -1
      ? `${systemPrompt}\n\n${rules}`
      : `${systemPrompt.slice(0, at)}${rules}\n\n${systemPrompt.slice(at)}`;
  return `${withRules}\n\n${block}`;
}

export function whatYouKnow(input: {
  now: string;
  listStartedAt: string;
  profile: string | null;
  notes: string;
  items: Item[];
}): string {
  return [
    `Profile: ${input.profile?.trim() || "nothing yet"}`,
    `List started: ${ukLongDate(input.listStartedAt)}`,
    `Today's date: ${ukLongDate(input.now)}`,
    "List:",
    renderListForModel(input.items),
    `Notes from earlier chats: ${input.notes.trim() || "none"}`,
  ].join("\n");
}
