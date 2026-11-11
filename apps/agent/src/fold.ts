import { FOLD_THRESHOLD_CHARS, NOTES_CAP_CHARS } from "./config";
import { ukDateTime } from "./time";
import type { StoredMessage } from "./types";

export interface FoldPlan {
  toFold: StoredMessage[];
  newCursor: number;
}

export function planFold(messagesAfterCursor: StoredMessage[], threshold = FOLD_THRESHOLD_CHARS): FoldPlan | null {
  const total = messagesAfterCursor.reduce((sum, m) => sum + m.text.length, 0);
  if (total <= threshold) return null;

  let folded = 0;
  let cut = 0;
  while (cut < messagesAfterCursor.length - 1 && folded < total / 2) {
    folded += messagesAfterCursor[cut].text.length;
    cut++;
  }
  while (cut < messagesAfterCursor.length - 1 && messagesAfterCursor[cut].direction !== "in") cut++;

  const toFold = messagesAfterCursor.slice(0, cut);
  if (toFold.length === 0) return null;
  return { toFold, newCursor: toFold[toFold.length - 1].id };
}

export const FOLD_INSTRUCTIONS = `You keep the long-term notes for Handup, a WhatsApp helper for someone who has just been laid off. Handup builds a list of practical things their friends and family can give or lend.

You will get the current notes and a stretch of older chat that Handup is about to stop seeing. Rewrite the notes so nothing that matters is lost.

Keep:
- What they like to be called, and how they like to be spoken to.
- Their situation in a line or two: when the layoff happened, what work they do, who is at home.
- The people around them who have come up, by first name, and how each relates to them.
- Anything they asked Handup to remember, and anything they said they do not want.
- Which groups they have shared the list with, if they said.

Leave out:
- The list itself and who covered what. That is stored separately and is always up to date.
- Small talk, and anything already said in the current notes.
- Surnames, addresses, phone numbers, employers, salaries, debts, health details and children's names.

Write plain short lines, no headings. Stay under ${NOTES_CAP_CHARS} characters. If the notes are getting long, drop the oldest and least useful lines first. Reply with the new notes and nothing else.`;

export function foldPrompt(currentNotes: string, toFold: StoredMessage[]): string {
  const transcript = toFold
    .map((m) => `${m.direction === "in" ? "Them" : "Handup"} [${ukDateTime(m.sent_at)}]: ${m.text}`)
    .join("\n\n");
  return `Current notes:\n${currentNotes.trim() || "(none yet)"}\n\nOlder chat to fold in:\n${transcript}`;
}

export function capNotes(notes: string): string {
  return notes.trim().slice(0, NOTES_CAP_CHARS);
}
