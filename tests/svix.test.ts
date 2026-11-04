import assert from "node:assert/strict";
import test from "node:test";
import { signSvix, timingSafeEqual, verifySvix } from "../convex/svix.ts";

const SECRET = `whsec_${btoa("test-webhook-secret-key")}`;
const BODY = JSON.stringify({
  event_type: "message.received",
  message: {
    message_id: "msg_1",
    from: "organizer@example.test",
    subject: "Friday market",
    text: "Venue: Old Town\nNovember 8, 2026 10am",
  },
});
const ID = "msg_test_1";
const TS = "1730748000";

function headers(init: Record<string, string>) {
  return {
    get(name: string) {
      return init[name.toLowerCase()] ?? null;
    },
  };
}

test("timingSafeEqual is length-strict", () => {
  assert.equal(timingSafeEqual("ab", "ab"), true);
  assert.equal(timingSafeEqual("ab", "ac"), false);
  assert.equal(timingSafeEqual("ab", "abc"), false);
});

test("verifySvix accepts a v1 signature over the exact raw body", async () => {
  const sig = await signSvix(BODY, ID, TS, SECRET);
  assert.equal(
    await verifySvix(
      BODY,
      headers({
        "svix-id": ID,
        "svix-timestamp": TS,
        "svix-signature": sig,
      }),
      SECRET,
      Number(TS),
    ),
    true,
  );
});

test("verifySvix rejects a tampered body, missing headers, bad secret, and stale timestamp", async () => {
  const sig = await signSvix(BODY, ID, TS, SECRET);
  assert.equal(
    await verifySvix(
      BODY.replace("Friday", "Saturday"),
      headers({
        "svix-id": ID,
        "svix-timestamp": TS,
        "svix-signature": sig,
      }),
      SECRET,
      Number(TS),
    ),
    false,
  );
  assert.equal(
    await verifySvix(BODY, headers({ "svix-id": ID }), SECRET, Number(TS)),
    false,
  );
  assert.equal(
    await verifySvix(
      BODY,
      headers({
        "svix-id": ID,
        "svix-timestamp": TS,
        "svix-signature": sig,
      }),
      `whsec_${btoa("other-secret-key-xxxx")}`,
      Number(TS),
    ),
    false,
  );
  assert.equal(
    await verifySvix(
      BODY,
      headers({
        "svix-id": ID,
        "svix-timestamp": TS,
        "svix-signature": sig,
      }),
      SECRET,
      Number(TS) + 301,
    ),
    false,
  );
});

test("verifySvix accepts one valid v1 signature among several space-separated values", async () => {
  const sig = await signSvix(BODY, ID, TS, SECRET);
  assert.equal(
    await verifySvix(
      BODY,
      headers({
        "svix-id": ID,
        "svix-timestamp": TS,
        "svix-signature": `v1,deadbeef ${sig}`,
      }),
      SECRET,
      Number(TS),
    ),
    true,
  );
});
