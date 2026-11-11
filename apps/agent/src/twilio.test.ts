import { afterEach, expect, test, vi } from "vitest";
import type { Env } from "./types";
import { isSignatureValid, parseInbound, signedUrlCandidates, signTwilio, splitForTwilio, twilioChannel } from "./twilio";

const FAKE_NUMBER = "447700900000";
const SID = `SM${"0".repeat(32)}`;
const ours = { accountSid: `AC${"1".repeat(32)}`, from: "whatsapp:+15550100000" };
const URL_CALLED = "https://example.test/handup/webhook";

const form = (overrides: Record<string, string> = {}) =>
  new URLSearchParams({
    MessageSid: SID,
    AccountSid: ours.accountSid,
    To: ours.from,
    From: `whatsapp:+${FAKE_NUMBER}`,
    Body: "I was laid off today",
    NumMedia: "0",
    ...overrides,
  });

afterEach(() => vi.restoreAllMocks());

test("signs the way Twilio's worked example does", async () => {
  const params: [string, string][] = [
    ["Digits", "1234"],
    ["To", "+18005551212"],
    ["From", "+12349013030"],
    ["Caller", "+12349013030"],
    ["CallSid", "CA1234567890ABCDE"],
  ];
  expect(await signTwilio("https://mycompany.com/myapp.php?foo=1&bar=2", params, "12345")).toBe(
    "0/KCTR6DLpKmkAf8muzZqo1nDgQ=",
  );
});

test("accepts a correctly signed request and rejects a tampered one", async () => {
  const params = [...form()];
  const header = await signTwilio(URL_CALLED, params, "fake-token");
  expect(await isSignatureValid(URL_CALLED, params, header, "fake-token")).toBe(true);
  expect(await isSignatureValid(URL_CALLED, [...form({ Body: "changed" })], header, "fake-token")).toBe(false);
  expect(await isSignatureValid(`${URL_CALLED}/`, params, header, "fake-token")).toBe(false);
  expect(await isSignatureValid(URL_CALLED, params, header, "other-token")).toBe(false);
  expect(await isSignatureValid(URL_CALLED, params, null, "fake-token")).toBe(false);
  expect(await isSignatureValid(URL_CALLED, params, header, undefined)).toBe(false);
});

test("checks the signature against the public base URL too when one is set", () => {
  expect(signedUrlCandidates(URL_CALLED, undefined)).toEqual([URL_CALLED]);
  expect(signedUrlCandidates("http://localhost:8787/handup/webhook", "https://fake-tunnel.example.test/")).toEqual([
    "http://localhost:8787/handup/webhook",
    "https://fake-tunnel.example.test/handup/webhook",
  ]);
});

test("reads a text message, with the phone number as plain digits", () => {
  expect(parseInbound(form(), ours, new Date("2026-11-11T14:02:00Z"))).toEqual({
    channelMessageId: SID,
    from: FAKE_NUMBER,
    kind: "text",
    text: "I was laid off today",
    sentAt: "2026-11-11T14:02:00.000Z",
  });
});

test("marks anything that is not text as unreadable", () => {
  expect(parseInbound(form({ NumMedia: "1", Body: "" }), ours)?.kind).toBe("other");
  expect(parseInbound(form({ Latitude: "51.5" }), ours)?.kind).toBe("other");
});

test("ignores messages for another account or sender, and ones that aren't WhatsApp", () => {
  expect(parseInbound(form({ AccountSid: `AC${"2".repeat(32)}` }), ours)).toBeNull();
  expect(parseInbound(form({ To: "whatsapp:+15550100001" }), ours)).toBeNull();
  expect(parseInbound(form({ From: `+${FAKE_NUMBER}` }), ours)).toBeNull();
  expect(parseInbound(form({ MessageSid: "nope" }), ours)).toBeNull();
});

test("splits a long reply at a paragraph or line break, under Twilio's limit", () => {
  expect(splitForTwilio("short")).toEqual(["short"]);
  const pieces = splitForTwilio(`${"a".repeat(30)}\n\n${"b".repeat(30)}\n${"c".repeat(30)}`, 70);
  expect(pieces).toEqual(["a".repeat(30), `${"b".repeat(30)}\n${"c".repeat(30)}`]);
  expect(splitForTwilio("x".repeat(150), 70).map((p) => p.length)).toEqual([70, 70, 10]);
});

test("sends through Twilio's Messages API, and logs instead when the secrets are missing", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 201 }));
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await twilioChannel({} as Env).send(FAKE_NUMBER, "hello");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalled();

  const env = { TWILIO_ACCOUNT_SID: ours.accountSid, TWILIO_AUTH_TOKEN: "fake-token", TWILIO_WHATSAPP_FROM: ours.from } as Env;
  await twilioChannel(env, 0).send(FAKE_NUMBER, "hello");
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${ours.accountSid}/Messages.json`);
  expect(Object.fromEntries(new URLSearchParams(init!.body as string))).toEqual({
    From: ours.from,
    To: `whatsapp:+${FAKE_NUMBER}`,
    Body: "hello",
  });

  fetchMock.mockResolvedValue(Response.json({ code: 63016 }, { status: 400 }));
  await expect(twilioChannel(env, 0).send(FAKE_NUMBER, "hello")).rejects.toThrow("63016");
});
