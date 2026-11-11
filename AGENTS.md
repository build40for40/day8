# Handup

Day 8 of 40 for 40, built live on Twitch on Wednesday 11 November 2026. The problem is "Sudden mass layoffs", from Lawrence. Work is tracked on the Superthread `day8` board and the "Day 8" page.

- **Form factor:** WhatsApp or iMessage.
- **Name:** Handup, served at `build40for40.com/handup/` once it has a web-facing part.
- **Landing page:** `apps/web/index.html` is the page at build40for40.com/handup/ (published as a copy in the site repo's `public/handup/`). One file: a WhatsApp chat in a phone that plays out as you scroll, from being laid off to the list, the message to paste and a friend's offer ticked off, in the agent's real message shapes from `docs/agent-prompt.md`. The conversation is the plain text block near the bottom of the file, one line per message. The phone always looks like plain WhatsApp. Only the website around it is branded, as the Creation of Adam: fresco plaster, and the two reaching hands from the public-domain fresco either side of the phone. (A Maradona 1986 look with a toggle was tried and dropped.) Set `WHATSAPP` in the script to Handup's number once there is one. The page opens on that scripted story. "Try it yourself" in the phone swaps it for a live chat with the real Handup through `/handup/api/chat` (`window.HANDUP_ASK` in the page's script), and "Back to Jess's story" swaps it back.

Shared 40 for 40 context lives in `../AGENTS.md`.

## The problem

Yesterday, while we were building Poppy, my wife called me unexpectedly. The entire company of Fortis Games shut down and the reports say 440 people will lose their jobs. How can we help?

## Direction

Handup is a "laid-off wedding list": a list of in-kind support that someone who just lost their job can share with friends and family, who pick things off it. Think the loan of a laptop, a desk to work from, a lift to an interview or a practice interview. No money is exchanged in the MVP: nothing is paid through Handup, and nothing on a list is something a friend has to buy or pay for. So no pooled funds, donations, payments, bills or subscriptions. If a friend sends money anyway, that is between the two of them: the agent ticks the item off if the person says it's covered, keeps amounts out of everything, and never turns it into an ask.

**Who it's for:** mid-career people with real outgoings (a mortgage, kids) who are new to AI, from the day they're laid off to about two weeks later. That's when they're in shock and need practical help fast, like cutting outgoings and keeping a laptop and a place to work.

**How it works:**

- The user talks to an AI agent in a chat app. The agent builds their list with them, starting from a starter pack of about 10 common things.
- There is no web list in the MVP. The list lives in the chat. The agent gives the user a ready-made message to copy and paste to friends, family and groups.
- Updates come back through the user: they tell the agent who has covered what, or forward it the message, and it ticks the item off, gives them a short thank-you to paste and offers one next ask. It doesn't send the whole list again after every tick.
- The landing page just shows the chat flow.

**MVP:**

- Users are identified by phone number.
- Store each user's conversation, profile and list, plus the system prompt with the starter pack.
- Keep memory simple, such as one file per user that gets compacted. Smarter long-term memory can come later.
- No agent kit. The agent runs in our own Cloudflare Worker (see How the agent is built).

**Open question: WhatsApp or iMessage.** WhatsApp can't post into existing groups, and nobody wants another Meta approval process. iMessage looks easier but is less documented.

**Ruled out:** a money circle or community emergency fund (money is too hard), an identity mood board, an end-to-end job loss product, a WhatsApp job search agent, warm intros from a LinkedIn export, local support groups, a brag book, and finding fractional or consulting clients.

## The agent

The agent's aim, the user story and the system prompt are in `docs/agent-prompt.md`. The Worker reads the prompt and the starter list of ten straight from that file, so edit them there.

- `docs/agent-needs.md`: what the agent needs from scaffolding (the block that goes in with every message, the actions she takes on the list, the shape of her reply). The tools in `apps/agent/src/tools.ts` use its names.
- `docs/test-script.md`: the fixed messages to send her and what a pass looks like.
- `docs/feedback.md`: every piece of feedback on how she talks, what was decided and whether the fix held. The prompt only changes through a row there. Each run is written up in `docs/test-runs/` from `TEMPLATE.md`.

## Layout

One repo, npm workspaces, everything under `apps/`:

- `apps/agent`: the Cloudflare Worker that receives WhatsApp messages and runs the agent.
- `apps/web`: the landing page, plain static files for now.
- `docs`: the prompt, what the agent needs and the test script, shared by both.

New Workers and web apps go in `apps/` as their own workspace.

## How the agent is built

One Cloudflare Worker, a D1 database called `handup` and a Durable Object per phone number. The decisions are on Superthread card 273. Paths below are inside `apps/agent`.

- **In:** WhatsApp runs through Twilio (`src/twilio.ts`). Twilio posts each message to `/handup/webhook` as form fields. The Worker checks the `X-Twilio-Signature` and hands the message to that phone number's Durable Object (`src/user-turn.ts`).
- **Turns:** the Durable Object runs one turn at a time from an alarm. Messages sent within 3 seconds of each other become one turn. A failed turn is retried up to three times, then the person gets one apology. A turn that already replied is never rerun.
- **First message:** no model call. The Worker seeds the ten starter items and sends a template (`src/starter.ts`).
- **Later turns:** Claude Opus 5.5 through the Vercel AI SDK (`src/agent.ts`). The model id and every tunable number live in `src/config.ts`.
- **What the model sees:** the system prompt, then the "What you know" block from `docs/agent-needs.md` (profile, dates, the list, notes), then every message after the user's cursor as plain text (`src/context.ts`).
- **Memory:** the agent saves lasting facts with `save_note`. When the chat after the cursor passes 24,000 characters, a second model call folds the oldest half into the notes and moves the cursor (`src/fold.ts`). The fold is built but not yet tested against a real model.
- **The list:** lives in D1 and is the truth. Item numbers never move. Each tick records who, when and the words, with amounts stripped. There is no web page for the list in the MVP.
- **No money, nothing private:** `src/guard.ts` strips amounts and refuses items with an amount, a phone number or an obvious address.
- **Repeat safety:** adds and ticks are tied to the turn's first inbound message, so a retried turn can't apply them twice.
- **Out:** a line with only `---PASTE---` splits the reply, so the message to paste arrives as its own chat bubble. Each bubble goes out through Twilio's Messages API, cut at a paragraph or line break if it passes 1,600 characters, with 3.1 seconds between sends so they arrive in order and stay inside the WhatsApp sandbox's limit.
- **Deleting:** the person sends `/forget`, confirms once, and the Worker deletes everything it holds on them.
- **Landing page chat:** `POST /handup/api/chat` (`src/web-chat.ts`) answers the page's live chat with a plain model call: no tools, nothing stored, the list lives in the turns the page sends. The Worker adds the prompt, an empty "What you know" block with the starter list, and the paste marker rule. It only answers `build40for40.com` pages (plus `WEB_CHAT_DEV_ORIGIN` locally), refuses over 40 turns or 2,000 characters in a user message, allows 30 messages an hour per IP address (429 after that), and after $10 of model spend in a UK day replies with a fixed "back tomorrow" line. The counters are rows in the D1 table `web_chat_counters`, with the IP address hashed.
- **Channel:** WhatsApp through Twilio sits behind the small `Channel` interface in `src/channel.ts`, so iMessage could replace it.
- **Spikes:** `spikes/alarm` is the throwaway Worker that tested long alarms.

## Running it

From the repo root:

- `npm install`, then copy `apps/agent/.dev.vars.example` to `apps/agent/.dev.vars` and fill it in. With no Twilio secrets, replies are logged instead of sent. Twilio signs the URL it called, and `wrangler dev` shows the Worker the route's host instead, so to take signed webhooks locally set `PUBLIC_BASE_URL` to the address Twilio (or your test) used: the tunnel's address, or `http://localhost:8787`.
- `npm run db:migrate` sets up the local database, and `npm run dev` starts the Worker.
- `npm run dev:web` serves the landing page on port 4318.
- `npm test` and `npm run typecheck` before you commit. Tests sit next to the file they cover.
- Run wrangler from `apps/agent` as `npm run wrangler -- <args>`, never bare `npx wrangler`.
- CI and deploys are one workflow, `.github/workflows/ci.yml`. Every pull request and push to `main` runs typecheck and tests on Node 22, and `main` requires that `test` check before a merge. A push to `main` that touches `apps/agent`, `docs/agent-prompt.md`, the root `package.json` or lockfile, or the workflow then applies the remote D1 migrations and deploys the Worker, one deploy at a time. It signs in with the org's `CLOUDFLARE_API_TOKEN` secret and sets the Worker's `ANTHROPIC_API_KEY` from the org secret on every deploy. The Twilio secrets (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_WHATSAPP_FROM`, the sender written as `whatsapp:+` then the number) are set by hand with `npm run wrangler -- secret put <NAME>` and survive deploys. To deploy without a code change, run the CI workflow by hand on `main`.
- If the migration file changes before the first deploy, delete `apps/agent/.wrangler/state` and run `npm run db:migrate` again.
