import { expect, test } from "vitest";
import { PASTE_MARKER } from "./config";
import { splitReply } from "./reply";

test("splits the message to paste into its own bubble", () => {
  const reply = `Ticked off 3, the desk.\n${PASTE_MARKER}\nHi all, quick update.\n1. A laptop`;
  expect(splitReply(reply)).toEqual(["Ticked off 3, the desk.", "Hi all, quick update.\n1. A laptop"]);
});

test("leaves a reply with no marker as one bubble", () => {
  expect(splitReply("Sorry to hear that.")).toEqual(["Sorry to hear that."]);
});

test("drops an empty part when the reply is only the message to paste", () => {
  expect(splitReply(`${PASTE_MARKER}\nHi all`)).toEqual(["Hi all"]);
});
