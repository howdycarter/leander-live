import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, dedupe, partitionByFreshness, mergeSourceResults, isValidTimestamp } from './freshness.mjs';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 29);
const base = { now: NOW, timeOf: (i) => i.t, missing: 'keep' };

test('normalizeText folds case, accents, punctuation, ampersands', () => {
  assert.equal(normalizeText('  Café & Bar — Leander! '), 'cafe and bar leander');
  assert.equal(normalizeText(null), '');
});

// Fix 5
test('fix5: non-Latin titles keep letters/numbers and do not collide', () => {
  assert.equal(normalizeText('Фестиваль 2026'), 'фестиваль 2026');
  assert.notEqual(normalizeText('中秋节'), normalizeText('春节'));
  assert.equal(normalizeText('ＡＢＣ１２'), 'abc12'); // NFKC full-width
  const r = dedupe([{ t: '中秋节' }, { t: '春节' }, { t: 'Фестиваль' }], { keyOf: (x) => normalizeText(x.t) });
  assert.equal(r.items.length, 3);
});
test('fix5: empty normalized keys never collide and are flagged', () => {
  const r = dedupe([{ t: '!!!' }, { t: '—' }, { t: '' }], { keyOf: (x) => normalizeText(x.t) });
  assert.equal(r.items.length, 3);
  assert.equal(r.unkeyed, 3);
  assert.equal(r.duplicates.length, 0);
});

test('dedupe drops exact id duplicates, keeps first and order', () => {
  const r = dedupe([{ id: 'a', n: 1 }, { id: 'b' }, { id: 'a', n: 2 }], { keyOf: (x) => x.id });
  assert.deepEqual(r.items.map((x) => x.id), ['a', 'b']);
  assert.equal(r.items[0].n, 1);
  assert.equal(r.duplicates.length, 1);
});

// Fix 6
test('fix6: explicit occurrence identity keeps different sessions/venues', () => {
  const keyOf = (e) => [normalizeText(e.title), e.startsAt, normalizeText(e.venue)].join('|');
  const items = [
    { id: 'city-1', title: 'ArtFest!', startsAt: NOW + 10 * 3600_000, venue: 'Lakewood Park' },
    { id: 'chamber-9', title: 'artfest', startsAt: NOW + 10 * 3600_000, venue: 'Lakewood  Park' }, // same occurrence
    { id: 'pm', title: 'ArtFest', startsAt: NOW + 15 * 3600_000, venue: 'Lakewood Park' }, // later session
    { id: 'v2', title: 'ArtFest', startsAt: NOW + 10 * 3600_000, venue: 'Old Town' }, // other venue
  ];
  assert.deepEqual(dedupe(items, { keyOf }).items.map((x) => x.id), ['city-1', 'pm', 'v2']);
});

test('dedupe prefer() can keep the newer item', () => {
  const r = dedupe([{ k: 'x', v: 1 }, { k: 'x', v: 3 }], { keyOf: (i) => i.k, prefer: (a, b) => (b.v > a.v ? b : a) });
  assert.equal(r.items[0].v, 3);
});

test("freshness 'past' mode expires ended events after grace", () => {
  const r = partitionByFreshness([{ t: NOW - 2 * DAY }, { t: NOW - 1000 }, { t: NOW + DAY }], { ...base, mode: 'past', graceMs: DAY });
  assert.equal(r.expired.length, 1);
  assert.equal(r.fresh.length, 2);
});
test("freshness 'age' mode expires stale postings; boundary is kept", () => {
  const r = partitionByFreshness([{ t: NOW - 30 * DAY }, { t: NOW - 31 * DAY }], { ...base, mode: 'age', maxAgeMs: 30 * DAY });
  assert.deepEqual(r.expired, [{ t: NOW - 31 * DAY }]);
});
test('missing timestamps follow explicit policy', () => {
  const items = [{}, { t: 'bad' }, { t: NaN }];
  const o = { ...base, mode: 'age', maxAgeMs: DAY };
  assert.equal(partitionByFreshness(items, { ...o, missing: 'keep' }).fresh.length, 3);
  assert.equal(partitionByFreshness(items, { ...o, missing: 'expire' }).expired.length, 3);
});

// Fix 4
test('fix4: finite but unrepresentable timestamps (1e20) follow missing policy', () => {
  assert.equal(isValidTimestamp(1e20), false);
  assert.equal(isValidTimestamp(-1e20), false);
  assert.equal(isValidTimestamp(8.64e15), true);
  const o = { ...base, mode: 'past', graceMs: 0 };
  assert.equal(partitionByFreshness([{ t: 1e20 }], { ...o, missing: 'expire' }).expired.length, 1);
  assert.equal(partitionByFreshness([{ t: -1e20 }], { ...o, missing: 'keep' }).fresh.length, 1);
  assert.throws(() => partitionByFreshness([], { ...o, now: 1e20 }), /now/);
});

