// CHR-2014 follow-up: "This Weekend" overlap (exclusive end, America/Chicago)
// for EventsPage and both homepage consumers in conceptA.tsx. No network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { overlapsDateFilter } from '../../src/site/eventTime.ts';

const H = 3600_000;
const W = (ev, now) => overlapsDateFilter(ev, 'This Weekend', now);
// Central wall time -> UTC ms with an explicit offset (hours behind UTC).
const ct = (y, m, d, h, off) => Date.UTC(y, m - 1, d, h + off);

// Weekend of Fri Nov 6 – Sun Nov 8 2026 (CST, UTC-6). Now = Wed Nov 4 noon.
const NOW = ct(2026, 11, 4, 12, 6);
const FRI = ct(2026, 11, 6, 0, 6), MON = ct(2026, 11, 9, 0, 6);

test('ongoing: started before window, ends inside it', () => {
  assert.equal(W({ startsAt: ct(2026, 11, 3, 9, 6), endsAt: ct(2026, 11, 7, 12, 6) }, NOW), true);
});
test('ongoing: started before window, ends after it', () => {
  assert.equal(W({ startsAt: ct(2026, 11, 2, 9, 6), endsAt: ct(2026, 11, 12, 9, 6) }, NOW), true);
  assert.equal(W({ allDay: true, startDate: '2026-11-01', endDateExclusive: '2026-11-15', startsAt: ct(2026, 11, 1, 0, 5), endsAt: ct(2026, 11, 15, 0, 6) }, NOW), true);
});
test('ongoing: on Saturday, an event that started Thursday is still in this weekend', () => {
  assert.equal(W({ startsAt: ct(2026, 11, 5, 18, 6), endsAt: ct(2026, 11, 8, 18, 6) }, ct(2026, 11, 7, 10, 6)), true);
});
test('exclusive all-day DTEND: ending Friday is out, ending Saturday is in, Monday-only is out', () => {
  assert.equal(W({ allDay: true, startDate: '2026-11-05', endDateExclusive: '2026-11-06', startsAt: ct(2026, 11, 5, 0, 6), endsAt: FRI }, NOW), false);
  assert.equal(W({ allDay: true, startDate: '2026-11-05', endDateExclusive: '2026-11-07', startsAt: ct(2026, 11, 5, 0, 6), endsAt: ct(2026, 11, 7, 0, 6) }, NOW), true);
  assert.equal(W({ allDay: true, startDate: '2026-11-09', endDateExclusive: '2026-11-10', startsAt: MON, endsAt: ct(2026, 11, 10, 0, 6) }, NOW), false);
});
test('exact boundaries: end == window start excluded; start == window end excluded; edges inside included', () => {
  assert.equal(W({ startsAt: FRI - 3 * H, endsAt: FRI }, NOW), false);
  assert.equal(W({ startsAt: MON, endsAt: MON + 2 * H }, NOW), false);
  assert.equal(W({ startsAt: FRI - 3 * H, endsAt: FRI + 1 }, NOW), true);
  assert.equal(W({ startsAt: MON - 1, endsAt: MON + H }, NOW), true);
  assert.equal(W({ startsAt: FRI }, NOW), true);
});
test('DST fall-back (Sun Nov 1 2026, CDT->CST): weekend Oct 30 – Nov 1', () => {
  const now = ct(2026, 10, 28, 12, 5); // Wed, CDT
  const monCst = ct(2026, 11, 2, 0, 6);
  assert.equal(W({ startsAt: ct(2026, 11, 1, 23, 6), endsAt: monCst }, now), true); // Sun 11pm CST
  assert.equal(W({ startsAt: monCst, endsAt: monCst + H }, now), false);
  assert.equal(W({ startsAt: ct(2026, 10, 29, 20, 5), endsAt: ct(2026, 10, 30, 0, 5) }, now), false); // ends Fri 00:00 CDT
  assert.equal(W({ allDay: true, startDate: '2026-11-01', endDateExclusive: '2026-11-02', startsAt: ct(2026, 11, 1, 0, 5), endsAt: monCst }, now), true);
  assert.equal(W({ startsAt: ct(2026, 11, 1, 1, 6), endsAt: ct(2026, 11, 1, 3, 6) }, ct(2026, 11, 1, 1, 5)), true); // repeated 1am hour
});
test('DST spring-forward (Sun Mar 8 2026, CST->CDT): weekend Mar 6 – Mar 8', () => {
  const now = ct(2026, 3, 4, 12, 6); // Wed, CST
  const monCdt = ct(2026, 3, 9, 0, 5);
  assert.equal(W({ startsAt: ct(2026, 3, 8, 23, 5), endsAt: monCdt }, now), true);
  assert.equal(W({ startsAt: monCdt, endsAt: monCdt + H }, now), false);
  assert.equal(W({ startsAt: ct(2026, 3, 5, 20, 6), endsAt: ct(2026, 3, 6, 0, 6) }, now), false);
  assert.equal(W({ allDay: true, startDate: '2026-03-08', endDateExclusive: '2026-03-09', startsAt: ct(2026, 3, 8, 0, 6), endsAt: monCdt }, now), true);
});
test('homepage consumers in conceptA.tsx use the overlap helper, not start-time inRange', () => {
  const src = readFileSync(new URL('../../src/site/conceptA.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /inRange\(/);
  assert.equal((src.match(/overlapsDateFilter\(e, "This Weekend", now\.getTime\(\)\)/g) || []).length, 2);
});
