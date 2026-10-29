import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { parseLisdIcs, IcsParseError, LISD_FEEDS, feedUrl } from './ics.mjs';

const DISTRICT = 'leanderisd.org_3grot6ac0ug4prua1smkvfsmu8';
const CAMPUS = 'leanderisd.org_u5tfmsd61ci4efq5s1bac16uvk';
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const WINDOW = { windowStart: Date.UTC(2026, 9, 1), windowEnd: Date.UTC(2027, 0, 1), maxOccurrencesPerEvent: 100 };
const synthetic = () => parseLisdIcs(fixture('synthetic-edge-cases.ics'), { feedId: DISTRICT, ...WINDOW });
const byUid = (records, uid) => records.filter((r) => r.uid === uid);
const chicago = (ms) => new Date(ms).toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: false });

test('1. occurrence identity is UID plus RECURRENCE-ID', () => {
  const { records } = synthetic();
  const single = byUid(records, 'utc@test')[0];
  assert.equal(single.occurrenceKey, 'utc@test');
  assert.equal(single.recurrenceId, null);
  const weekly = byUid(records, 'weekly@test');
  assert.deepEqual(weekly.map((r) => r.occurrenceKey), [
    'weekly@test#2026-10-28T21:00:00.000Z',
    'weekly@test#2026-11-04T22:00:00.000Z',
    'weekly@test#2026-11-11T22:00:00.000Z',
    'weekly@test#2026-11-18T22:00:00.000Z',
  ]);
  assert.equal(new Set(records.map((r) => r.id)).size, records.length);
});

test('2. TZID America/Chicago is correct across the DST change', () => {
  const { records } = synthetic();
  const before = byUid(records, 'dst-before@test')[0];
  const after = byUid(records, 'dst-after@test')[0];
  assert.equal(new Date(before.startsAt).toISOString(), '2026-10-31T23:00:00.000Z'); // CDT, UTC-5
  assert.equal(new Date(after.startsAt).toISOString(), '2026-11-03T00:00:00.000Z'); // CST, UTC-6
  assert.match(chicago(before.startsAt), /10\/31\/2026, 18:00/);
  assert.match(chicago(after.startsAt), /11\/2\/2026, 18:00/);
});

test('3. UTC events convert to the right Chicago wall time', () => {
  const r = byUid(synthetic().records, 'utc@test')[0];
  assert.match(chicago(r.startsAt), /11\/19\/2026, 18:15/);
  assert.equal(r.location, 'Linda Lippe Instructional Materials Center, 1775 W New Hope Drive');
});

test('4. all-day events keep their date and use an exclusive DTEND', () => {
  const { records } = synthetic();
  const multi = byUid(records, 'allday-multi@test')[0];
  assert.equal(multi.allDay, true);
  assert.equal(multi.startDate, '2026-11-23');
  assert.equal(multi.endDateExclusive, '2026-11-28');
  assert.match(chicago(multi.startsAt), /11\/23\/2026, 24:00|11\/23\/2026, 00:00/);
  assert.equal(multi.endsAt - multi.startsAt, 5 * 86_400_000);
  const oneDay = byUid(records, 'allday-noend@test')[0];
  assert.equal(oneDay.endDateExclusive, '2026-11-12');
  assert.equal(oneDay.endsAt - oneDay.startsAt, 86_400_000);
});

test('5. recurring events expand, and an override replaces its occurrence', () => {
  const weekly = byUid(synthetic().records, 'weekly@test');
  assert.equal(weekly.length, 4);
  const moved = weekly[1];
  assert.equal(moved.title, 'Weekly club (moved one hour)');
  assert.match(chicago(moved.startsAt), /11\/4\/2026, 17:00/);
});

test('5b. recurrence expansion is capped and the cap is reported', () => {
  const r = parseLisdIcs(fixture('synthetic-edge-cases.ics'), { feedId: DISTRICT, ...WINDOW, maxOccurrencesPerEvent: 2 });
  assert.equal(byUid(r.records, 'weekly@test').length, 2);
  assert.ok(r.errors.some((e) => /stopped at 2 occurrences/.test(e.error)));
});

test('6. cancelled events and cancelled occurrences are flagged, not dropped', () => {
  const { records } = synthetic();
  assert.equal(byUid(records, 'cancelled@test')[0].cancelled, true);
  const weekly = byUid(records, 'weekly@test');
  assert.deepEqual(weekly.map((r) => r.cancelled), [false, false, true, false]);
});

