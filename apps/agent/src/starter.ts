const toYou = (text: string) => text.replace(/\btheir\b/g, "your").replace(/\bthem\b/g, "you");

/** The first reply, as separate chat bubbles: a word of care, the list, then what to do next. */
export function firstReply(starterItems: string[]): string[] {
  const list = starterItems.map((text, i) => `${i + 1}. ${toYou(text)}`).join("\n");
  return [
    "Hi, I'm Handup. You must be going through a lot. Feeling shocked is normal, and none of this needs doing today. Rest first if you need to.",
    [
      "When you're ready, here's a short list of things your friends and family can do for you. They might have a spare laptop, a free desk at their office, or be glad to cook you a warm meal. Most people want to help but don't know how, so letting them is a gift to them too.",
      list,
    ].join("\n\n"),
    'Change, swap or drop any of them by number, like "change 7 to a lift to the station", or add your own. When it looks right, I\'ll write you a message to send on. Or leave it for now. I\'ll be here when you come back.',
  ];
}

export const TEXT_ONLY_REPLY =
  "I can only read text for now. Could you type that out, or paste the message as text?";

export const DAILY_CAP_REPLY =
  "That's a lot of messages for one day, so I need to stop here until tomorrow. Your list is safe.";

export const FORGET_COMMAND = "/forget";

export const FORGET_CONFIRM_REPLY =
  "That deletes your list, this chat and everything I know about you, for good. Send /forget once more and it's done. Send anything else and I'll leave it all as it is.";

export const FORGET_DONE_REPLY = "Done. It's all gone. Say hello any time if you want to start again.";
