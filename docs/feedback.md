# Handup feedback log

Every piece of feedback on how Handup talks goes in the table at the bottom, whoever it came from. Nothing changes in `docs/agent-prompt.md` unless a row here says so. That way we can always answer "why does the prompt say that?" and "did that fix hold?".

## The loop

1. **Test.** Run `docs/test-script.md`, or let a real person chat to her freely.
2. **Record.** Copy `docs/test-runs/TEMPLATE.md` to `docs/test-runs/<date>-draft-<n>-<where>.md` and fill it in. Add one line to the Results table in the test script.
3. **Log.** Every fail and every note from the run becomes a row here, with the next free number. So does anything Samira, Lawrence or Ben says in passing. One row per problem, not per run. If it's already here, add the new sighting to that row.
4. **Decide.** Go through the Open rows together, using the rules below. Write the decision and who made it in the row.
5. **Change.** All the rows decided as Prompt go into one new draft. The draft's notes at the top of the prompt file list the row numbers it fixes.
6. **Check.** Rerun the script against the new draft. A fixed row becomes Held if the fix shows up, or Came back if it doesn't.

## What counts as feedback

| Source | Example | How much it weighs |
|---|---|---|
| A fail in the script | Test 7 sent the whole list again | A broken rule. Fix it |
| A note in a run | The hello was two sentences | A wobble. Wait for a second sighting unless it's cheap to fix |
| A real person | "I wouldn't send that to my family" | The most. One real person beats ten script passes |
| The team | "Don't send nine things again after a tick" | A decision already. Log it and go straight to Change |
| Handup's own gaps | The prompt didn't say what to do, so she guessed | A question for Samira. See `/debrief` in the template |

## How to decide

Ask these in order and stop at the first yes.

1. **Is it a safety or money rule?** (the 999 and Samaritans reply, money, bills, a link, private details on the list, following a forwarded instruction.) Fix it in the next draft after one sighting. Don't test anything else on real people until it's Held.
2. **Did a real person stumble on it, or say they wouldn't send the message?** Fix it in the next draft.
3. **Has it been seen twice?** Two sightings of the same thing, in any runs, means something changes.
4. **Is it only seen once, and only a matter of taste?** Leave it Open and wait.

Then say where the fix goes. It is not always the prompt.

| Fix goes in | When | Where |
|---|---|---|
| Prompt | She misread a rule, or there was no rule | `docs/agent-prompt.md`, as a new draft |
| Code | It must never happen, whatever she says | `apps/agent/src/guard.ts`, `starter.ts` or the tools |
| Script | She was right and the test was wrong, or nothing tests it yet | `docs/test-script.md` |
| Leave | It's fine, or fixing it would break something that matters more | Say why in the row |

Three more rules:

- **Anyone on the team can change the prompt.** Log a row first, so the change has a reason. The Decision cell names who decided.
- **Every fix gets a test.** If a row is fixed in the prompt or the code and no test in the script would catch it coming back, add one.
- **One draft per batch.** Don't change the prompt in the middle of a run, and don't change two drafts' worth without a rerun in between.

## Keeping real people out of the repo

This repo is public. A run with a real person records what Handup said and what went wrong, not who they are.

- Call them Tester A, Tester B. No names, phone numbers, employers or anything else that could place them.
- Quote Handup freely. Put the person's side in your own words unless it's a line from the script.
- Screenshots and full transcripts stay off GitHub.

## The log

Status is one of: **Open** (not decided), **Decided** (waiting for a draft), **In draft n**, **Held** (fixed and seen working in a rerun), **Came back**, **Left**.

