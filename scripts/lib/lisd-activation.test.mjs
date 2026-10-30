// Regression tests for the fix-before-LISD-activation items. Each test fails on
// d2c6b3c and passes with the fix. No network; LISD flag stays off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeEventSources } from './events-merge.mjs';
import { deriveBlurb } from './blurb.mjs';
import { overlapsDateFilter } from '../../src/site/eventTime.ts';

const H = 3600_000, D = 24 * H;
const NOW = Date.UTC(2026, 10, 4, 18); // Wed Nov 4 2026, 12:00 CST

test('(a) blurb: HTML is normalized before truncation', () => {
  const ev = { description: '<p>Join&nbsp;us at the <a href="https://x.test/very/long/link/that/would/eat/the/budget">Leander library</a> for a hands&#8209;on robotics workshop &amp; open lab for families, with snacks provided and parking nearby on Main Street.</p>' };
  deriveBlurb(ev);
  assert.ok(ev.blurb);
  assert.doesNotMatch(ev.blurb, /<|>|&nbsp;|&amp;|&#\d+;|href/);
  assert.match(ev.blurb, /^Join us at the Leander library for a hands.on robotics workshop & open lab/);
  assert.ok(ev.blurb.length <= 141);
});

test('(a) blurb: existing blurbs and boilerplate are untouched', () => {
  const kept = { blurb: 'Keep me', description: 'x'.repeat(200) };
  deriveBlurb(kept);
  assert.equal(kept.blurb, 'Keep me');
  const boiler = { description: 'Thing — see the City of Leander calendar for details. More filler text here to pass sixty.' };
  deriveBlurb(boiler);
  assert.equal(boiler.blurb, undefined);
});

// Chicago midnight helpers (CST in Nov 2026 after Nov 1: UTC-6).
const cst = (m, d, h = 0) => Date.UTC(2026, m - 1, d, h + 6);

test('(b) weekend: all-day event ending Friday (exclusive) is not in the weekend', () => {
  const ev = { allDay: true, startDate: '2026-11-05', endDateExclusive: '2026-11-06', startsAt: cst(11, 5), endsAt: cst(11, 6) };
  assert.equal(overlapsDateFilter(ev, 'This Weekend', NOW), false);
});

test('(b) weekend: timed event ending exactly Friday 00:00 is not in the weekend', () => {
  const ev = { startsAt: cst(11, 5, 20), endsAt: cst(11, 6, 0) };
  assert.equal(overlapsDateFilter(ev, 'This Weekend', NOW), false);
});

test('(b) weekend: multi-day event starting Thursday and running into Saturday is in the weekend', () => {
  const ev = { allDay: true, startDate: '2026-11-05', endDateExclusive: '2026-11-08', startsAt: cst(11, 5), endsAt: cst(11, 8) };
  assert.equal(overlapsDateFilter(ev, 'This Weekend', NOW), true);
  const mon = { allDay: true, startDate: '2026-11-09', endDateExclusive: '2026-11-10', startsAt: cst(11, 9), endsAt: cst(11, 10) };
  assert.equal(overlapsDateFilter(mon, 'This Weekend', NOW), false);
  const sunNight = { startsAt: cst(11, 8, 23), endsAt: cst(11, 9, 1) };
  assert.equal(overlapsDateFilter(sunNight, 'This Weekend', NOW), true);
});

const lisdEv = (source, id, occurrenceKey, extra = {}) => ({
  id, source, occurrenceKey, title: 'Early release', startsAt: NOW + 2 * D, endsAt: NOW + 2 * D + H, venue: 'Leander ISD', ...extra,
});

test('(c) cross-feed: the same UID/RECURRENCE-ID in district and campus feeds is published once', () => {
  const a = lisdEv('lisd-district', 'lisd-aaa', 'uid-1@google.com#20261106');
  const b = lisdEv('lisd-campus', 'lisd-bbb', 'uid-1@google.com#20261106');
  const c = lisdEv('lisd-campus', 'lisd-ccc', 'uid-2@google.com');
  const { events, report } = mergeEventSources({
    prev: [], now: NOW, civic: [],
    results: [{ source: 'lisd-district', ok: true, items: [a] }, { source: 'lisd-campus', ok: true, items: [b, c] }],
  });
  const lisd = events.filter((e) => e.source.startsWith('lisd-'));
  assert.deepEqual(lisd.map((e) => e.id).sort(), ['lisd-aaa', 'lisd-ccc']);
  assert.equal(report.lisd.duplicateIds, 1);
});

test('(c) cross-feed: different occurrences of one UID are kept', () => {
  const a = lisdEv('lisd-district', 'lisd-a1', 'uid-1@google.com#20261106');
  const b = lisdEv('lisd-campus', 'lisd-b2', 'uid-1@google.com#20261113');
  const { events } = mergeEventSources({
    prev: [], now: NOW, civic: [],
    results: [{ source: 'lisd-district', ok: true, items: [a] }, { source: 'lisd-campus', ok: true, items: [b] }],
  });
  assert.equal(events.length, 2);
});

test('(d) flag disabled: previous LISD records are retained and still expire by end time', () => {
  const live = lisdEv('lisd-district', 'lisd-live', 'uid-9');
  const old = lisdEv('lisd-campus', 'lisd-old', 'uid-8', { startsAt: NOW - 3 * D, endsAt: NOW - 2 * D });
  const cancelled = lisdEv('lisd-campus', 'lisd-cx', 'uid-7', { cancelled: true });
  const { events, report } = mergeEventSources({ prev: [live, old, cancelled], results: [], civic: [], now: NOW });
  assert.deepEqual(events.map((e) => e.id), ['lisd-live']);
  assert.equal(report.sources['lisd-district'].used, 'retained');
});

test('(a) blurb: entity-encoded anchor never leaves a tag fragment', () => {
  const ev = { description: '&lt;a href="https://example.test/x"&gt;Leander library&lt;/a&gt; hosts a hands-on robotics workshop and open lab for families this weekend.' };
  deriveBlurb(ev);
  assert.ok(ev.blurb);
  assert.doesNotMatch(ev.blurb, /[<>]|href/);
  assert.match(ev.blurb, /^Leander library hosts a hands-on robotics workshop/);
});

test('(a) blurb: double-encoded markup is fully normalized', () => {
  const ev = { description: '&amp;lt;p&amp;gt;&amp;lt;a href=&amp;quot;https://example.test&amp;quot;&amp;gt;Story time&amp;lt;/a&amp;gt; at the Leander Public Library for toddlers and caregivers, every Tuesday morning.&amp;lt;/p&amp;gt;' };
  deriveBlurb(ev);
  assert.ok(ev.blurb);
  assert.doesNotMatch(ev.blurb, /[<>]|&[a-z#0-9]+;|href/i);
  assert.match(ev.blurb, /^Story time at the Leander Public Library/);
});

// Cancellation precedence in cross-feed dedupe (canonical key only, fixtures only).
const merge = (district, campus, extra = {}) => mergeEventSources({
  prev: [], now: NOW, civic: [],
  results: [{ source: 'lisd-district', ok: true, items: district }, { source: 'lisd-campus', ok: true, items: campus }],
  ...extra,
});
const lisdIds = (events) => events.filter((e) => e.source.startsWith('lisd-')).map((e) => e.id).sort();

test('(e) cancellation wins: district-cancelled + campus-confirmed, same UID/RECURRENCE-ID -> nothing published', () => {
  const { events, report } = merge(
    [lisdEv('lisd-district', 'lisd-d1', 'uid-9@google.com#20261106', { cancelled: true })],
    [lisdEv('lisd-campus', 'lisd-c1', 'uid-9@google.com#20261106')],
  );
  assert.deepEqual(lisdIds(events), []);
  assert.equal(report.lisd.duplicateIds, 1);
});

test('(e) cancellation wins: same UID with no RECURRENCE-ID on either copy -> nothing published', () => {
  const { events } = merge(
    [lisdEv('lisd-district', 'lisd-d2', 'uid-8@google.com', { cancelled: true })],
    [lisdEv('lisd-campus', 'lisd-c2', 'uid-8@google.com')],
  );
  assert.deepEqual(lisdIds(events), []);
});

test('(e) a cancelled occurrence does not suppress a different RECURRENCE-ID of the same UID', () => {
  const { events } = merge(
    [lisdEv('lisd-district', 'lisd-d3', 'uid-7@google.com#20261106', { cancelled: true })],
    [lisdEv('lisd-campus', 'lisd-c3', 'uid-7@google.com#20261113'), lisdEv('lisd-campus', 'lisd-c4', 'uid-7@google.com')],
  );
  assert.deepEqual(lisdIds(events), ['lisd-c3', 'lisd-c4']);
});

test('(e) no UID/occurrenceKey -> no cross-feed suppression, even with identical title and time', () => {
  const { events } = merge(
    [lisdEv('lisd-district', 'lisd-d5', undefined, { cancelled: true })],
    [lisdEv('lisd-campus', 'lisd-c5', undefined), lisdEv('lisd-campus', 'lisd-c6', '')],
  );
  assert.deepEqual(lisdIds(events), ['lisd-c5', 'lisd-c6']);
});

test('(e) non-LISD events are unaffected by LISD cancellations', () => {
  const city = { id: 'city-1', source: 'city-calendar', title: 'Early release', startsAt: NOW + 2 * D, endsAt: NOW + 2 * D + H, venue: 'Leander ISD' };
  const { events } = merge(
    [lisdEv('lisd-district', 'lisd-d7', 'uid-6@google.com', { cancelled: true })],
    [],
    { prev: [city], results: [
      { source: 'city-calendar', ok: true, items: [city] },
      { source: 'lisd-district', ok: true, items: [lisdEv('lisd-district', 'lisd-d7', 'uid-6@google.com', { cancelled: true })] },
      { source: 'lisd-campus', ok: true, items: [] },
    ] },
  );
  assert.deepEqual(events.filter((e) => !e.source.startsWith('lisd-')).map((e) => e.id), ['city-1']);
  assert.deepEqual(lisdIds(events), []);
});
