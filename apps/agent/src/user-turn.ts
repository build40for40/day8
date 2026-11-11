import { DurableObject } from "cloudflare:workers";
import type { Channel, InboundMessage } from "./channel";
import * as db from "./db";
import { runTurn } from "./turn";
import type { Env } from "./types";
import { twilioChannel } from "./twilio";

export const BURST_DEBOUNCE_MS = 3_000;
export const MAX_TURN_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [5_000, 30_000];
const GIVE_UP_REPLY = "Sorry, something went wrong on my side. Could you send that again?";

interface TurnState {
  messageIds: number[];
  attempt: number;
  replied: boolean;
  sent: string[];
}

export class UserTurn extends DurableObject<Env> {
  private running = false;

  async enqueue(message: InboundMessage): Promise<void> {
    const user = await db.upsertUser(this.env.DB, message.from);
    const isNew = await db.insertInbound(this.env.DB, user.id, message);
    if (!isNew) return;
    await this.ctx.storage.put("phone", message.from);
    if (!this.running) await this.ctx.storage.setAlarm(Date.now() + BURST_DEBOUNCE_MS);
  }

  async alarm(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.turn();
    } finally {
      this.running = false;
    }
  }

  private async turn(): Promise<void> {
    const { storage } = this.ctx;
    const phone = await storage.get<string>("phone");
    if (!phone) return;
    const user = await db.getUser(this.env.DB, phone);
    if (!user) {
      await storage.delete("turn");
      return;
    }
    const channel = twilioChannel(this.env);

    // An unfinished turn left in storage means the last run died or threw part way through.
    let unfinished = await storage.get<TurnState>("turn");
    if (unfinished && (unfinished.replied || unfinished.attempt >= MAX_TURN_ATTEMPTS)) {
      if (!unfinished.replied) {
        await channel.send(phone, GIVE_UP_REPLY).catch((error) => console.error("give up reply failed", describe(error)));
      }
      if (unfinished.replied) await this.storeMissingReply(user.id, unfinished);
      await db.markHandled(this.env.DB, unfinished.messageIds);
      await storage.delete("turn");
      unfinished = undefined;
    }

    const pending = await db.pendingInbound(this.env.DB, user.id);
    if (pending.length === 0) return;

    const state: TurnState = {
      messageIds: pending.map((message) => message.id),
      attempt: (unfinished?.attempt ?? 0) + 1,
      replied: false,
      sent: [],
    };
    await storage.put("turn", state);

    const tracked: Channel = {
      send: async (to, text) => {
        await channel.send(to, text);
        state.replied = true;
        state.sent.push(text);
        await storage.put("turn", state);
      },
    };

    try {
      await runTurn(this.env, tracked, phone);
      await storage.delete("turn");
    } catch (error) {
      console.error("turn crashed", describe(error));
      const delay = RETRY_DELAYS_MS[Math.min(state.attempt, RETRY_DELAYS_MS.length) - 1];
      await storage.setAlarm(Date.now() + delay);
      return;
    }

    const after = await db.getUser(this.env.DB, phone);
    if (after && (await db.pendingInbound(this.env.DB, after.id)).length > 0) {
      await storage.setAlarm(Date.now());
    }
  }

  private async storeMissingReply(userId: number, turn: TurnState): Promise<void> {
    if (turn.sent.length === 0) return;
    const after = await db.messagesAfter(this.env.DB, userId, Math.max(...turn.messageIds));
    if (after.some((message) => message.direction === "out")) return;
    await db.insertOutbound(this.env.DB, userId, turn.sent.join("\n\n"));
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
