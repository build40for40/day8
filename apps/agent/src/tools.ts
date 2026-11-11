import { tool } from "ai";
import { z } from "zod";
import { NOTES_CAP_CHARS } from "./config";
import * as db from "./db";
import { hasAmount, privateDetail, stripAmounts } from "./guard";
import { renderListForModel } from "./list";
import type { ListRow, User } from "./types";

export interface ToolContext {
  db: D1Database;
  user: User;
  list: ListRow;
  starterItems: string[];
  inboundText: string;
  turnMessageId: number;
}

const FORWARDED = /^\s*(?:fwd|fw|forwarded)\b/i;

export function refuseItemText(text: string): string | null {
  if (hasAmount(text)) return "No money on the list. Turn it into the favour behind it, with no amount, and try again.";
  const detail = privateDetail(text);
  if (detail) return `That has a private detail in it (${detail}). Keep it off the list: they sort that directly with the friend.`;
  return null;
}

export function makeTools(ctx: ToolContext) {
  const listNow = async () => {
    const items = await db.getItems(ctx.db, ctx.list.id);
    return { list: renderListForModel(items), still_open: items.filter((item) => item.status === "open").length };
  };
  const done = async (ok: boolean) =>
    ok ? { ok: true, ...(await listNow()) } : { ok: false, error: "No item with that number", ...(await listNow()) };
  const number = z.number().int().positive().describe("The item's number on the list");

  return {
    get_list: tool({
      description: "Read the list as it stands right now.",
      inputSchema: z.object({}),
      execute: listNow,
    }),
    set_item: tool({
      description: "Rewrite one item. It keeps its number.",
      inputSchema: z.object({ number, text: z.string().describe("The favour, with nothing private and no money") }),
      execute: async ({ number, text }) => {
        const refusal = refuseItemText(text);
        if (refusal) return { ok: false, error: refusal };
        return done(await db.changeItem(ctx.db, ctx.list.id, number, text, null));
      },
    }),
    add_item: tool({
      description: "Add an item. It gets the next unused number, which is returned.",
      inputSchema: z.object({ text: z.string().describe("The favour, with nothing private and no money") }),
      execute: async ({ text }) => {
        const refusal = refuseItemText(text);
        if (refusal) return { ok: false, error: refusal };
        return { ok: true, number: await db.addItem(ctx.db, ctx.list.id, text, null, ctx.turnMessageId), ...(await listNow()) };
      },
    }),
    remove_item: tool({
      description: "Drop an item. Its number is retired and the other numbers stay as they are.",
      inputSchema: z.object({ number }),
      execute: async ({ number }) => {
        await db.resolveOffer(ctx.db, ctx.list.id, number, "declined");
        return done(await db.setItemStatus(ctx.db, ctx.list.id, number, "removed"));
      },
    }),
    decline_offer: tool({
      description: "Clear an offer a friend made on the list page, when the person says it isn't right. The item stays open.",
      inputSchema: z.object({ number }),
      execute: async ({ number }) => {
        const cleared = await db.resolveOffer(ctx.db, ctx.list.id, number, "declined");
        return cleared ? { ok: true, ...(await listNow()) } : { ok: false, error: "No offer waiting on that item", ...(await listNow()) };
      },
    }),
    tick_item: tool({
      description: "Mark an item as covered.",
      inputSchema: z.object({
        number,
        helper: z.string().describe("The helper's first name, or empty if you don't know it or they'd rather not show it"),
      }),
      execute: async ({ number, helper }) => {
        const name = stripAmounts(helper).slice(0, 40);
        const claim = {
          helper_first_name: name || null,
          show_name: name.length > 0,
          said: stripAmounts(ctx.inboundText),
          source: FORWARDED.test(ctx.inboundText) ? "forwarded_message" : "told_by_user",
        } as const;
        const added = await db.addClaim(ctx.db, ctx.list.id, number, claim, ctx.turnMessageId);
        if (added) {
          await db.setItemStatus(ctx.db, ctx.list.id, number, "covered");
          await db.resolveOffer(ctx.db, ctx.list.id, number, "confirmed");
        }
        return done(added);
      },
    }),
    reopen_item: tool({
      description: "Un-tick an item, for example when an offer falls through.",
      inputSchema: z.object({ number }),
      execute: async ({ number }) => done(await db.setItemStatus(ctx.db, ctx.list.id, number, "open")),
    }),
    save_note: tool({
      description: "Keep one lasting fact about the person, such as what they like to be called. One fact per call. Never money, and nothing the list already shows.",
      inputSchema: z.object({ fact: z.string() }),
      execute: async ({ fact }) => {
        const line = stripAmounts(fact).replace(/\s+/g, " ");
        const saved = ctx.user.notes.toLowerCase().split("\n");
        if (line && saved.includes(`- ${line}`.toLowerCase())) return { ok: true };
        const notes = [ctx.user.notes.trim(), `- ${line}`].filter(Boolean).join("\n");
        if (!line || notes.length > NOTES_CAP_CHARS) return { ok: false, error: "Not saved: the notes are full." };
        await db.appendNote(ctx.db, ctx.user.id, notes);
        ctx.user.notes = notes;
        return { ok: true };
      },
    }),
    reset_list: tool({
      description: "Scrap the whole list and start again from the starter ten. Only when they ask to start again.",
      inputSchema: z.object({}),
      execute: async () => {
        await db.resetList(ctx.db, ctx.list.id, ctx.starterItems);
        return { ok: true, ...(await listNow()) };
      },
    }),
  };
}
