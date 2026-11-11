export interface Env {
  DB: D1Database;
  USER_TURN: DurableObjectNamespace;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_WHATSAPP_FROM?: string;
  PUBLIC_BASE_URL?: string;
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

export interface Item {
  id: number;
  number: number;
  text: string;
  why: string | null;
  status: "open" | "covered" | "removed";
  claims: Claim[];
}