test('7. malformed input throws clearly or reports skipped events', () => {
  const opts = { feedId: DISTRICT, ...WINDOW };
  assert.throws(() => parseLisdIcs('', opts), IcsParseError);
  assert.throws(() => parseLisdIcs('<html>Not a calendar</html>', opts), /BEGIN:VCALENDAR/);
  const full = fixture('synthetic-edge-cases.ics');
  assert.throws(() => parseLisdIcs(full.slice(0, full.length / 2), opts), /truncated/);
  assert.throws(() => parseLisdIcs('BEGIN:VCALENDAR\r\nBROKEN LINE\r\nEND:VCALENDAR', opts), IcsParseError);
  const { errors, records } = synthetic();
  assert.ok(errors.some((e) => e.error === 'VEVENT is missing UID'));
  assert.ok(errors.some((e) => e.uid === 'no-dtstart@test' && /DTSTART/.test(e.error)));
  assert.ok(!records.some((r) => r.title === 'No UID' || r.title === 'No DTSTART'));
});

test('8. repeated runs give identical output', () => {
  assert.deepEqual(synthetic(), synthetic());
  const a = parseLisdIcs(fixture('lisd-campus.ics'), { feedId: CAMPUS, ...WINDOW });
  const b = parseLisdIcs(fixture('lisd-campus.ics'), { feedId: CAMPUS, ...WINDOW });
  assert.deepEqual(a, b);
});

test('9. every record carries source attribution', () => {
  const { records } = parseLisdIcs(fixture('lisd-district.ics'), { feedId: DISTRICT, ...WINDOW });
  assert.ok(records.length > 0);
  for (const r of records) {
    assert.deepEqual(r.source, {
      kind: 'lisd-calendar', feedId: DISTRICT, feedName: 'District',
      calendarName: 'LISD Website - District Calendar', feedUrl: feedUrl(DISTRICT),
    });
  }
  assert.equal(feedUrl(DISTRICT), 'https://calendar.google.com/calendar/ical/leanderisd.org_3grot6ac0ug4prua1smkvfsmu8%40group.calendar.google.com/public/basic.ics');
});

test('10. only the two official feeds are accepted, and options are validated', () => {
  assert.deepEqual(Object.keys(LISD_FEEDS), [DISTRICT, CAMPUS]);
  const ics = fixture('lisd-district.ics');
  assert.throws(() => parseLisdIcs(ics, { ...WINDOW, feedId: 'c_mldmu4p0efp4qnq68k560k3ddc' }), /feedId must be one of/);
  assert.throws(() => parseLisdIcs(ics, { ...WINDOW, feedId: 'constructor' }), /feedId must be one of/);
  assert.throws(() => parseLisdIcs(ics, { ...WINDOW, feedId: DISTRICT, windowEnd: WINDOW.windowStart }), RangeError);
  assert.throws(() => parseLisdIcs(ics, { ...WINDOW, feedId: DISTRICT, windowStart: 1e20 }), /windowStart/);
  assert.throws(() => parseLisdIcs(ics, { ...WINDOW, feedId: DISTRICT, maxOccurrencesPerEvent: 0 }), /maxOccurrencesPerEvent/);
});

test('real fixtures: District and All-Campus parse with no errors', () => {
  const d = parseLisdIcs(fixture('lisd-district.ics'), { feedId: DISTRICT, ...WINDOW });
  assert.equal(d.errors.length, 0);
  assert.deepEqual(d.records.map((r) => r.title), ['🗳️ Early Voting', '🗳️ Early Voting', '🗳️ Election Day']);
  const c = parseLisdIcs(fixture('lisd-campus.ics'), { feedId: CAMPUS, ...WINDOW });
  assert.equal(c.errors.length, 0);
  const board = c.records.find((r) => r.title === 'LISD Board Meeting');
  assert.match(chicago(board.startsAt), /11\/19\/2026, 18:15/);
});

test('real fixture: a Google RECURRENCE-ID override on an all-day series', () => {
  const c = parseLisdIcs(fixture('lisd-campus.ics'), {
    feedId: CAMPUS, windowStart: Date.UTC(2020, 11, 1), windowEnd: Date.UTC(2021, 0, 1), maxOccurrencesPerEvent: 100,
  });
  assert.deepEqual(c.records.map((r) => r.startDate), ['2020-12-21', '2020-12-22', '2020-12-23', '2020-12-24', '2020-12-25']);
  assert.equal(c.records[4].title, 'CHRISTMAS Student/Staff Holiday');
  assert.equal(c.records[4].occurrenceKey.endsWith('#2020-12-25'), true);
});

test('11. tests use no network', () => {
  const src = readFileSync(new URL('./ics.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\bfetch\(|node:https?|node:net/);
});

test('12. only scripts/scrape-events.mjs imports ics.mjs outside scripts/lib', () => {
  const hits = execSync("git grep -l 'lib/ics.mjs' -- . ':!scripts/lib/' || true", { encoding: 'utf8' }).trim();
  assert.equal(hits, 'scripts/scrape-events.mjs');
});
