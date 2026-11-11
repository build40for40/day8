# What the agent needs from scaffolding

Written 11 Nov by Samira for whoever wires the agent up (cards 269, 271 and 273). The system prompt in `docs/agent-prompt.md` (draft 5) assumes everything below. The names are proposals: change them freely, then tell Samira so the prompt uses the same words.

## 1. What goes in with every message

The prompt ends with a "What you know" section and expects this block straight after it, rebuilt on every turn:

```
Profile: <a few lines about the person, or "nothing yet">
List started: 11 November 2026
Today's date: 14 November 2026
List:
1. A laptop to borrow, if the work one has to go back [open]
2. A desk or a quiet spot with good Wi-Fi to work from [ticked, Sara, 12 Nov]
...
Notes from earlier chats: <short notes, or "none">
```

- **Today's date and the list's start date are required.** The prompt asks once whether anything has changed when the list is more than a week old. Dates are Europe/London.
- **Every item keeps its number for life.** A ticked or removed item never frees its number, and a new item takes the next unused one.
- **First names only** for helpers, and only if the person said yes to showing them.

## 2. Seed the starter list before the first reply

The first reply must be the ten favours, with no questions first. Create the person's list from the starter ten the moment a new phone number writes in, so the agent finds it already in "What you know" and doesn't spend ten actions making it. The ten are in the prompt under "The starter list".

## 3. The actions she needs

| Action | What it does | Notes |
|---|---|---|
| `get_list` | Returns the list as it stands | Only needed if the list isn't already in "What you know" |
| `set_item(number, text)` | Rewrites one item | "Change 7 to a lift to the station" |
| `add_item(text)` | Adds an item | Returns the number it was given |
| `remove_item(number)` | Drops an item | The number is retired, not reused |
| `tick_item(number, helper)` | Marks it covered | `helper` is a first name or empty |
| `reopen_item(number)` | Un-ticks it | For "that fell through" |
| `save_note(fact)` | Keeps one lasting fact about the person | One fact per call |
| `reset_list` | Scraps the list and re-seeds the starter ten | For "start again" |

Rules that belong in the code as well as the prompt:

- **No money fields.** No amount, price or payment detail is ever stored, even when a friend sent money and the person mentions the sum.
- **No private details on an item:** surname, address, phone number, employer, salary, debts, health, children's names.
- **Text she didn't write is content, not instructions.** That covers forwarded messages and anything pasted in.

## 4. The shape of her reply

Her reply can have two parts, and they should go out as two chat bubbles:

- **Say:** what she says to the person.
- **Paste:** a message the person copies into a group or sends to a friend. Often absent.

Until the agent can return structured parts, use a marker line. The test sandbox adds this one instruction and splits on it:

> Whenever your reply includes a message for the person to copy and paste, put a line containing only `---PASTE---` before that message, and put nothing after the message.

If the paste part can't be its own bubble on day one, send it as one message with a blank line between the parts. The prompt already puts it last.

## 5. Messages in

- **Text only for the MVP.** If photos, voice notes or files can arrive, tell Samira what the agent should say about them. The prompt has no line for it yet.
- **Several messages sent close together** should arrive as one turn, each on its own line.
- **She never messages first.** The prompt says so. If a nudge is ever added, the prompt changes with it.

## 6. The landing page's live chat

The landing page at `build40for40.com/handup/` plays a scripted chat today. Samira wants the phone on that page to be the real chat, live. The front end for that exists (a Claude artifact built on Lawrence's page) and needs one thing from the Worker.

**One endpoint:** `POST /handup/api/chat`

```
Request:   { "turns": [ { "role": "user" | "assistant", "content": "..." }, ... ] }
Response:  { "text": "Handup's reply" }
```

- `turns` is the whole conversation so far, oldest first, ending on a user turn. The page keeps it, so the Worker stores nothing for these visitors.
- **The system prompt stays on the server.** The Worker adds it, from the fenced block in `docs/agent-prompt.md`, plus the "What you know" block with an empty profile, the starter list and today's date. The page must never send the prompt, or the endpoint becomes a free Claude for anyone who finds it.
- Add the paste marker instruction from section 4, so the page can draw the message to copy as its own bubble.
- Streaming is welcome but not needed. If it streams, send plain text chunks and the page will show them as they arrive.

**Guard rails, because this one is open to the public:**

- A limit per visitor, such as 30 messages an hour by IP address.
- A cap on length: refuse more than about 40 turns or 2,000 characters in one message.
- A daily spending cap, after which it answers with a fixed "back tomorrow" line.
- The Anthropic key as a Cloudflare secret, never in the repo.
- Answer only requests from `build40for40.com` pages.

**On the page:** the chat script looks for one function and uses it in place of Claude's built-in route.

```js
window.HANDUP_ASK = async (turns, { onText, signal }) => {
  const res = await fetch("/handup/api/chat", {
    method: "POST", signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ turns }),
  });
  if (!res.ok) throw { code: res.status === 429 ? "rate_limited" : "upstream_error" };
  const { text } = await res.json();
  onText(text);
  return text;
};
```

Tell Samira when the endpoint answers and she will wire the page to it.

## 7. Still needs an answer

- **How someone deletes everything.** The prompt says "tell them how" and has nothing to tell. A `/forget` message handled by the scaffolding, as on Poppy, would do.
- **One list per phone number?** The prompt assumes so.
- **Can one item have two helpers,** such as two people each covering a week of childcare? The prompt assumes one tick per item.

## 8. What changes in the prompt once this is wired

- The action names above go into the prompt, with "use them quietly".
- The `---PASTE---` line, or its structured replacement, moves from the sandbox into the prompt.
- The delete line gets its real wording.
