import type { InboundMessage } from "./channel";
import { nextItemNumber } from "./list";
import type { Claim, Item, ListRow, Offer, StoredMessage, User } from "./types";

const now = () => new Date().toISOString();

export async function upsertUser(db: D1Database, phone: string): Promise<User> {
  await db.prepare("INSERT OR IGNORE INTO users (phone, created_at) VALUES (?, ?)").bind(phone, now()).run();
  return (await getUser(db, phone))!;
}

export function getUser(db: D1Database, phone: string): Promise<User | null> {
  return db.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first<User>();
}

export async function insertInbound(db: D1Database, userId: number, message: InboundMessage): Promise<boolean> {
  const result = await db
    .prepare(
      "INSERT OR IGNORE INTO messages (user_id, direction, kind, text, channel_message_id, sent_at) VALUES (?, 'in', ?, ?, ?, ?)",
    )
    .bind(userId, message.kind, message.text, message.channelMessageId, message.sentAt)
    .run();
  return result.meta.changes > 0;
}

export async function insertOutbound(db: D1Database, userId: number, text: string): Promise<void> {
  const at = now();
  await db
    .prepare("INSERT INTO messages (user_id, direction, text, sent_at, handled_at) VALUES (?, 'out', ?, ?, ?)")
    .bind(userId, text, at, at)
    .run();
}

export async function pendingInbound(db: D1Database, userId: number): Promise<StoredMessage[]> {
  const { results } = await db
    .prepare(
      "SELECT id, direction, kind, text, sent_at FROM messages WHERE user_id = ? AND direction = 'in' AND handled_at IS NULL ORDER BY id",
    )
    .bind(userId)
    .all<StoredMessage>();
  return results;
}

export async function markHandled(db: D1Database, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const at = now();
  await db.batch(ids.map((id) => db.prepare("UPDATE messages SET handled_at = ? WHERE id = ?").bind(at, id)));
}

export async function messagesAfter(db: D1Database, userId: number, cursor: number): Promise<StoredMessage[]> {
  const { results } = await db
    .prepare("SELECT id, direction, kind, text, sent_at FROM messages WHERE user_id = ? AND id > ? ORDER BY id")
    .bind(userId, cursor)
    .all<StoredMessage>();
  return results;
}

export async function countInboundSince(db: D1Database, userId: number, sinceIso: string): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND direction = 'in' AND sent_at >= ?")
    .bind(userId, sinceIso)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export function getListForUser(db: D1Database, userId: number): Promise<ListRow | null> {
  return db.prepare("SELECT id, user_id, slug, status, created_at FROM lists WHERE user_id = ?").bind(userId).first<ListRow>();
}

export function getLiveListBySlug(db: D1Database, slug: string): Promise<ListRow | null> {
  return db
    .prepare("SELECT id, user_id, slug, status, created_at FROM lists WHERE slug = ? AND status = 'live'")
    .bind(slug)
    .first<ListRow>();
}

export async function lastListChange(db: D1Database, listId: number): Promise<string | null> {
  const row = await db.prepare("SELECT MAX(created_at) AS at FROM events WHERE list_id = ?").bind(listId).first<{ at: string | null }>();
  return row?.at ?? null;
}

