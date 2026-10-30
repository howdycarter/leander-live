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

test('5b. recurrence expansion is capped inside the window and the cap is reported', () => {
  const r = parseLisdIcs(fixture('synthetic-edge-cases.ics'), { feedId: DISTRICT, ...WINDOW, maxOccurrencesPerEvent: 1 });
  // One expanded slot plus the two overrides (moved and cancelled), which are evaluated on their own.
  assert.equal(byUid(r.records, 'weekly@test').length, 3);
  assert.ok(r.errors.some((e) => /stopped at 1 occurrences inside the window/.test(e.error)));
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

test('12. integration hold: nothing outside scripts/lib imports ics.mjs', () => {
  const hits = execSync("git grep -l 'ics.mjs' -- . ':!scripts/lib/' || true", { encoding: 'utf8' }).trim();
  assert.equal(hits, '');
});

// Review regressions (PR #11): old series, overrides moved into the window, cap inside the window.
const regression = (opts = {}) => parseLisdIcs(fixture('regression-review.ics'), { feedId: DISTRICT, ...WINDOW, maxOccurrencesPerEvent: 400, ...opts });

test('R1. an old daily series still reaches the current window (cap counts only in-window slots)', () => {
  const r = regression();
  const daily = byUid(r.records, 'old-daily@test');
  // Oct 1 through Dec 31, 2026: 92 days. Before the fix the 400 cap ran out in 2016.
  assert.equal(daily.length, 92);
  assert.match(chicago(daily[0].startsAt), /10\/1\/2026, 07:00/);
  assert.match(chicago(daily.at(-1).startsAt), /12\/31\/2026, 07:00/);
  assert.deepEqual(r.errors, []);
});

test('R2. a future slot moved into the window by RECURRENCE-ID is kept; a slot moved out is dropped', () => {
  const r = regression();
  const weekly = byUid(r.records, 'moved-in@test');
  const titles = weekly.map((e) => e.title);
  assert.ok(titles.includes('Weekly meeting (January slot moved into December)'));
  assert.ok(!titles.some((t) => /moved out to February/.test(t)));
  // Oct 7 to Dec 30 has 13 weekly slots; Oct 14 moved out, Dec 30 is the original slot plus the moved-in override.
  const dec30 = weekly.filter((e) => /12\/30\/2026, 17:00/.test(chicago(e.startsAt)));
  assert.equal(dec30.length, 2);
  assert.equal(new Set(weekly.map((e) => e.occurrenceKey)).size, weekly.length);
  assert.equal(weekly.length, 13);
});

test('R3. hitting the cap inside the window is reported as an error, not silently dropped', () => {
  const r = regression({ maxOccurrencesPerEvent: 10 });
  assert.equal(byUid(r.records, 'old-daily@test').length, 10);
  assert.ok(r.errors.some((e) => e.uid === 'old-daily@test' && /inside the window/.test(e.error)));
});

// Review round 2 (PR #11): reject what cannot be read safely, include RDATE-only DTSTART.
const cal = (...lines) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...lines, 'END:VCALENDAR'].join('\r\n');
const parseInline = (...lines) => parseLisdIcs(cal(...lines), { feedId: DISTRICT, ...WINDOW });

test('R4. RECURRENCE-ID;RANGE=THISANDFUTURE is rejected, not half-applied', () => {
  const r = parseInline(
    'BEGIN:VEVENT', 'UID:range@test', 'DTSTART:20261101T150000Z', 'DTEND:20261101T160000Z', 'RRULE:FREQ=WEEKLY;COUNT=4', 'SUMMARY:Weekly', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:range@test', 'RECURRENCE-ID;RANGE=THISANDFUTURE:20261108T150000Z', 'DTSTART:20261108T170000Z', 'DTEND:20261108T180000Z', 'SUMMARY:Weekly later', 'END:VEVENT',
  );
  assert.ok(r.errors.some((e) => /RANGE=THISANDFUTURE is not supported/.test(e.error)));
});

test('R5. an RDATE-only series includes DTSTART, unless EXDATE removes it', () => {
  const r = parseInline('BEGIN:VEVENT', 'UID:rdate@test', 'DTSTART:20261101T150000Z', 'DTEND:20261101T160000Z', 'RDATE:20261105T150000Z,20261110T150000Z', 'SUMMARY:Sessions', 'END:VEVENT');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(byUid(r.records, 'rdate@test').map((e) => new Date(e.startsAt).toISOString()),
    ['2026-11-01T15:00:00.000Z', '2026-11-05T15:00:00.000Z', '2026-11-10T15:00:00.000Z']);
  const x = parseInline('BEGIN:VEVENT', 'UID:rdate@test', 'DTSTART:20261101T150000Z', 'DTEND:20261101T160000Z', 'RDATE:20261105T150000Z', 'EXDATE:20261101T150000Z', 'SUMMARY:Sessions', 'END:VEVENT');
  assert.deepEqual(byUid(x.records, 'rdate@test').map((e) => new Date(e.startsAt).toISOString()), ['2026-11-05T15:00:00.000Z']);
  // RDATE that repeats DTSTART does not create a duplicate.
  const d = parseInline('BEGIN:VEVENT', 'UID:rdate@test', 'DTSTART:20261101T150000Z', 'DTEND:20261101T160000Z', 'RDATE:20261101T150000Z,20261105T150000Z', 'SUMMARY:Sessions', 'END:VEVENT');
  assert.equal(byUid(d.records, 'rdate@test').length, 2);
  assert.deepEqual(d.errors, []);
});

test('R6. conflicting overrides for one RECURRENCE-ID are rejected and cannot revive a cancelled instance', () => {
  const r = parseInline(
    'BEGIN:VEVENT', 'UID:dup@test', 'DTSTART:20261101T150000Z', 'DTEND:20261101T160000Z', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:Weekly', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:dup@test', 'RECURRENCE-ID:20261108T150000Z', 'DTSTART:20261108T150000Z', 'DTEND:20261108T160000Z', 'STATUS:CANCELLED', 'SUMMARY:Weekly', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:dup@test', 'RECURRENCE-ID:20261108T150000Z', 'DTSTART:20261108T150000Z', 'DTEND:20261108T160000Z', 'STATUS:CONFIRMED', 'SUMMARY:Weekly revived', 'END:VEVENT',
  );
  assert.ok(r.errors.some((e) => /ambiguous duplicate override/.test(e.error)));
  assert.ok(!byUid(r.records, 'dup@test').some((e) => e.title === 'Weekly revived'));
});

test('R7. an unknown TZID is rejected instead of becoming Chicago', () => {
  const r = parseInline('BEGIN:VEVENT', 'UID:tz@test', 'DTSTART;TZID=Mars/Olympus:20261101T150000', 'DTEND;TZID=Mars/Olympus:20261101T160000', 'SUMMARY:Off world', 'END:VEVENT');
  assert.ok(r.errors.some((e) => /unknown TZID Mars\/Olympus/.test(e.error)));
  assert.equal(byUid(r.records, 'tz@test').length, 0);
});

test('R8. impossible dates and backwards ranges are rejected', () => {
  const feb30 = parseInline('BEGIN:VEVENT', 'UID:feb@test', 'DTSTART;VALUE=DATE:20270230', 'SUMMARY:Bad date', 'END:VEVENT');
  assert.ok(feb30.errors.some((e) => /invalid date 2027-02-30 on DTSTART/.test(e.error)));
  assert.equal(byUid(feb30.records, 'feb@test').length, 0);
  const back = parseInline('BEGIN:VEVENT', 'UID:back@test', 'DTSTART:20261101T150000Z', 'DTEND:20261101T140000Z', 'SUMMARY:Backwards', 'END:VEVENT');
  assert.ok(back.errors.some((e) => /DTEND is before DTSTART/.test(e.error)));
  assert.equal(byUid(back.records, 'back@test').length, 0);
  // A zero-length event is allowed.
  const zero = parseInline('BEGIN:VEVENT', 'UID:zero@test', 'DTSTART:20261101T150000Z', 'DTEND:20261101T150000Z', 'SUMMARY:Instant', 'END:VEVENT');
  assert.deepEqual(zero.errors, []);
});

test('R9. RDATE;VALUE=PERIOD still fails safely with an error', () => {
  const r = parseInline('BEGIN:VEVENT', 'UID:period@test', 'DTSTART:20261101T150000Z', 'DTEND:20261101T160000Z', 'RDATE;VALUE=PERIOD:20261105T150000Z/20261105T170000Z', 'SUMMARY:Period', 'END:VEVENT');
  assert.ok(r.errors.length > 0);
});

// Review round 3 (PR #11): per-feed zones and invalid durations.
const VTZ_DENVER = ['BEGIN:VTIMEZONE', 'TZID:America/Denver', 'BEGIN:STANDARD', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0700', 'TZNAME:MST', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0700', 'TZOFFSETTO:-0600', 'TZNAME:MDT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT', 'END:VTIMEZONE'];
const denverEvent = (uid) => ['BEGIN:VEVENT', `UID:${uid}`, 'DTSTART;TZID=America/Denver:20261110T090000', 'DTEND;TZID=America/Denver:20261110T100000', 'SUMMARY:Mountain time', 'END:VEVENT'];

test('R10. a TZID defined by one feed is not accepted in the next feed', () => {
  const first = parseInline(...VTZ_DENVER, ...denverEvent('a@test'));
  assert.deepEqual(first.errors, []);
  assert.equal(new Date(byUid(first.records, 'a@test')[0].startsAt).toISOString(), '2026-11-10T16:00:00.000Z');
  // Same zone used without a VTIMEZONE in a second feed parsed right after.
  const second = parseInline(...denverEvent('b@test'));
  assert.ok(second.errors.some((e) => /unknown TZID America\/Denver/.test(e.error)));
  assert.equal(byUid(second.records, 'b@test').length, 0);
  // Order does not matter: parsing the defining feed again still works.
  assert.deepEqual(parseInline(...VTZ_DENVER, ...denverEvent('c@test')).errors, []);
});

test('R11. a negative or malformed DURATION is rejected, not clamped', () => {
  for (const d of ['-PT1H', 'P', 'PT', 'banana']) {
    const r = parseInline('BEGIN:VEVENT', 'UID:dur@test', 'DTSTART:20261101T150000Z', `DURATION:${d}`, 'SUMMARY:Bad', 'END:VEVENT');
    assert.ok(r.errors.some((e) => /invalid DURATION/.test(e.error)), d);
    assert.equal(byUid(r.records, 'dur@test').length, 0, d);
  }
  const ok = parseInline('BEGIN:VEVENT', 'UID:dur@test', 'DTSTART:20261101T150000Z', 'DURATION:PT1H30M', 'SUMMARY:Good', 'END:VEVENT');
  assert.deepEqual(ok.errors, []);
  assert.equal(byUid(ok.records, 'dur@test')[0].endsAt - byUid(ok.records, 'dur@test')[0].startsAt, 90 * 60_000);
});
