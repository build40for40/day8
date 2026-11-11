# Test run: draft N, DATE, WHERE

Copy this file to `<date>-draft-<n>-<where>.md` (for example `2026-11-12-draft-8-whatsapp.md`), fill it in, then log every fail and note in `docs/feedback.md`.

- **Draft:** N of `docs/agent-prompt.md`
- **Where:** a Claude agent playing Handup / the sandbox / real WhatsApp
- **Who chatted:** Samira / Tester A (a real person, never named, see the rules in `docs/feedback.md`)
- **Kind of run:** the script, top to bottom / a free chat
- **Marked by:**
- **Result:** X of 18 pass. Fails: test numbers. Notes: how many.

## The script

One block per test. For a pass with nothing to say, one line is enough: "Test 4: Pass."

### Test N

**You send:** the line from the script

**Handup:**

> what she said, copied

**Mark:** Pass or Fail, against the pass and fail lines in the script. Note anything odd even on a pass.

## A free chat

For a real person chatting in their own words. Don't copy their side. Say what they were trying to do, quote what Handup said, and say what happened.

| What they were trying to do | What Handup said | What went wrong, or right |
|---|---|---|
| | | |

## Ask them afterwards

Three questions, straight from what Handup is for. Write the answers in your own words.

1. Did you end up with a list you'd really use? What would you take off or add?
2. Would you paste that message into your family chat as it is? If not, what stopped you?
3. Was there a moment she annoyed you, confused you or made you feel like a charity case?

## Handup's own gaps

If a Claude agent played Handup, ask it to step out at the end (`/debrief`) and list each place the prompt was unclear, silent or contradicted itself, with the line and what it did instead. Paste the list here.

## Did the last draft's fixes hold?

| Row in `docs/feedback.md` | Fix | Held? | Seen in |
|---|---|---|---|
| | | | |

## For the feedback log

Every fail and note above, one line each, with the row number it got in `docs/feedback.md` (or the existing row it was added to).

1.
