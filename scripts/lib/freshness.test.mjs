import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, dedupe, partitionByFreshness, mergeSourceResults } from './freshness.mjs';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 29);

test('normalizeText folds case, accents, punctuation, ampersands', () => {
  assert.equal(normalizeText("  Café & Bar — Leander! "), 'cafe and bar leander');
  assert.equal(normalizeText(null), '');
});

test('dedupe drops exact id duplicates, keeps first and order', () => {
  const r = dedupe([{ id: 'a', n: 1 }, { id: 'b' }, { id: 'a', n: 2 }], { keyOf: (x) => x.id });
  assert.deepEqual(r.items.map((x) => x.id), ['a', 'b']);
  assert.equal(r.items[0].n, 1);
  assert.equal(r.duplicates.length, 1);
});

test('dedupe catches near-duplicates via normalized composite key', () => {
  const keyOf = (e) => `${normalizeText(e.title)}|${new Date(e.startsAt).toISOString().slice(0, 10)}`;
  const items = [
    { id: 'city-1', title: 'ArtFest!', startsAt: NOW },
    { id: 'chamber-9', title: 'artfest', startsAt: NOW + 3600_000 },
    { id: 'x', title: 'ArtFest', startsAt: NOW + 7 * DAY },
  ];
  assert.equal(dedupe(items, { keyOf }).items.length, 2);
});

test('dedupe prefer() can keep the newer item; falsy keys never collide', () => {
  const prefer = (a, b) => (b.v > a.v ? b : a);
  const r = dedupe([{ k: 'x', v: 1 }, { k: 'x', v: 3 }, { k: '', v: 0 }, { k: '', v: 0 }], { keyOf: (i) => i.k, prefer });
  assert.equal(r.items[0].v, 3);
  assert.equal(r.items.length, 3);
});

test("freshness 'past' mode expires ended events after grace", () => {
  const items = [{ t: NOW - 2 * DAY }, { t: NOW - 1000 }, { t: NOW + DAY }];
  const r = partitionByFreshness(items, { now: NOW, timeOf: (i) => i.t, mode: 'past', graceMs: DAY, missing: 'keep' });
  assert.equal(r.expired.length, 1);
  assert.equal(r.fresh.length, 2);
});

test("freshness 'age' mode expires stale postings; boundary is kept", () => {
  const items = [{ t: NOW - 30 * DAY }, { t: NOW - 31 * DAY }, { t: NOW }];
  const r = partitionByFreshness(items, { now: NOW, timeOf: (i) => i.t, mode: 'age', maxAgeMs: 30 * DAY, missing: 'keep' });
  assert.deepEqual(r.expired, [{ t: NOW - 31 * DAY }]);
});

test('missing timestamps follow explicit policy', () => {
  const items = [{}, { t: 'bad' }];
  const base = { now: NOW, timeOf: (i) => i.t, mode: 'age', maxAgeMs: DAY };
  assert.equal(partitionByFreshness(items, { ...base, missing: 'keep' }).fresh.length, 2);
  assert.equal(partitionByFreshness(items, { ...base, missing: 'expire' }).expired.length, 2);
});

test('freshness requires explicit policy (no hidden defaults)', () => {
  assert.throws(() => partitionByFreshness([], { timeOf: () => 0, mode: 'age', maxAgeMs: 1, missing: 'keep' }), TypeError);
  assert.throws(() => partitionByFreshness([], { now: NOW, timeOf: () => 0, mode: 'age', missing: 'keep' }), TypeError);
  assert.throws(() => partitionByFreshness([], { now: NOW, timeOf: () => 0, mode: 'age', maxAgeMs: 1 }), TypeError);
  assert.throws(() => partitionByFreshness([], { now: NOW, timeOf: () => 0, mode: 'other', missing: 'keep' }), TypeError);
});

test('partial failure keeps previous items for the failed source only', () => {
  const r = mergeSourceResults(
    [{ source: 'city', ok: true, items: [{ id: 'c2' }] }, { source: 'chamber', ok: false, error: 'HTTP 503' }],
    { city: [{ id: 'c1' }], chamber: [{ id: 'h1' }] },
  );
  assert.deepEqual(r.items.map((x) => x.id), ['c2', 'h1']);
  assert.deepEqual(r.failed, [{ source: 'chamber', error: 'HTTP 503' }]);
  assert.deepEqual(r.used, { city: 'fresh', chamber: 'previous' });
});

test('partial failure with no previous data reports none and does not throw', () => {
  const r = mergeSourceResults([{ source: 'news', ok: false }, null]);
  assert.equal(r.items.length, 0);
  assert.equal(r.used.news, 'none');
  assert.equal(r.failed.length, 2);
});

test('pure: inputs are not mutated', () => {
  const items = Object.freeze([Object.freeze({ id: 'a' }), Object.freeze({ id: 'a' })]);
  dedupe(items, { keyOf: (x) => x.id });
  partitionByFreshness(items, { now: NOW, timeOf: () => NOW, mode: 'past', graceMs: 0, missing: 'keep' });
});
