import assert from "node:assert/strict";
import test from "node:test";
import {
  BLURB_MODEL,
  BLURB_SYSTEM,
  blurbUserPrompt,
  chatCompletionsBody,
  clampBlurb,
  parseCompletion,
  requestBlurb,
  type FetchLike,
} from "../convex/summarizeParse.ts";

const EVENT = {
  title: "Kite Festival",
  description: "Kites over Benbrook Ranch Park.",
  venue: "Benbrook Ranch Park",
};

test("prompt is one user sentence naming the event, description, and venue", () => {
  const prompt = blurbUserPrompt(EVENT);
  assert.match(prompt, /Kite Festival/);
  assert.match(prompt, /Benbrook Ranch Park/);
  assert.doesNotMatch(prompt, /#|🔥/);
  assert.equal(chatCompletionsBody(EVENT).model, BLURB_MODEL);
  assert.equal(chatCompletionsBody(EVENT).messages[0]?.content, BLURB_SYSTEM);
});

test("parseCompletion reads the first choice and clamps to 280 characters", () => {
  assert.equal(
    parseCompletion({
      choices: [{ message: { content: "  Bring a blanket and look up.  " } }],
    }),
    "Bring a blanket and look up.",
  );
  assert.equal(parseCompletion({ choices: [{ message: { content: "   " } }] }), null);
  assert.equal(parseCompletion({}), null);
  const long = "x".repeat(400);
  assert.equal(parseCompletion({ choices: [{ message: { content: long } }] })?.length, 280);
  assert.equal(clampBlurb("  hi  "), "hi");
});

test("requestBlurb posts to chat completions with a mock fetch — never a live OpenAI call", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push(`${init?.method ?? "GET"} ${input}`);
    assert.equal(input, "https://api.openai.com/v1/chat/completions");
    assert.match(String(init?.headers?.Authorization), /^Bearer test-openai$/);
    const body = JSON.parse(init?.body ?? "{}") as {
      messages: { role: string; content: string }[];
    };
    assert.equal(body.messages[1]?.content, blurbUserPrompt(EVENT));
    return {
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        choices: [
          {
            message: {
              content: "Pack a kite and claim a patch of sky.",
            },
          },
        ],
      }),
    };
  };
  const result = await requestBlurb("test-openai", EVENT, fetchImpl);
  assert.deepEqual(result, {
    ok: true,
    blurb: "Pack a kite and claim a patch of sky.",
  });
  assert.deepEqual(calls, ["POST https://api.openai.com/v1/chat/completions"]);
});

test("requestBlurb maps HTTP failures and empty completions without throwing", async () => {
  const failing: FetchLike = async () => ({
    ok: false,
    status: 401,
    text: async () => "nope",
    json: async () => ({}),
  });
  assert.deepEqual(await requestBlurb("k", EVENT, failing), {
    ok: false,
    reason: "openai 401",
  });
  const empty: FetchLike = async () => ({
    ok: true,
    status: 200,
    text: async () => "",
    json: async () => ({ choices: [{ message: { content: "" } }] }),
  });
  assert.deepEqual(await requestBlurb("k", EVENT, empty), {
    ok: false,
    reason: "empty completion",
  });
});
