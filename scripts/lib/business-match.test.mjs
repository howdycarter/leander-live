/**
 * Tests for the /businesses chat-search matcher (src/lib/businessMatch.ts)
 * and its Convex mirror. Run via `npm test`.
 *
 * Grounding property under test: the matcher can only ever return records
 * that exist in the dataset it was handed — no invented businesses.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const {
  runMatch,
  composeAnswer,
  emptyContext,
  normalizeQuestion,
  PAGE_SIZE,
} = await import("../../src/lib/businessMatch.ts");

const businesses = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/businesses.json"), "utf8"),
);
const NOW = Date.parse("2026-11-06T12:00:00Z");

test("convex mirror stays byte-identical to the src matcher", () => {
  const a = fs.readFileSync(path.join(root, "src/lib/businessMatch.ts"), "utf8");
  const b = fs.readFileSync(path.join(root, "convex/lib/businessMatch.ts"), "utf8");
  assert.equal(a, b, "convex/lib/businessMatch.ts drifted from src/lib/businessMatch.ts — re-copy it");
});

test("category question returns only real records from that category", () => {
  const out = runMatch(businesses, "where can I get coffee?", undefined, NOW);
  assert.equal(out.status, "ok");
  assert.ok(out.total > 0);
  for (const b of out.shown) {
    assert.ok(businesses.some((x) => x.id === b.id), `invented record ${b.id}`);
    assert.equal(b.category, "Restaurants & Food");
  }
});

test("every shown record, across many questions, exists in the dataset", () => {
  const questions = [
    "plumber open on weekends",
    "who does gluten-free catering near Cedar Park?",
    "best coffee with wifi",
    "food trucks",
    "a good salon for a haircut",
    "auto repair near 78645",
    "new businesses in town",
    "hotels for visiting family",
    "pet grooming",
    "flowers for an anniversary",
  ];
  const ids = new Set(businesses.map((b) => b.id));
  for (const q of questions) {
    const out = runMatch(businesses, q, undefined, NOW);
    for (const b of out.shown) assert.ok(ids.has(b.id), `${q} → ${b.id}`);
    assert.ok(out.shown.length <= PAGE_SIZE);
  }
});

test("cedar park ask carries the leander-only caveat and Leander results", () => {
  const out = runMatch(businesses, "catering near Cedar Park", undefined, NOW);
  assert.ok(out.caveats.includes("leander-only"));
  for (const b of out.shown) assert.ok(["78641", "78645"].includes(b.zip));
});

test("hours question carries the no-hours-phone caveat", () => {
  const out = runMatch(businesses, "what time does the bakery open?", undefined, NOW);
  assert.ok(out.caveats.includes("no-hours-phone"));
  assert.match(composeAnswer(out), /doesn't list hours or phone numbers/);
});

test("off-topic question is refused, not answered", () => {
  const out = runMatch(businesses, "who won the world series last year?", undefined, NOW);
  assert.equal(out.status, "offtopic");
  assert.equal(out.shown.length, 0);
  assert.match(composeAnswer(out), /only help with finding businesses/);
});

test("business-shaped question with no matches says so honestly", () => {
  const out = runMatch(businesses, "is there a submarine sandwich museum?", undefined, NOW);
  assert.equal(out.status, "none");
  assert.match(composeAnswer(out), /couldn't find a listing/);
});

test("zip filter restricts results", () => {
  const out = runMatch(businesses, "restaurants in 78641", undefined, NOW);
  assert.equal(out.status, "ok");
  for (const b of out.shown) assert.equal(b.zip, "78641");
  // 78645 has no records in the permit dataset — the honest answer is none.
  const empty = runMatch(businesses, "restaurants in 78645", undefined, NOW);
  assert.equal(empty.status, "none");
  assert.equal(empty.total, 0);
});

test("follow-up 'more' pages into the same result set without repeats", () => {
  const first = runMatch(businesses, "restaurants", undefined, NOW);
  const second = runMatch(businesses, "show me more", first.context, NOW);
  assert.equal(second.context.category, "Restaurants & Food");
  const firstIds = new Set(first.shown.map((b) => b.id));
  for (const b of second.shown) assert.ok(!firstIds.has(b.id), "page overlap");
  assert.equal(second.context.offset, PAGE_SIZE);
});

test("follow-up refinement keeps the category and narrows", () => {
  const first = runMatch(businesses, "restaurants", undefined, NOW);
  const refined = runMatch(businesses, "what about food trucks?", first.context, NOW);
  assert.equal(refined.context.category, "Food Trucks");
  for (const b of refined.shown) assert.equal(b.category, "Food Trucks");
});

test("freshness filter: 'new businesses' only returns recent permits", () => {
  const out = runMatch(businesses, "new businesses in town", undefined, NOW);
  assert.equal(out.status, "ok");
  for (const b of out.shown) {
    assert.ok(
      b.permitIssuedAt && NOW - b.permitIssuedAt < 90 * 24 * 3600 * 1000,
      `${b.name} is not newly permitted`,
    );
  }
});

test("normalizeQuestion is stable for cache keys", () => {
  assert.equal(normalizeQuestion("  Where's COFFEE?? "), normalizeQuestion("wheres coffee"));
  const ctx = emptyContext();
  assert.deepEqual(ctx, { terms: [], offset: 0 });
});
