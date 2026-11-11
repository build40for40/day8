export interface Env {
  DB: D1Database;
  USER_TURN: DurableObjectNamespace;
  WHATSAPP_PHONE_NUMBER_ID: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WEB_CHAT_DEV_ORIGIN?: string;
}

export interface User {
  id: number;
  phone: string;
  first_name: string | null;
  notes: string;
  cursor_message_id: number;
  delete_requested_at_message_id: number | null;
  created_at: string;
}

export interface StoredMessage {
  id: number;
  direction: "in" | "out";
  kind: "text" | "other";
  text: string;
  sent_at: string;
}

export interface ListRow {
  id: number;
  user_id: number;
  slug: string;
  status: "live" | "taken_down";
  created_at: string;
}

export interface Claim {
  helper_first_name: string | null;
  show_name: boolean;
  said: string;
  source: "told_by_user" | "forwarded_message";
  claimed_at: string;
}

export interface Offer {
  id: number;
  helper_first_name: string;
  notified_at: string | null;
  created_at: string;
}

export interface Item {
  id: number;
  number: number;
  text: string;
  why: string | null;
  status: "open" | "covered" | "removed";
  claims: Claim[];
  offer?: Offer | null;
}
