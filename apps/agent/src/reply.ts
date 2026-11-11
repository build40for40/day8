import { PASTE_MARKER } from "./config";

export function splitReply(reply: string): string[] {
  return reply
    .split(PASTE_MARKER)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
