import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
vi.mock("./db");
vi.mock("./turn");
vi.mock("./twilio");

import type { Channel, InboundMessage } from "./channel";
import * as db from "./db";
import { runTurn } from "./turn";
import type { Env } from "./types";
import { BURST_DEBOUNCE_MS, MAX_TURN_ATTEMPTS, UserTurn } from "./user-turn";
import { twilioChannel } from "./twilio";

const PHONE = "447700900000";
const NOW = Date.parse("2026-11-11T12:00:00Z");

function fakeStorage() {
  const data = new Map<string, unknown>();
  let alarm: number | null = null;
  return {
    data,
    alarmAt: () => alarm,
    get: async (key: string) => structuredClone(data.get(key)),
    put: async (key: string, value: unknown) => void data.set(key, structuredClone(value)),
    delete: async (key: string) => data.delete(key),
    getAlarm: async () => alarm,
    setAlarm: async (at: number) => void (alarm = at),
  };
}

function inbound(id: string): InboundMessage {
  return { channelMessageId: id, from: PHONE, kind: "text", text: "hello", sentAt: new Date(NOW).toISOString() };
}

describe("UserTurn", () => {
  let storage: ReturnType<typeof fakeStorage>;
  let turn: UserTurn;
  let sent: string[];
  let pendingIds: number[];

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(console, "error").mockImplementation(() => {});
    storage = fakeStorage();
    sent = [];
    pendingIds = [];
    turn = new UserTurn({ storage } as unknown as DurableObjectState, { DB: {} } as Env);

    vi.mocked(db.upsertUser).mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof db.upsertUser>>);
    vi.mocked(db.getUser).mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof db.getUser>>);
    vi.mocked(db.insertInbound).mockImplementation(async () => {
      pendingIds.push(pendingIds.length + 1);
      return true;
    });
    vi.mocked(db.pendingInbound).mockImplementation(
      async () => pendingIds.map((id) => ({ id })) as Awaited<ReturnType<typeof db.pendingInbound>>,
    );
    vi.mocked(db.markHandled).mockImplementation(async (_db, ids) => {
      pendingIds = pendingIds.filter((id) => !ids.includes(id));
    });
    vi.mocked(db.messagesAfter).mockResolvedValue([]);
    vi.mocked(twilioChannel).mockReturnValue({ send: async (_to, text) => void sent.push(text) });
    vi.mocked(runTurn).mockImplementation(async (_env, channel: Channel) => {
      await channel.send(PHONE, "reply");
      pendingIds = [];
    });
  });

  it("takes a burst of messages as one turn, a few seconds after the last one", async () => {
    await turn.enqueue(inbound("a"));
    vi.setSystemTime(NOW + 1_000);
    await turn.enqueue(inbound("b"));

    expect(storage.alarmAt()).toBe(NOW + 1_000 + BURST_DEBOUNCE_MS);
    await turn.alarm();
    expect(runTurn).toHaveBeenCalledTimes(1);
    expect(sent).toEqual(["reply"]);
  });

  it("holds a message that arrives mid-turn for the next turn", async () => {
    await turn.enqueue(inbound("a"));
    vi.mocked(runTurn).mockImplementationOnce(async () => {
      pendingIds = [];
      await turn.enqueue(inbound("late"));
      await turn.alarm();
    });

    await turn.alarm();

    expect(runTurn).toHaveBeenCalledTimes(1);
    expect(storage.alarmAt()).toBe(NOW);
  });

  it("retries a turn that failed before replying, without throwing", async () => {
    await turn.enqueue(inbound("a"));
    vi.mocked(runTurn).mockRejectedValueOnce(new Error("d1 down"));

    await expect(turn.alarm()).resolves.toBeUndefined();
    expect(storage.alarmAt()).toBeGreaterThan(NOW);

    await turn.alarm();
    expect(runTurn).toHaveBeenCalledTimes(2);
    expect(sent).toEqual(["reply"]);
    expect(storage.data.has("turn")).toBe(false);
  });

  it("does not rerun a turn that already replied", async () => {
    await turn.enqueue(inbound("a"));
    vi.mocked(runTurn).mockImplementationOnce(async (_env, channel: Channel) => {
      await channel.send(PHONE, "reply");
      throw new Error("failed after the reply went out");
    });

    await turn.alarm();
    await turn.alarm();

    expect(runTurn).toHaveBeenCalledTimes(1);
    expect(sent).toEqual(["reply"]);
    expect(db.markHandled).toHaveBeenCalledWith(expect.anything(), [1]);
  });

  it("stores a reply that went out but never reached the history", async () => {
    await turn.enqueue(inbound("a"));
    vi.mocked(runTurn).mockImplementationOnce(async (_env, channel: Channel) => {
      await channel.send(PHONE, "say");
      await channel.send(PHONE, "paste");
      throw new Error("died before storing the reply");
    });

    await turn.alarm();
    await turn.alarm();

    expect(db.messagesAfter).toHaveBeenCalledWith(expect.anything(), 1, 1);
    expect(db.insertOutbound).toHaveBeenCalledTimes(1);
    expect(db.insertOutbound).toHaveBeenCalledWith(expect.anything(), 1, "say\n\npaste");
  });

  it("does not store the reply twice when the turn already saved it", async () => {
    await turn.enqueue(inbound("a"));
    vi.mocked(runTurn).mockImplementationOnce(async (_env, channel: Channel) => {
      await channel.send(PHONE, "reply");
      throw new Error("died after storing the reply");
    });
    vi.mocked(db.messagesAfter).mockResolvedValue([
      { id: 2, direction: "out", kind: "text", text: "reply", sent_at: new Date(NOW).toISOString() },
    ] as Awaited<ReturnType<typeof db.messagesAfter>>);

    await turn.alarm();
    await turn.alarm();

    expect(db.insertOutbound).not.toHaveBeenCalled();
  });

  it("gives up with an apology after the last attempt", async () => {
    await turn.enqueue(inbound("a"));
    vi.mocked(runTurn).mockRejectedValue(new Error("still down"));

    for (let attempt = 0; attempt <= MAX_TURN_ATTEMPTS; attempt++) await turn.alarm();

    expect(runTurn).toHaveBeenCalledTimes(MAX_TURN_ATTEMPTS);
    expect(sent).toHaveLength(1);
    expect(pendingIds).toEqual([]);
  });
});
