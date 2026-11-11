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

test("sends each paragraph as its own bubble", () => {
  expect(splitReply("Hi, I'm Handup.\n\nThat's a lot to carry.")).toEqual(["Hi, I'm Handup.", "That's a lot to carry."]);
});

test("keeps a numbered list with the line that introduces it", () => {
  const reply = "Rest first.\n\nHere's your list:\n\n1. A laptop\n2. A desk\n\nChange any by number.";
  expect(splitReply(reply)).toEqual(["Rest first.", "Here's your list:\n\n1. A laptop\n2. A desk", "Change any by number."]);
});

test("keeps the message to paste whole, paragraphs and all", () => {
  const reply = `Here you go.\n\nPaste it as it is.\n${PASTE_MARKER}\nHi all.\n\nThese would help:\n1. A laptop`;
  expect(splitReply(reply)).toEqual(["Here you go.", "Paste it as it is.", "Hi all.\n\nThese would help:\n1. A laptop"]);
});
