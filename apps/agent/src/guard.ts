const AMOUNT = /(?:[£$€]\s?\d[\d,]*(?:\.\d+)?\s?[kK]?|\b\d[\d,]*(?:\.\d+)?\s?(?:quid|pounds?|gbp|euros?|dollars?|p\b|k\b))/gi;
const PHONE = /(?:\+?\d[\s-]?){9,}/;
const UK_POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i;
const STREET = /\b\d+[a-z]?\s+(?:[A-Z][\w']+\s+){1,3}(?:road|rd|street|st|avenue|ave|lane|close|drive|way|crescent|gardens|terrace|place|court)\b/i;

export function hasAmount(text: string): boolean {
  return new RegExp(AMOUNT.source, "i").test(text);
}

export function stripAmounts(text: string): string {
  return text.replace(AMOUNT, "").replace(/[ \t]{2,}/g, " ").trim();
}

export function privateDetail(text: string): "phone number" | "address" | null {
  if (PHONE.test(text)) return "phone number";
  if (UK_POSTCODE.test(text) || STREET.test(text)) return "address";
  return null;
}
