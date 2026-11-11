export const MODEL_ID = "claude-opus-5-5";
export const MODEL_EFFORT = "low";
export const MAX_TOOL_STEPS = 8;
export const MAX_OUTPUT_TOKENS = 8000;
export const MODEL_TIMEOUT_MS = 120_000;

export const FOLD_THRESHOLD_CHARS = 24_000;
export const NOTES_CAP_CHARS = 2_000;

export const DAILY_MESSAGE_CAP = 100;

export const PASTE_MARKER = "---PASTE---";

export const TWILIO_MAX_CHARS = 1_600;
export const TWILIO_SEND_GAP_MS = 3_100;
export const TWILIO_MAX_WEBHOOK_CHARS = 64_000;

export const WEBHOOK_PATH = "/handup/webhook";

export const WEB_CHAT_PATH = "/handup/api/chat";
export const WEB_CHAT_ALLOWED_ORIGINS = ["https://build40for40.com", "https://www.build40for40.com"];
export const WEB_CHAT_MAX_TURNS = 40;
export const WEB_CHAT_MAX_USER_CHARS = 2_000;
export const WEB_CHAT_MAX_ASSISTANT_CHARS = 8_000;
export const WEB_CHAT_MAX_BODY_CHARS = 400_000;
export const WEB_CHAT_MESSAGES_PER_HOUR = 30;
export const WEB_CHAT_DAILY_CAP_USD = 10;
export const WEB_CHAT_INPUT_MICRO_USD_PER_TOKEN = 4;
export const WEB_CHAT_OUTPUT_MICRO_USD_PER_TOKEN = 20;
export const WEB_CHAT_MAX_OUTPUT_TOKENS = 4_000;
export const WEB_CHAT_TIMEOUT_MS = 60_000;
