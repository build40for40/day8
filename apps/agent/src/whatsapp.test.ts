import { expect, test } from "vitest";
import { isSignatureValid, parseInbound, signBody, verifyChallenge } from "./whatsapp";

const FAKE_NUMBER = "447700900000";

const textMessage = (id: string, body: string) => ({
  id,
  from: FAKE_NUMBER,
  timestamp: "1794405720",
  type: "text",
  text: { body },
});

test("answers Meta's verification challenge only with the right token", async () => {
  const url = new URL("https://example.test/handup/webhook?hub.mode=subscribe&hub.verify_token=t&hub.challenge=123");
  expect(await verifyChallenge(url, "t").text()).toBe("123");
  expect(verifyChallenge(url, "other").status).toBe(403);
  expect(verifyChallenge(url, undefined).status).toBe(403);
});

test("accepts a correctly signed body and rejects a tampered one", async () => {
  const signature = await signBody('{"a":1}', "fake-app-secret");
  expect(await isSignatureValid('{"a":1}', signature, "fake-app-secret")).toBe(true);
  expect(await isSignatureValid('{"a":2}', signature, "fake-app-secret")).toBe(false);
  expect(await isSignatureValid('{"a":1}', null, "fake-app-secret")).toBe(false);
});

test("drops a message id that appears twice in one delivery", () => {
  const payload = {
    entry: [{ changes: [{ value: { messages: [textMessage("wamid.A", "hi"), textMessage("wamid.A", "hi")] } }] }],
  };
  expect(parseInbound(payload).map((m) => m.channelMessageId)).toEqual(["wamid.A"]);
});

test("marks anything that is not text as unreadable", () => {
  const payload = {
    entry: [
      {
        changes: [
          { value: { messages: [{ id: "wamid.B", from: FAKE_NUMBER, timestamp: "1794405720", type: "image" }] } },
        ],
      },
    ],
  };
  const [message] = parseInbound(payload);
  expect(message.kind).toBe("other");
  expect(message.sentAt).toBe("2026-11-11T14:02:00.000Z");
});
