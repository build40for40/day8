import { expect, test } from "vitest";
import { ukDate, ukDateTime } from "./time";

test("shows UTC timestamps in UK time, including summer time", () => {
  expect(ukDateTime("2026-11-11T14:02:00Z")).toBe("Wed 11 Nov, 14:02");
  expect(ukDateTime("2026-07-01T23:30:00Z")).toBe("Thu 2 Jul, 00:30");
  expect(ukDate("2026-07-01T23:30:00Z")).toBe("2 Jul");
});