// Fix 3
test('fix3: negative expiry windows are rejected with RangeError', () => {
  assert.throws(() => partitionByFreshness([], { ...base, mode: 'past', graceMs: -1 }), { name: 'RangeError', message: /graceMs must be >= 0/ });
  assert.throws(() => partitionByFreshness([], { ...base, mode: 'age', maxAgeMs: -DAY }), { name: 'RangeError', message: /maxAgeMs must be >= 0/ });
});
test('fix3: invalid option types/values are rejected with clear errors', () => {
  const ok = { ...base, mode: 'age', maxAgeMs: DAY };
  assert.throws(() => partitionByFreshness([], { ...ok, maxAgeMs: Infinity }), /maxAgeMs must be a finite number/);
  assert.throws(() => partitionByFreshness([], { ...ok, maxAgeMs: '5' }), /maxAgeMs must be a finite number/);
  assert.throws(() => partitionByFreshness([], { ...ok, now: undefined }), /now must be/);
  assert.throws(() => partitionByFreshness([], { ...ok, timeOf: 'x' }), /timeOf must be a function/);
  assert.throws(() => partitionByFreshness([], { ...ok, mode: 'other' }), /mode must be/);
  assert.throws(() => partitionByFreshness([], { ...ok, missing: true }), /missing must be/);
  assert.throws(() => partitionByFreshness('nope', ok), /items must be an array/);
  assert.throws(() => dedupe([], { keyOf: () => 'k', prefer: 1 }), /prefer must be a function/);
  assert.throws(() => mergeSourceResults({}), /results must be an array/);
  assert.throws(() => mergeSourceResults([], null), /previousBySource must be an object/);
});

test('partial failure keeps previous items for the failed source only', () => {
  const r = mergeSourceResults(
    [{ source: 'city', ok: true, items: [{ id: 'c2' }] }, { source: 'chamber', ok: false, error: 'HTTP 503' }],
    { city: [{ id: 'c1' }], chamber: [{ id: 'h1' }] },
  );
  assert.deepEqual(r.items.map((x) => x.id), ['c2', 'h1']);
  assert.deepEqual(r.failed, [{ source: 'chamber', error: 'HTTP 503' }]);
  assert.equal(r.used.get('city'), 'fresh');
  assert.equal(r.used.get('chamber'), 'previous');
});

// Fix 1
test("fix1: 'constructor' source does not throw or inherit prototype values", () => {
  const r = mergeSourceResults([{ source: 'constructor', ok: false, error: 'x' }, { source: 'toString', ok: false }], {});
  assert.equal(r.items.length, 0);
  assert.equal(r.used.get('constructor'), 'none');
  assert.equal(r.used.get('toString'), 'none');
});
test("fix1: '__proto__' source keeps its metadata and own previous data", () => {
  const prev = Object.create(null);
  prev['__proto__'] = [{ id: 'p1' }];
  const r = mergeSourceResults([{ source: '__proto__', ok: false, error: 'down' }], prev);
  assert.deepEqual(r.items, [{ id: 'p1' }]);
  assert.equal(r.used.get('__proto__'), 'previous');
  assert.deepEqual([...r.used.keys()], ['__proto__']);
  const r2 = mergeSourceResults([{ source: '__proto__', ok: true, items: [{ id: 'n' }] }]);
  assert.equal(r2.used.get('__proto__'), 'fresh');
});

// Fix 2
test("fix2: ok:'false' / truthy non-boolean ok cannot discard last-good data", () => {
  for (const ok of ['false', 'true', 1, {}]) {
    const r = mergeSourceResults([{ source: 'city', ok, items: [] }], { city: [{ id: 'c1' }] });
    assert.deepEqual(r.items, [{ id: 'c1' }], `ok=${JSON.stringify(ok)}`);
    assert.equal(r.used.get('city'), 'previous');
  }
});
test('fix2: ok:true with non-array items falls back to previous data', () => {
  for (const items of [null, undefined, 'x', { length: 0 }]) {
    const r = mergeSourceResults([{ source: 'city', ok: true, items }], { city: [{ id: 'c1' }] });
    assert.deepEqual(r.items, [{ id: 'c1' }]);
    assert.deepEqual(r.failed, [{ source: 'city', error: 'items is not an array' }]);
  }
});
test('fix2: non-array previous data is ignored, not spread', () => {
  const r = mergeSourceResults([{ source: 'city', ok: false }], { city: 'oops' });
  assert.equal(r.items.length, 0);
  assert.equal(r.used.get('city'), 'none');
});

// Fix 7 (documented omitted-source behavior)
test('omitted sources are not retained and are reported', () => {
  const r = mergeSourceResults([{ source: 'city', ok: true, items: [] }], { city: [{ id: 'c1' }], chamber: [{ id: 'h1' }] });
  assert.deepEqual(r.items, []);
  assert.deepEqual(r.omitted, ['chamber']);
});
test('partial failure with no previous data and null result does not throw', () => {
  const r = mergeSourceResults([{ source: 'news', ok: false }, null]);
  assert.equal(r.items.length, 0);
  assert.equal(r.used.get('news'), 'none');
  assert.equal(r.failed.length, 2);
});

test('pure: inputs are not mutated', () => {
  const items = Object.freeze([Object.freeze({ id: 'a' }), Object.freeze({ id: 'a' })]);
  dedupe(items, { keyOf: (x) => x.id });
  partitionByFreshness(items, { ...base, timeOf: () => NOW, mode: 'past', graceMs: 0 });
  mergeSourceResults(Object.freeze([Object.freeze({ source: 'a', ok: true, items })]), Object.freeze({ a: items }));
});

test('integration hold: no repo file imports freshness.mjs', async () => {
  const { execSync } = await import('node:child_process');
  const hits = execSync("git grep -l 'freshness.mjs' -- . ':!scripts/lib/' || true", { encoding: 'utf8' }).trim();
  assert.equal(hits, '');
});
