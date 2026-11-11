import { PASTE_MARKER } from "./config";

const isList = (paragraph: string) => paragraph.split("\n").every((line) => /^\s*(~\s*)?\d+\./.test(line));

// One chat bubble per paragraph, like a person texting. A numbered list stays in the bubble of the line that introduces it.
function paragraphBubbles(text: string): string[] {
  const bubbles: string[] = [];
  for (const paragraph of text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
    const last = bubbles.length - 1;
    if (isList(paragraph) && last >= 0 && !isList(bubbles[last])) bubbles[last] += `\n\n${paragraph}`;
    else bubbles.push(paragraph);
  }
  return bubbles;
}

// Splits a reply into chat bubbles. The message to paste, after the marker, stays whole so it can be copied in one go.
export function splitReply(reply: string): string[] {
  return reply.split(PASTE_MARKER).flatMap((part, i) => {
    const text = part.trim();
    if (!text) return [];
    return i === 0 ? paragraphBubbles(text) : [text];
  });
}
