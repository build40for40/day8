import { foldNotes, reply, STARTER_ITEMS } from "./agent";
import type { Channel } from "./channel";
import { DAILY_MESSAGE_CAP } from "./config";
import * as db from "./db";
import { planFold } from "./fold";
import { splitReply } from "./reply";
import {
  DAILY_CAP_REPLY,
  firstReply,
  FORGET_COMMAND,
  FORGET_CONFIRM_REPLY,
  FORGET_DONE_REPLY,
  TEXT_ONLY_REPLY,
} from "./starter";
import type { ToolContext } from "./tools";
import type { Env } from "./types";

const FALLBACK_REPLY = "Sorry, something went wrong on my side. Could you send that again?";

export function isForget(text: string): boolean {
  return text.trim().toLowerCase() === FORGET_COMMAND;
}

export async function runTurn(env: Env, channel: Channel, phone: string): Promise<void> {
  const user = await db.getUser(env.DB, phone);
  if (!user) return;
  const pending = await db.pendingInbound(env.DB, user.id);
  if (pending.length === 0) return;

  // A string is split at the paste marker. An array is sent as given, one bubble each.
  const send = async (text: string | string[], userStillExists = true) => {
    const parts = Array.isArray(text) ? text : splitReply(text);
    for (const part of parts) await channel.send(phone, part);
    if (userStillExists) await db.insertOutbound(env.DB, user.id, Array.isArray(text) ? text.join("\n\n") : text);
  };
  const handled = () => db.markHandled(env.DB, pending.map((m) => m.id));

  const latest = pending[pending.length - 1];
  if (isForget(latest.text)) {
    if (user.delete_requested_at_message_id === null) {
      await db.setDeleteRequested(env.DB, user.id, latest.id);
      await send(FORGET_CONFIRM_REPLY);
      return handled();
    }
    await db.deleteEverything(env.DB, user.id);
    return send(FORGET_DONE_REPLY, false);
  }
  if (user.delete_requested_at_message_id !== null) await db.setDeleteRequested(env.DB, user.id, null);

  let list = await db.getListForUser(env.DB, user.id);
  if (!list) {
    list = await db.createListWithItems(env.DB, user.id, STARTER_ITEMS);
    await send(firstReply(STARTER_ITEMS));
    return handled();
  }

  if (pending.every((m) => m.kind !== "text")) {
    await send(TEXT_ONLY_REPLY);
    return handled();
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if ((await db.countInboundSince(env.DB, user.id, dayAgo)) > DAILY_MESSAGE_CAP) {
    await send(DAILY_CAP_REPLY);
    return handled();
  }

  const tools: ToolContext = {
    db: env.DB,
    user,
    list,
    starterItems: STARTER_ITEMS,
    inboundText: pending
      .filter((m) => m.kind === "text")
      .map((m) => m.text)
      .join("\n"),
    turnMessageId: pending[0].id,
  };

  if (!env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set: no model call made");
    await send(FALLBACK_REPLY);
    return handled();
  }

  const text = await reply(env, {
    items: await db.getItems(env.DB, list.id),
    messages: await db.messagesAfter(env.DB, user.id, user.cursor_message_id),
    tools,
  });

  await send(text || FALLBACK_REPLY);
  await handled();

  const plan = planFold(await db.messagesAfter(env.DB, user.id, user.cursor_message_id));
  if (plan) {
    try {
      const notes = await foldNotes(env, user.notes, plan.toFold);
      await db.saveNotes(env.DB, user, notes, plan.newCursor);
    } catch (error) {
      console.error("fold failed", error instanceof Error ? error.message : error);
    }
  }
}
