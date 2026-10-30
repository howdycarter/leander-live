// Tests for source gates, status rows and submitted listings (source compliance).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SOURCE_GATES, sourceEnabled, statusRow, mergeStatus, signalGateRows } from './source-gates.mjs';
import { runGated, readStatus } from './source-status-file.mjs';
import { validateSubmittedListings, activeListings } from './submitted-listings.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const NOW = '2026-10-29T19:10:00-05:00';

test('every unsupported automatic source is off by default', () => {
  for (const id of Object.keys(SOURCE_GATES)) assert.equal(sourceEnabled(id, {}), false, id);
  assert.equal(sourceEnabled('governmentjobs-city-of-leander', { LEANDER_ENABLE_NEOGOV: 'true' }), false, 'only "1" enables');
  assert.equal(sourceEnabled('governmentjobs-city-of-leander', { LEANDER_ENABLE_NEOGOV: '1' }), true);
  assert.equal(sourceEnabled('not-a-source', { LEANDER_ENABLE_NEOGOV: '1' }), false);
});

test('the gated set covers NEOGOV, Google News, Firecrawl LISD and leandertx.gov', () => {
  const flags = new Set(Object.values(SOURCE_GATES).map((g) => g.flag));
  assert.deepEqual([...flags].sort(), ['LEANDER_ENABLE_FIRECRAWL', 'LEANDER_ENABLE_GOOGLE_NEWS', 'LEANDER_ENABLE_LEANDERTX', 'LEANDER_ENABLE_NEOGOV']);
});

