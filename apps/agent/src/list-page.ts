import { LANDING_PATH, LIST_PAGE_PATH, OFFER_NAME_MAX_CHARS, SITE_ORIGIN } from "./config";
import * as db from "./db";
import { handleOffer, type OfferNotice } from "./offers";
import { ukDateTime } from "./time";
import type { Env, Item } from "./types";

const SLUG = /^[0-9a-f]{16}$/;
const ASSETS = `${SITE_ORIGIN}${LANDING_PATH}`;

export function listPageUrl(slug: string): string {
  return `${SITE_ORIGIN}${LIST_PAGE_PATH}${slug}`;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const STYLE = `
:root {
  --page: #ecdfc6; --page-deep: #d9c29b; --ink: #3b2416; --soft-ink: #6e5442;
  --accent: #8a2f1f; --gold: #c9973f; --panel: #fbf6ec; --panel-line: #e2d2b6;
  --hand-filter: none; --lamp: transparent;
  --display: "Cormorant Garamond", "Iowan Old Style", Georgia, serif;
  --caps: "Cinzel", "Trajan Pro", "Iowan Old Style", Georgia, serif;
  --body: "Source Serif 4", "Iowan Old Style", Georgia, serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --page: #1d1510; --page-deep: #120c08; --ink: #f1e4cc; --soft-ink: #bfa88c;
    --accent: #d9765c; --panel: #2b2019; --panel-line: #3d2e23;
    --hand-filter: brightness(0.8) sepia(0.15); --lamp: rgba(214, 186, 140, 0.6);
    color-scheme: dark;
  }
}
html, body { margin: 0; }
body {
  color: var(--ink); font-family: var(--body); font-size: 17px; line-height: 1.45;
  background-color: var(--page);
  background-image:
    radial-gradient(ellipse 60% 45% at 18% 22%, rgba(127, 155, 181, 0.16), transparent 70%),
    radial-gradient(ellipse 50% 40% at 85% 75%, rgba(138, 47, 31, 0.10), transparent 70%),
    radial-gradient(ellipse 45% 35% at 70% 15%, rgba(201, 151, 63, 0.14), transparent 70%),
    radial-gradient(ellipse 120% 90% at 50% 50%, transparent 55%, var(--page-deep) 130%);
  background-attachment: fixed;
}
body::before {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.22; mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .36 0 0 0 0 .24 0 0 0 0 .14 0 0 0 .9 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
@media (prefers-color-scheme: dark) { body::before { mix-blend-mode: screen; opacity: 0.08; } }
main { position: relative; z-index: 1; box-sizing: border-box; max-width: 620px; margin: 0 auto; padding: 22px 16px 40px; }
a { color: var(--accent); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.mark { display: block; text-align: center; text-decoration: none; color: var(--ink); font-family: var(--caps); font-weight: 700; font-size: 22px; letter-spacing: 0.16em; }
.hands { display: flex; justify-content: center; margin: 14px -16px 0; background: radial-gradient(ellipse 46% 60% at 50% 50%, var(--lamp), transparent 80%); }
.hands img { width: 50%; height: auto; filter: var(--hand-filter); mix-blend-mode: multiply; user-select: none; }
.hands img:first-child { -webkit-mask-image: radial-gradient(ellipse 100% 50% at 100% 50%, #000 45%, transparent 100%); mask-image: radial-gradient(ellipse 100% 50% at 100% 50%, #000 45%, transparent 100%); }
.hands img:last-child { -webkit-mask-image: radial-gradient(ellipse 100% 50% at 0% 50%, #000 45%, transparent 100%); mask-image: radial-gradient(ellipse 100% 50% at 0% 50%, #000 45%, transparent 100%); }
h1 { margin: 10px 0 0; text-align: center; text-wrap: balance; font-family: var(--display); font-style: italic; font-weight: 600; font-size: clamp(30px, 8vw, 42px); line-height: 1.08; letter-spacing: -0.005em; }
.lede { margin: 14px auto 0; max-width: 34em; text-align: center; color: var(--soft-ink); text-wrap: pretty; }
.card { margin-top: 26px; background: var(--panel); border: 1px solid var(--panel-line); border-radius: 14px; box-shadow: 0 14px 34px rgba(40, 25, 10, 0.16); overflow: hidden; }
.count { margin: 0; padding: 14px 18px; border-bottom: 1px solid var(--panel-line); font-family: var(--caps); font-weight: 600; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--soft-ink); }
.count b { color: var(--accent); font-weight: 700; }
ol { list-style: none; margin: 0; padding: 0; }
li { display: flex; gap: 14px; align-items: flex-start; padding: 14px 18px; }
li + li { border-top: 1px solid var(--panel-line); }
.n { flex: none; box-sizing: border-box; width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid var(--accent); color: var(--accent); display: grid; place-items: center; font-family: var(--caps); font-weight: 700; font-size: 14px; font-variant-numeric: lining-nums; }
.t { min-width: 0; overflow-wrap: anywhere; padding-top: 4px; }
.done .n { border-color: var(--gold); background: var(--gold); color: #3b2416; }
.done s { color: var(--soft-ink); }
.by { display: block; margin-top: 2px; font-family: var(--display); font-style: italic; font-weight: 600; font-size: 18px; color: var(--accent); }
.count.sorted { border-top: 1px solid var(--panel-line); }
.when { display: block; font-size: 13.5px; color: var(--soft-ink); }
.offered .n { border-style: dashed; }
details { margin-top: 8px; }
summary { display: inline-block; cursor: pointer; list-style: none; padding: 7px 16px; border-radius: 999px; border: 1.5px solid var(--accent); color: var(--accent); font-weight: 600; font-size: 15px; }
summary::-webkit-details-marker { display: none; }
details[open] summary { background: var(--accent); color: var(--panel); }
form { margin-top: 12px; }
label { display: block; font-size: 14px; color: var(--soft-ink); }
.go { display: flex; gap: 8px; margin-top: 4px; }
input[name="name"] { flex: 1; min-width: 0; box-sizing: border-box; font: inherit; font-size: 16px; color: var(--ink); background: var(--page); border: 1px solid var(--panel-line); border-radius: 10px; padding: 10px 12px; }
button { flex: none; font: inherit; font-weight: 600; cursor: pointer; border: none; border-radius: 10px; padding: 10px 18px; background: var(--accent); color: var(--panel); }
.small { margin: 8px 0 0; font-size: 13.5px; color: var(--soft-ink); }
.notice { margin: 22px 0 -8px; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--gold); background: var(--panel); text-align: center; }
.empty { margin: 0; padding: 22px 18px; color: var(--soft-ink); }
.how { margin-top: 28px; text-align: center; }
.how h2 { margin: 0; font-family: var(--display); font-style: italic; font-weight: 600; font-size: 28px; line-height: 1.1; }
.how p { margin: 8px auto 0; max-width: 30em; text-wrap: pretty; }
footer { margin-top: 34px; text-align: center; font-size: 14px; color: var(--soft-ink); }
footer p { margin: 4px 0; }
`;

function page(title: string, description: string, body: string): string {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Cormorant+Garamond:ital,wght@0,600;1,600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">
<style>${STYLE}</style>
</head>
<body>
<main>
<a class="mark" href="${LANDING_PATH}">HANDUP</a>
<div class="hands" aria-hidden="true"><img src="${ASSETS}hand-adam.jpg" alt="" width="480" height="220"><img src="${ASSETS}hand-god.jpg" alt="" width="480" height="220"></div>
${body}
</main>
</body>
</html>`;
}

function countLine(open: number, total: number): string {
  if (open === total) return `<b>${total}</b> ${total === 1 ? "thing" : "things"}, all still open`;
  if (open === 0) return `<b>All ${total}</b> sorted. Thank you, all of you`;
  return `<b>${total - open} of ${total}</b> sorted, ${open} still open`;
}

const NOTICES: Record<OfferNotice, string> = {
  offered: "Thank you. They've been sent a message, and it gets crossed off once they say yes.",
  name: "That name didn't go through. A first name is all it needs, letters only.",
  taken: "Someone got there just before you. Is there another one you could do?",
  gone: "That one isn't open any more. Is there another one you could do?",
  busy: "Lots of offers have come in at once. Try again in a bit, or message them directly.",
};

function offerForm(slug: string, item: Item): string {
  return `<details><summary>I can do this</summary>
<form method="post" action="${LIST_PAGE_PATH}${slug}/offer">
<input type="hidden" name="number" value="${item.number}">
<label for="name${item.number}">Your first name</label>
<div class="go"><input id="name${item.number}" name="name" required maxlength="${OFFER_NAME_MAX_CHARS}" autocomplete="given-name" autocapitalize="words"><button type="submit">Offer</button></div>
<p class="small">They'll get a message and say yes before it's crossed off.</p>
</form></details>`;
}

function itemRow(item: Item, slug: string): string {
  const number = `<span class="n">${item.number}</span>`;
  if (item.status === "open" && item.offer) {
    return `<li id="i${item.number}" class="offered">${number}<div class="t">${escapeHtml(item.text)}<span class="by">${escapeHtml(item.offer.helper_first_name)} has offered</span><span class="when">Waiting for a yes since ${escapeHtml(ukDateTime(item.offer.created_at))}</span></div></li>`;
  }
  if (item.status === "open") {
    return `<li id="i${item.number}">${number}<div class="t">${escapeHtml(item.text)}${offerForm(slug, item)}</div></li>`;
  }
  const claim = item.claims[item.claims.length - 1];
  const helper = claim?.show_name && claim.helper_first_name ? `Sorted by ${escapeHtml(claim.helper_first_name)}` : "Sorted";
  const when = claim ? `<span class="when">${escapeHtml(ukDateTime(claim.claimed_at))}</span>` : "";
  return `<li class="done">${number}<div class="t"><s>${escapeHtml(item.text)}</s><span class="by">${helper}</span>${when}</div></li>`;
}

export function renderListPage(
  items: Item[],
  lastChange: string | null,
  slug: string,
  notice: OfferNotice | null = null,
): string {
  const live = items.filter((item) => item.status !== "removed");
  const stillOpen = live.filter((item) => item.status === "open");
  const sorted = live.filter((item) => item.status !== "open");
  const open = stillOpen.length;
  const rows = (group: Item[]) => `<ol>\n${group.map((item) => itemRow(item, slug)).join("\n")}\n</ol>`;
  const list =
    live.length === 0
      ? '<p class="empty">Nothing on the list right now. Check back in a bit.</p>'
      : [
          `<p class="count">${countLine(open, live.length)}</p>`,
          open > 0 ? rows(stillOpen) : "",
          open > 0 && sorted.length > 0 ? '<p class="count sorted">Already sorted</p>' : "",
          sorted.length > 0 ? rows(sorted) : "",
        ]
          .filter(Boolean)
          .join("\n");
  const how =
    open === 0
      ? ""
      : `<section class="how">
<h2>Can you do one?</h2>
<p>Tap "I can do this" on it and leave your first name. They'll get a message, and it's crossed off here once they say yes, so nobody doubles up.</p>
</section>`;
  return page(
    "A Handup list",
    "Someone you know has lost their job. Here are a few favours that would help, and what's still open.",
    `<h1>A few things that would help right now</h1>
<p class="lede">Someone you know has lost their job, and people keep asking what they can do. This is the answer: things lent, things done and a bit of your time. Nothing to buy, and no money.</p>
${notice ? `<p class="notice" role="status">${NOTICES[notice]}</p>` : ""}
<section class="card">
${list}
</section>
${how}
<footer>
${lastChange ? `<p>Last changed ${escapeHtml(ukDateTime(lastChange))}, UK time.</p>` : ""}
<p>Kept up to date by <a href="${LANDING_PATH}">Handup</a>, day 8 of 40 for 40.</p>
</footer>`,
  );
}

export function renderMissingPage(): string {
  return page(
    "Handup",
    "This Handup list isn't here any more.",
    `<h1>This list isn't here</h1>
<p class="lede">It may have been taken down, or the link got clipped on its way to you. Ask whoever sent it for a fresh one.</p>
<footer>
<p><a href="${LANDING_PATH}">What's Handup?</a></p>
</footer>`,
  );
}

function html(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "same-origin",
      "x-content-type-options": "nosniff",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: " +
        `${SITE_ORIGIN}; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
    },
  });
}

export async function handleListPage(
  request: Request,
  env: Env,
  defer?: (work: Promise<unknown>) => void,
): Promise<Response> {
  const url = new URL(request.url);
  const [slug, action, ...rest] = url.pathname.slice(LIST_PAGE_PATH.length).replace(/\/$/, "").split("/");
  const isOffer = action === "offer" && rest.length === 0;
  if (action !== undefined && !isOffer) return html(renderMissingPage(), 404);
  const allowed = isOffer ? request.method === "POST" : request.method === "GET" || request.method === "HEAD";
  if (!allowed) return new Response("Method not allowed", { status: 405 });

  const list = SLUG.test(slug) ? await db.getLiveListBySlug(env.DB, slug) : null;
  if (!list) return html(renderMissingPage(), 404);
  if (isOffer) return handleOffer(request, env, list, { defer });

  const [items, lastChange] = await Promise.all([db.getItems(env.DB, list.id), db.lastListChange(env.DB, list.id)]);
  const r = url.searchParams.get("r");
  const notice = r !== null && Object.hasOwn(NOTICES, r) ? (r as OfferNotice) : null;
  return html(renderListPage(items, lastChange, list.slug, notice), 200);
}
