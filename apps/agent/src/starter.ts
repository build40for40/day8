const toYou = (text: string) => text.replace(/\btheir\b/g, "your").replace(/\bthem\b/g, "you");

export function firstReply(starterItems: string[]): string {
  const list = starterItems.map((text, i) => `${i + 1}. ${toYou(text)}`).join("\n");
  return [
    "Hi, I'm Handup. I help you turn \"let me know if I can do anything\" into a list of favours your friends and family can pick from. Here's yours to start with:",
    list,
    'Change, swap or drop any of them by number, like "change 7 to a lift to the station", or add your own.',
  ].join("\n\n");
}

export const TEXT_ONLY_REPLY =
  "I can only read text for now. Could you type that out, or paste the message as text?";

export const DAILY_CAP_REPLY =
  "That's a lot of messages for one day, so I need to stop here until tomorrow. Your list is safe.";

export const FORGET_COMMAND = "/forget";

export const FORGET_CONFIRM_REPLY =
  "That deletes your list, this chat and everything I know about you, for good. Send /forget once more and it's done. Send anything else and I'll leave it all as it is.";

export const FORGET_DONE_REPLY = "Done. It's all gone. Say hello any time if you want to start again.";
