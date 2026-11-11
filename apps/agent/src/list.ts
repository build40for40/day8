import { ukDate } from "./time";
import type { Item } from "./types";

export function nextItemNumber(items: Pick<Item, "number">[]): number {
  return items.reduce((max, item) => Math.max(max, item.number), 0) + 1;
}

export function renderListForModel(items: Item[]): string {
  const live = items.filter((item) => item.status !== "removed");
  if (live.length === 0) return "(the list is empty)";
  return live
    .map((item) => {
      if (item.status === "open") return `${item.number}. ${item.text} [open]`;
      const claim = item.claims[item.claims.length - 1];
      const parts = ["ticked", claim?.show_name ? claim.helper_first_name : null, claim ? ukDate(claim.claimed_at) : null];
      return `${item.number}. ${item.text} [${parts.filter(Boolean).join(", ")}]`;
    })
    .join("\n");
}
