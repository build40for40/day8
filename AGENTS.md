# Handup

Day 8 of 40 for 40, built live on Twitch on Wednesday 11 November 2026. The problem is "Sudden mass layoffs", from Lawrence. Work is tracked on the Superthread `day8` board and the "Day 8" page.

- **Form factor:** WhatsApp or iMessage.
- **Name:** Handup, served at `build40for40.com/handup/` once it has a web-facing part.
- **Landing page:** `landing/index.html` is the draft page: one file, a WhatsApp chat in a phone that plays out as you scroll, from being laid off to the list, the message to paste and a friend's offer ticked off. The conversation is the plain text block near the bottom of the file, one line per message. The look is the Creation of Adam: fresco plaster, and on wide screens the two reaching hands (`landing/hand-adam.jpg`, `landing/hand-god.jpg`, cropped from the public-domain fresco) sit either side of the phone. Set `WHATSAPP` in the script to Handup's number once there is one. It isn't served anywhere yet.

Shared 40 for 40 context lives in `../AGENTS.md`.

## The problem

Yesterday, while we were building Poppy, my wife called me unexpectedly. The entire company of Fortis Games shut down and the reports say 440 people will lose their jobs. How can we help?

## Direction

Handup is a "laid-off wedding list": a list of in-kind support that someone who just lost their job can share with friends and family, who pick things off it. Think a laptop, Wi-Fi, a desk to work from, or a month of a subscription paid for. Help in kind comes first, because that's the spirit of it. Money is allowed as a second or third choice: if a friend says "I haven't got a spare laptop, but here's £500 to buy one", that's fine and the item counts as sorted. Handup never holds or moves money itself, so the cash goes straight between the friend and the person, with no pooled funds and no payments through Handup.

**Who it's for:** mid-career people with real outgoings (a mortgage, kids) who are new to AI, from the day they're laid off to about two weeks later. That's when they're in shock and need practical help fast, like cutting outgoings and keeping a laptop and a place to work.

**How it works:**

- The user talks to an AI agent in a chat app. The agent builds their list with them, starting from a starter pack of about 10 common things.
- The list itself is a web page. The agent gives the user a link or a ready-made message to forward to friends, family and groups.
- Updates come back the same way: the user forwards messages to the agent, and it updates the list.
- The landing page just shows the chat flow.

**MVP:**

- Users are identified by phone number.
- Store each user's conversation, profile and list, plus the system prompt with the starter pack.
- Keep memory simple, such as one file per user that gets compacted. Smarter long-term memory can come later.
- A provider's agent development kit (ADK) might host the agent and its long-term memory. That's still being researched.

**Open question: WhatsApp or iMessage.** WhatsApp can't post into existing groups, and nobody wants another Meta approval process. iMessage looks easier but is less documented.

**Ruled out:** a money circle or community emergency fund (money is too hard), an identity mood board, an end-to-end job loss product, a WhatsApp job search agent, warm intros from a LinkedIn export, local support groups, a brag book, and finding fractional or consulting clients.

## The agent

The agent's aim, the user story and the draft system prompt are in `docs/agent-prompt.md`. The prompt names no tools yet, because the ADK is not chosen.
