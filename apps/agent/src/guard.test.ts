import { expect, test } from "vitest";
import { hasAmount, privateDetail, stripAmounts } from "./guard";

test("takes amounts of money out of text", () => {
  expect(stripAmounts("Dad sent me £200 for a laptop")).toBe("Dad sent me for a laptop");
  expect(stripAmounts("she gave 50 quid towards it")).toBe("she gave towards it");
  expect(hasAmount("A lift to the station")).toBe(false);
  expect(hasAmount("Childcare for 3 hours on 2 days")).toBe(false);
});

test("spots phone numbers and addresses", () => {
  expect(privateDetail("Call me on 020 7946 0018")).toBe("phone number");
  expect(privateDetail("Drop things at 12 Acacia Road")).toBe("address");
  expect(privateDetail("Drop round to SW1A 1AA")).toBe("address");
  expect(privateDetail("A lift to an interview on the 14th")).toBeNull();
});