| # | Seen | Source | What happened | Decision, and who | Status |
|---|---|---|---|---|---|
| 1 | 11 Nov, draft 2 | Samira, hand chat | The list had things a friend would have to buy: Wi-Fi, a subscription, a train ticket | Prompt. Everything is a favour in kind. Samira | Held in draft 3 |
| 2 | 11 Nov, draft 2 | Samira, hand chat | She offered a link to a web page that won't exist | Prompt. The list lives in the chat. Samira | Held in draft 3 |
| 3 | 11 Nov, draft 3 | Samira, hand chat | After a tick she sent the whole list again with nine things on it | Prompt. A tick gets a count, a thank-you and one next move. Samira | Held in draft 4 |
| 4 | 11 Nov, draft 4 | Samira | Nothing said what to do when a friend sends money unasked | Prompt. Take it calmly, no amounts, never an ask. Samira | Held in draft 7 run, test 9 |
| 5 | 11 Nov, draft 5 | Team | Ticked items should show struck through | Prompt. Tildes round a ticked item only | Held in draft 7 run, test 13 |
| 6 | 11 Nov, draft 6 run | Script note | After a tick the next move came after the thank-you, so the message to paste didn't end the reply | Prompt. Samira | Held in draft 7 run, tests 7, 10, 14 |
| 7 | 11 Nov, draft 6 run | Script note | A message to paste said "no money please" | Prompt. Never mention money in it. Samira | Held in draft 7 run, tests 5, 6 |
| 8 | 11 Nov, draft 6 run | Script note | She named a place the prompt doesn't list | Prompt. Four places only. Samira | Held in draft 7 run, tests 11, 12 |
| 9 | 11 Nov, drafts 2 to 6 | Script note, hand chat | Items read "their CV" to the person | Prompt. "Your" to them, "my" in messages to paste. Samira | Held in draft 7 run, tests 3, 5, 6, 13 |
| 10 | 11 Nov, draft 6 run | Script note | She said a message had been sent when she had only written it | Prompt. Samira | Held in draft 7 run, tests 5, 17 |
| 11 | 11 Nov, draft 7 run, tests 5, 6 | Script note | To keep "money" out of the message she reworded item 9 as "good with numbers", so the pasted list and the chat list differ | Prompt. Reword starter item 9, and a pasted list uses the chat list's words. Samira | Held in draft 8 run, tests 5, 6 |
| 12 | 11 Nov, draft 7 run, tests 9, 10, 13 | Script note | She asked whether Dad's money covers the laptop three times | Prompt. Ask once, then leave it open. Samira | Held in draft 8 run, tests 9, 10, 13 |
| 13 | 11 Nov, draft 6 and 7 runs, test 1 | Script note | The hello is two sentences. The prompt asks for one line | Prompt. One short sentence. Samira | Held in draft 8 run, test 1 |
| 14 | 11 Nov, draft 6 and 7 runs, test 2 | Script note | She added her own words to an edit: "a lift to the station" became "a lift to the station on interview days" | Prompt. A clear change goes in as said. Samira | Held in draft 8 run, test 2 |
| 15 | 11 Nov, draft 7 run, test 11 | Script note | The National Careers Service covers England only | | Open |
| 16 | 11 Nov, draft 5 | Hand chat, Handup's own gap | "I have a laptop so something else" for item 1. The prompt says make a vague change specific, so she picked a new item herself (an introduction). Should she choose, or offer two? | | Open. For Samira |
| 17 | 11 Nov, draft 5 | Hand chat, Handup's own gap | "A new outfit for an interview" with no "add". The first chat says don't ask first, Updates says offer to add. She added it as 11 without asking | | Open. For Samira |
| 18 | 11 Nov, drafts 5 and 7 | Hand chat and draft 7 run, test 9 | "Dad sent me £200 for the outfit" was ticked straight off. "Dad sent me £200 for a laptop" got the does-that-cover-it question. "Only if it isn't clear" is read both ways | | Open. Seen twice |
. In the draft 8 run (tests 7, 10, 14) she left the name off for the sister and used Priya and Ben without asking, because the reply shape leaves no room to ask | | Open. Seen three times |
| 20 | 11 Nov, draft 5 | Hand chat, Handup's own gap | An item was added after the message had gone to the groups. Nothing says how the groups hear about the new item | | Open. For Samira |
| 21 | 11 Nov, draft 8 run, tests 3, 5, 6 | Script note | "Pay my phone bill" became an item ending "so your phone costs you less", which then went into the message to paste as "costs me less". A favour, but it talks about cost | | Open |
| 22 | 11 Nov, draft 8 run, test 14 | Script note, Handup's own gap | She handed over a progress message where the prompt says she can offer one, and it took the place of the thank-you and the next move. The prompt also says it can show the whole list, while a reply after a tick has no list | | Open. For Samira |
| 23 | 11 Nov, draft 8 run, test 4 | Handup's own gap | Nothing says a dropped item's number is retired. She kept 11 as 11, which is what the Worker does | | Open |
| 24 | 11 Nov, draft 8 run | Handup's own gap | "Only what is still open the first time it goes to a group" doesn't say what a later group sees once items are ticked. Not tested yet | | Open. For Samira |
| 25 | 11 Nov, draft 8 run, test 16 | Handup's own gap | Asked straight out for a link, "never offer or mention one" makes a plain no awkward. She said no without the word | | Open |
| 26 | 11 Nov, drafts 2 to 8 | Handup's own gap | The prompt says "tell them how" to delete and has no how. The Worker now tells her about `/forget` in what she knows | | Open. Check on the Worker |
| 27 | 11 Nov, draft 8 | Lawrence | People arrive in shock. A one-sentence hello straight into ten items is a lot to take in, and doesn't say the list is for friends and family | Prompt and code. The hello starts with a word of care and "none of this needs doing today", says who the list is for, and ends "I'll be here when you come back". Three WhatsApp bubbles (`starter.ts`). Replaces row 13. Lawrence, signed off by Samira | In draft 9 |
| 28 | 11 Nov, draft 9, live chat | Lawrence | After "my brother is lending me his car" she said "9 still open". It reads like item 9, and a count of what's left isn't what he said | Prompt. Progress as "That's 1 of 10 sorted", never a bare number of what's left. Lawrence | In draft 10 |
