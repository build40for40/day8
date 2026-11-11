const UK = "Europe/London";

export function ukDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function ukDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK,
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function ukLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function ukDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: UK, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}