export async function createListWithItems(db: D1Database, userId: number, texts: string[]): Promise<ListRow> {
  const slug = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const at = now();
  await db.prepare("INSERT INTO lists (user_id, slug, created_at) VALUES (?, ?, ?)").bind(userId, slug, at).run();
  const list = (await getListForUser(db, userId))!;
  await db.batch([
    ...texts.map((text, i) =>
      db
        .prepare("INSERT INTO items (list_id, number, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .bind(list.id, i + 1, text, at, at),
    ),
    eventStatement(db, list.id, "list_created", { items: texts.length }),
  ]);
  return list;
}

export async function getItems(db: D1Database, listId: number): Promise<Item[]> {
  const [items, claims, offers] = await db.batch<Record<string, unknown>>([
    db.prepare("SELECT id, number, text, why, status FROM items WHERE list_id = ? ORDER BY number").bind(listId),
    db
      .prepare(
        "SELECT c.item_id, c.helper_first_name, c.show_name, c.said, c.source, c.claimed_at FROM claims c JOIN items i ON i.id = c.item_id WHERE i.list_id = ? ORDER BY c.id",
      )
      .bind(listId),
    db
      .prepare(
        "SELECT o.id, o.item_id, o.helper_first_name, o.notified_at, o.created_at FROM offers o JOIN items i ON i.id = o.item_id WHERE i.list_id = ? AND o.status = 'pending'",
      )
      .bind(listId),
  ]);
  return items.results.map((row) => ({
    ...(row as unknown as Omit<Item, "claims" | "offer">),
    offer: (offers.results.find((offer) => offer.item_id === row.id) as unknown as Offer | undefined) ?? null,
    claims: claims.results
      .filter((claim) => claim.item_id === row.id)
      .map((claim) => ({ ...(claim as unknown as Claim), show_name: claim.show_name === 1 })),
  }));
}

function eventStatement(db: D1Database, listId: number, type: string, detail: unknown): D1PreparedStatement {
  return db
    .prepare("INSERT INTO events (list_id, type, detail, created_at) VALUES (?, ?, ?, ?)")
    .bind(listId, type, JSON.stringify(detail), now());
}

export async function addItem(
  db: D1Database,
  listId: number,
  text: string,
  why: string | null,
  sourceMessageId: number,
): Promise<number> {
  const repeat = await db
    .prepare("SELECT number FROM items WHERE list_id = ? AND source_message_id = ? AND lower(trim(text)) = lower(trim(?))")
    .bind(listId, sourceMessageId, text)
    .first<{ number: number }>();
  if (repeat) return repeat.number;
  const number = nextItemNumber(await getItems(db, listId));
  const at = now();
  await db.batch([
    db
      .prepare(
        "INSERT INTO items (list_id, number, text, why, source_message_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(listId, number, text, why, sourceMessageId, at, at),
    eventStatement(db, listId, "item_added", { number, text, why }),
  ]);
  return number;
}

export async function changeItem(
  db: D1Database,
  listId: number,
  number: number,
  text: string,
  why: string | null,
): Promise<boolean> {
  const [update] = await db.batch([
    db
      .prepare(
        "UPDATE items SET text = ?, why = ?, status = CASE status WHEN 'removed' THEN 'open' ELSE status END, updated_at = ? WHERE list_id = ? AND number = ?",
      )
      .bind(text, why, now(), listId, number),
    eventStatement(db, listId, "item_changed", { number, text, why }),
  ]);
  return update.meta.changes > 0;
}

export async function setItemStatus(
  db: D1Database,
  listId: number,
  number: number,
  status: Item["status"],
): Promise<boolean> {
  const [update] = await db.batch([
    db
      .prepare("UPDATE items SET status = ?, updated_at = ? WHERE list_id = ? AND number = ?")
      .bind(status, now(), listId, number),
    eventStatement(db, listId, `item_${status}`, { number }),
  ]);
  return update.meta.changes > 0;
}

export async function addClaim(
  db: D1Database,
  listId: number,
  number: number,
  claim: Omit<Claim, "claimed_at">,
  sourceMessageId: number,
): Promise<boolean> {
  const item = await db
    .prepare("SELECT id FROM items WHERE list_id = ? AND number = ? AND status != 'removed'")
    .bind(listId, number)
    .first<{ id: number }>();
  if (!item) return false;
  const repeat = await db
    .prepare("SELECT id FROM claims WHERE item_id = ? AND source_message_id = ?")
    .bind(item.id, sourceMessageId)
    .first();
  if (repeat) return true;
  await db.batch([
    db
      .prepare(
        "INSERT INTO claims (item_id, helper_first_name, show_name, said, source, source_message_id, claimed_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(item.id, claim.helper_first_name, claim.show_name ? 1 : 0, claim.said, claim.source, sourceMessageId, now()),
    eventStatement(db, listId, "claim_added", { number, source: claim.source }),
  ]);
  return true;
}

export async function lastInboundAt(db: D1Database, userId: number): Promise<string | null> {
  const row = await db
    .prepare("SELECT MAX(sent_at) AS at FROM messages WHERE user_id = ? AND direction = 'in'")
    .bind(userId)
    .first<{ at: string | null }>();
  return row?.at ?? null;
}

export function getUserById(db: D1Database, id: number): Promise<User | null> {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<User>();
}

export type OfferResult = { ok: true; offerId: number; text: string } | { ok: false; reason: "gone" | "taken" };

export async function addOffer(db: D1Database, listId: number, number: number, helper: string): Promise<OfferResult> {
  const item = await db
    .prepare("SELECT id, text FROM items WHERE list_id = ? AND number = ? AND status = 'open'")
    .bind(listId, number)
    .first<{ id: number; text: string }>();
  if (!item) return { ok: false, reason: "gone" };
  const insert = await db
    .prepare("INSERT OR IGNORE INTO offers (item_id, helper_first_name, created_at) VALUES (?, ?, ?)")
    .bind(item.id, helper, now())
    .run();
  if (insert.meta.changes === 0) return { ok: false, reason: "taken" };
  const offer = await db
    .prepare("SELECT id FROM offers WHERE item_id = ? AND status = 'pending'")
    .bind(item.id)
    .first<{ id: number }>();
  await eventStatement(db, listId, "offer_added", { number }).run();
  return { ok: true, offerId: offer!.id, text: item.text };
}

export async function markOfferNotified(db: D1Database, offerId: number): Promise<void> {
  await db.prepare("UPDATE offers SET notified_at = ? WHERE id = ?").bind(now(), offerId).run();
}

export async function resolveOffer(
  db: D1Database,
  listId: number,
  number: number,
  status: "confirmed" | "declined",
): Promise<boolean> {
  const update = await db
    .prepare(
      "UPDATE offers SET status = ?, resolved_at = ? WHERE status = 'pending' AND item_id IN (SELECT id FROM items WHERE list_id = ? AND number = ?)",
    )
    .bind(status, now(), listId, number)
    .run();
  if (update.meta.changes === 0) return false;
  await eventStatement(db, listId, `offer_${status}`, { number }).run();
  return true;
}

export async function saveNotes(db: D1Database, user: User, notes: string, newCursor: number): Promise<void> {
  await db.batch([
    db
      .prepare("INSERT INTO notes_history (user_id, notes, cursor_message_id, replaced_at) VALUES (?, ?, ?, ?)")
      .bind(user.id, user.notes, user.cursor_message_id, now()),
    db.prepare("UPDATE users SET notes = ?, cursor_message_id = ? WHERE id = ?").bind(notes, newCursor, user.id),
  ]);
}

export async function setDeleteRequested(db: D1Database, userId: number, messageId: number | null): Promise<void> {
  await db.prepare("UPDATE users SET delete_requested_at_message_id = ? WHERE id = ?").bind(messageId, userId).run();
}

export async function deleteEverything(db: D1Database, userId: number): Promise<void> {
  await db.batch([
    db
      .prepare(
        "DELETE FROM offers WHERE item_id IN (SELECT i.id FROM items i JOIN lists l ON l.id = i.list_id WHERE l.user_id = ?)",
      )
      .bind(userId),
    db
      .prepare(
        "DELETE FROM claims WHERE item_id IN (SELECT i.id FROM items i JOIN lists l ON l.id = i.list_id WHERE l.user_id = ?)",
      )
      .bind(userId),
    db.prepare("DELETE FROM items WHERE list_id IN (SELECT id FROM lists WHERE user_id = ?)").bind(userId),
    db.prepare("DELETE FROM events WHERE list_id IN (SELECT id FROM lists WHERE user_id = ?)").bind(userId),
    db.prepare("DELETE FROM lists WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM notes_history WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM messages WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM users WHERE id = ?").bind(userId),
  ]);
}

export async function appendNote(db: D1Database, userId: number, notes: string): Promise<void> {
  await db.prepare("UPDATE users SET notes = ? WHERE id = ?").bind(notes, userId).run();
}

export async function resetList(db: D1Database, listId: number, texts: string[]): Promise<void> {
  const at = now();
  await db.batch([
    db.prepare("DELETE FROM offers WHERE item_id IN (SELECT id FROM items WHERE list_id = ?)").bind(listId),
    db.prepare("DELETE FROM claims WHERE item_id IN (SELECT id FROM items WHERE list_id = ?)").bind(listId),
    db.prepare("DELETE FROM items WHERE list_id = ?").bind(listId),
    db.prepare("UPDATE lists SET created_at = ? WHERE id = ?").bind(at, listId),
    ...texts.map((text, i) =>
      db
        .prepare("INSERT INTO items (list_id, number, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .bind(listId, i + 1, text, at, at),
    ),
    eventStatement(db, listId, "list_reset", { items: texts.length }),
  ]);
}