test('a paused source fetches nothing, keeps history and claims no freshness', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'll-status-'));
  try {
    const statusPath = join(dir, 'status.json');
    writeFileSync(statusPath, JSON.stringify([{ id: 'google-news', lastSuccessAt: '2026-10-20T10:00:00Z' }]));
    let called = false;
    const previous = [{ id: 'old-1' }, { id: 'old-2' }];
    const { items, row } = await runGated('google-news', async () => { called = true; return []; }, previous,
      { env: {}, now: NOW, log: () => {}, statusPath });
    assert.equal(called, false);
    assert.deepEqual(items, previous);
    assert.equal(row.state, 'paused');
    assert.equal(row.reason, 'paused: rights pending');
    assert.equal(row.lastSuccessAt, '2026-10-20T10:00:00Z', 'previous success time kept, not refreshed');
    assert.equal(row.historical, true);
    assert.equal(row.recordsKept, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an enabled source records success, and a failure keeps previous records', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'll-status-'));
  try {
    const statusPath = join(dir, 'status.json');
    const env = { LEANDER_ENABLE_LEANDERTX: '1' };
    const ok = await runGated('leandertx-city-news', async () => [{ id: 'n1' }], [], { env, now: NOW, log: () => {}, statusPath });
    assert.equal(ok.row.state, 'ok');
    assert.equal(ok.row.lastSuccessAt, NOW);
    const bad = await runGated('leandertx-city-news', async () => { throw new Error('403'); }, [{ id: 'old' }], { env, now: NOW, log: () => {}, statusPath });
    assert.equal(bad.row.state, 'failed');
    assert.equal(bad.row.lastSuccessAt, null);
    assert.deepEqual(bad.items, [{ id: 'old' }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mergeStatus keeps rows from other scripts', () => {
  const merged = mergeStatus([{ id: 'a', state: 'ok' }, { id: 'b', state: 'ok' }], [statusRow('google-news', { enabled: false, now: NOW })]);
  assert.deepEqual(merged.map((r) => r.id), ['a', 'b', 'google-news']);
});

test('the committed status file lists every gated source as paused with no fake freshness', () => {
  const rows = readStatus(join(ROOT, 'src/data/source-status.json'));
  assert.deepEqual(rows.map((r) => r.id).sort(), Object.keys(SOURCE_GATES).sort());
  for (const r of rows) {
    assert.equal(r.state, 'paused', r.id);
    assert.equal(r.lastSuccessAt, null, r.id);
    assert.match(r.reason, /^paused: rights pending/);
  }
});

const listing = (over = {}) => ({
  id: 'sub-acme-barista', kind: 'job', title: 'Barista', organization: 'Acme Coffee',
  url: 'https://acme.example/jobs/barista', submittedAt: '2026-10-29T12:00:00-05:00',
  expiresAt: '2026-11-29T12:00:00-06:00', rights: 'submitter-owns-or-may-share', paid: true, ...over,
});

test('submitted listings: a valid job and event pass', () => {
  const ev = listing({ id: 'sub-fall-fest', kind: 'event', startsAt: '2026-11-07T10:00:00-06:00', endsAt: '2026-11-07T14:00:00-06:00', paid: false });
  assert.deepEqual(validateSubmittedListings([listing(), ev]), { ok: true, problems: [] });
});

test('submitted listings: bad fields are rejected with clear messages', () => {
  const { ok, problems } = validateSubmittedListings([
    listing({ id: 'Bad ID' }),
    listing({ id: 'sub-x1x', url: 'http://insecure.example' }),
    listing({ id: 'sub-x2x', rights: undefined }),
    listing({ id: 'sub-x3x', expiresAt: '2026-10-01T00:00:00Z' }),
    listing({ id: 'sub-x4x', kind: 'event' }),
    listing({ id: 'sub-x5x', paid: 'yes' }),
    listing({ id: 'sub-x5x' }),
  ]);
  assert.equal(ok, false);
  const text = problems.join('\n');
  assert.match(text, /\[0\] id must look like/);
  assert.match(text, /\[1\] url must be an https link/);
  assert.match(text, /\[2\] rights must be/);
  assert.match(text, /\[3\] expiresAt must be after submittedAt/);
  assert.match(text, /\[4\] events need startsAt/);
  assert.match(text, /\[5\] paid must be true or false/);
  assert.match(text, /\[6\] duplicate id sub-x5x/);
  assert.equal(validateSubmittedListings({}).ok, false);
});

test('submitted listings: expired listings drop out, and the committed file is valid', () => {
  const now = Date.parse('2026-12-01T00:00:00Z');
  assert.equal(activeListings([listing()], now).length, 0);
  const committed = JSON.parse(readFileSync(join(ROOT, 'src/data/submitted-listings.json'), 'utf8'));
  assert.equal(validateSubmittedListings(committed).ok, true);
});

test('history is preserved: committed data files are untouched by the gates', () => {
  for (const f of ['events.json', 'jobs.json', 'news.json', 'civic.json']) {
    const rows = JSON.parse(readFileSync(join(ROOT, 'src/data', f), 'utf8'));
    assert.ok(Array.isArray(rows) && rows.length > 0, f);
  }
});

test('paused signal sources report the history the queue still holds', () => {
  const queue = [
    { id: 'n1', source: 'google-news' }, { id: 'n2', source: 'google-news' },
    { id: 'b1', source: 'boardbook-agenda' }, { id: 'c1', source: 'chamber' },
  ];
  const now = '2026-10-30T00:00:00.000Z';
  const prevStatus = [{ id: 'google-news', lastSuccessAt: '2026-10-01T00:00:00.000Z' }];
  const [news, lisd] = signalGateRows(
    [{ id: 'google-news', enabled: false, ok: false }, { id: 'lisd-agenda-signals', enabled: false, ok: false }],
    queue, { now, prevStatus });
  assert.equal(news.state, 'paused');
  assert.equal(news.recordsKept, 2);
  assert.equal(news.historical, true);
  assert.equal(news.lastSuccessAt, '2026-10-01T00:00:00.000Z');
  assert.equal(lisd.recordsKept, 1);
  assert.equal(lisd.historical, true);
  const [empty] = signalGateRows([{ id: 'google-news', enabled: false, ok: false }], [], { now });
  assert.equal(empty.recordsKept, 0);
  assert.equal(empty.historical, false);
  const [failed] = signalGateRows([{ id: 'google-news', enabled: true, ok: false }], queue, { now });
  assert.equal(failed.historical, true);
});

test('submitted listings: impossible dates and non-string URLs are rejected', () => {
  const bad = [
    listing({ id: 'sub-d1x', submittedAt: '2026-02-30T12:00:00-06:00' }),
    listing({ id: 'sub-d2x', expiresAt: '2026-11-31T12:00:00-06:00' }),
    listing({ id: 'sub-d3x', kind: 'event', startsAt: '2026-11-07T24:30:00-06:00' }),
    listing({ id: 'sub-d4x', expiresAt: '2026-12-01T12:00:00+25:00' }),
    listing({ id: 'sub-u1x', url: ['https://acme.example/jobs/barista'] }),
    listing({ id: 'sub-u2x', url: { href: 'https://acme.example' } }),
  ];
  const { problems } = validateSubmittedListings(bad);
  const text = problems.join('\n');
  assert.match(text, /\[0\] submittedAt must be an ISO 8601 time/);
  assert.match(text, /\[1\] expiresAt must be an ISO 8601 time/);
  assert.match(text, /\[2\] events need startsAt/);
  assert.match(text, /\[3\] expiresAt must be an ISO 8601 time/);
  assert.match(text, /\[4\] url must be an https link/);
  assert.match(text, /\[5\] url must be an https link/);
  // Leap day in a leap year is real.
  assert.equal(validateSubmittedListings([listing({ submittedAt: '2028-02-29T12:00:00-06:00', expiresAt: '2028-03-29T12:00:00-05:00' })]).ok, true);
});
