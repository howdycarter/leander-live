// Unit tests for src/site/eventTime.ts (CHR-2011). Node 22 runs the .ts file directly (type stripping).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eventDateLabel, eventTimeLabel, allDaySpan, isStillListed, icsAllDayDates, allDayIsoDates,
} from '../../src/site/eventTime.ts';

const chicagoMidnight = (y, m, d) => {
  // Midnight in Chicago for the given date, found by checking both possible offsets.
  for (const off of [5, 6]) {
    const ms = Date.UTC(y, m - 1, d, off);
    const h = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hourCycle: 'h23' }).format(ms);
    if (Number(h) === 0) return ms;
  }
  throw new Error('no midnight');
};

test('exclusive end: an all-day event ending Nov 3 (exclusive) shows Nov 2 only', () => {
  const ev = { allDay: true, startDate: '2026-11-02', endDateExclusive: '2026-11-03', startsAt: chicagoMidnight(2026, 11, 2), endsAt: chicagoMidnight(2026, 11, 3) };
  assert.equal(eventDateLabel(ev), 'Mon, Nov 2');
  assert.equal(eventTimeLabel(ev), 'All day');
  assert.deepEqual(allDaySpan(ev).last, { year: 2026, month: 11, day: 2 });
});

test('multi-day all-day range shows first and last day, never a time', () => {
  const ev = { allDay: true, startDate: '2026-11-23', endDateExclusive: '2026-11-28', startsAt: chicagoMidnight(2026, 11, 23) };
  assert.equal(eventDateLabel(ev), 'Mon, Nov 23 – Fri, Nov 27');
  assert.equal(eventDateLabel(ev, { withYear: true }), 'Mon, Nov 23, 2026 – Fri, Nov 27, 2026');
  assert.doesNotMatch(`${eventDateLabel(ev)} ${eventTimeLabel(ev)}`, /12:00|AM|PM/);
});

test('all-day labels never show 12:00 AM, even across the November DST change', () => {
  // Nov 1, 2026 is the day Central time falls back.
  for (const [s, e] of [['2026-10-31', '2026-11-01'], ['2026-11-01', '2026-11-02'], ['2026-11-01', '2026-11-03']]) {
    const [y, m, d] = s.split('-').map(Number);
    const ev = { allDay: true, startDate: s, endDateExclusive: e, startsAt: chicagoMidnight(y, m, d) };
    assert.equal(eventTimeLabel(ev), 'All day');
    assert.doesNotMatch(eventDateLabel(ev), /\d:\d\d/);
  }
  const fallBack = { allDay: true, startDate: '2026-11-01', endDateExclusive: '2026-11-02', startsAt: chicagoMidnight(2026, 11, 1) };
  assert.equal(eventDateLabel(fallBack), 'Sun, Nov 1');
});

test('March DST boundary: all-day dates stay on the right day', () => {
  // Mar 14, 2027 is the day Central time springs forward.
  const ev = { allDay: true, startDate: '2027-03-13', endDateExclusive: '2027-03-16', startsAt: chicagoMidnight(2027, 3, 13) };
  assert.equal(eventDateLabel(ev), 'Sat, Mar 13 – Mon, Mar 15');
});

test('missing date fields fall back to the Central dates of startsAt and endsAt', () => {
  const ev = { allDay: true, startsAt: chicagoMidnight(2027, 3, 13), endsAt: chicagoMidnight(2027, 3, 15) };
  assert.equal(eventDateLabel(ev), 'Sat, Mar 13 – Sun, Mar 14');
  const noEnd = { allDay: true, startsAt: chicagoMidnight(2026, 11, 1) };
  assert.equal(eventDateLabel(noEnd), 'Sun, Nov 1');
});

test('timed events use Central time on both sides of the DST changes', () => {
  // 6:00 PM CDT on Oct 31 and 6:00 PM CST on Nov 2, 2026.
  const before = { startsAt: Date.UTC(2026, 9, 31, 23), endsAt: Date.UTC(2026, 10, 1, 0) };
  const after = { startsAt: Date.UTC(2026, 10, 3, 0), endsAt: Date.UTC(2026, 10, 3, 2) };
  assert.equal(eventDateLabel(before), 'Sat, Oct 31');
  assert.equal(eventTimeLabel(before), '6:00–7:00 PM');
  assert.equal(eventDateLabel(after), 'Mon, Nov 2');
  assert.equal(eventTimeLabel(after), '6:00–8:00 PM');
  // 9:30 AM CST on Mar 13 and 9:30 AM CDT on Mar 15, 2027.
  assert.equal(eventTimeLabel({ startsAt: Date.UTC(2027, 2, 13, 15, 30) }), '9:30 AM');
  assert.equal(eventTimeLabel({ startsAt: Date.UTC(2027, 2, 15, 14, 30) }), '9:30 AM');
});

test('timed versus all-day: allDay false keeps the clock time', () => {
  const ev = { allDay: false, startsAt: Date.UTC(2026, 10, 20, 0, 15), startDate: '2026-11-19' };
  assert.equal(eventTimeLabel(ev), '6:15 PM');
  assert.equal(allDaySpan(ev), null);
});

test('all-day events stay listed through their last day, then drop', () => {
  const ev = { allDay: true, startDate: '2026-11-23', endDateExclusive: '2026-11-28', startsAt: chicagoMidnight(2026, 11, 23) };
  assert.equal(isStillListed(ev, Date.UTC(2026, 10, 27, 23)), true); // Nov 27, 5 PM CST
  assert.equal(isStillListed(ev, Date.UTC(2026, 10, 28, 7)), false); // Nov 28, 1 AM CST
  // Timed events keep the existing 24-hour rule.
  assert.equal(isStillListed({ startsAt: 1000 }, 1000 + 86_400_000), true);
  assert.equal(isStillListed({ startsAt: 1000 }, 1001 + 86_400_000), false);
});

test('.ics and schema.org dates for all-day events', () => {
  const ev = { allDay: true, startDate: '2026-11-23', endDateExclusive: '2026-11-28', startsAt: 0 };
  assert.deepEqual(icsAllDayDates(ev), { start: '20261123', endExclusive: '20261128' });
  assert.deepEqual(allDayIsoDates(ev), { start: '2026-11-23', end: '2026-11-27' });
  assert.equal(icsAllDayDates({ startsAt: 0 }), null);
});

test('invalid date strings are ignored, not trusted', () => {
  const ev = { allDay: true, startDate: '2026-02-30', endDateExclusive: 'soon', startsAt: chicagoMidnight(2026, 3, 1) };
  assert.equal(eventDateLabel(ev), 'Sun, Mar 1');
});

// Today and This Month filters: date-span overlap in America/Chicago.
import { overlapsDateFilter } from '../../src/site/eventTime.ts';
const CT = (y, m, d, h = 12) => chicagoMidnight(y, m, d) + h * 3_600_000;

test('Today: a multi-day all-day event that started earlier still matches', () => {
  const ev = { allDay: true, startDate: '2026-11-23', endDateExclusive: '2026-11-28', startsAt: chicagoMidnight(2026, 11, 23) };
  assert.equal(overlapsDateFilter(ev, 'Today', CT(2026, 11, 25)), true);
  assert.equal(overlapsDateFilter(ev, 'Today', CT(2026, 11, 27)), true);
});

test('Today: the exclusive end day does not match', () => {
  const ev = { allDay: true, startDate: '2026-11-02', endDateExclusive: '2026-11-03', startsAt: chicagoMidnight(2026, 11, 2) };
  assert.equal(overlapsDateFilter(ev, 'Today', CT(2026, 11, 2)), true);
  assert.equal(overlapsDateFilter(ev, 'Today', CT(2026, 11, 3, 0.5)), false);
  assert.equal(overlapsDateFilter(ev, 'Today', CT(2026, 11, 1, 23)), false);
});

test('Today: timed events use Central days, including late evening UTC rollover', () => {
  // 8:00 PM CST on Nov 2 is Nov 3 in UTC.
  const ev = { startsAt: Date.UTC(2026, 10, 3, 2), endsAt: Date.UTC(2026, 10, 3, 3) };
  assert.equal(overlapsDateFilter(ev, 'Today', CT(2026, 11, 2, 9)), true);
  assert.equal(overlapsDateFilter(ev, 'Today', CT(2026, 11, 3, 9)), false);
  // An event ending exactly at midnight does not spill into the next day.
  const toMidnight = { startsAt: CT(2026, 11, 2, 22), endsAt: chicagoMidnight(2026, 11, 3) };
  assert.equal(overlapsDateFilter(toMidnight, 'Today', CT(2026, 11, 3, 9)), false);
  // An overnight event touches both days.
  const overnight = { startsAt: CT(2026, 11, 2, 22), endsAt: CT(2026, 11, 3, 2) };
  assert.equal(overlapsDateFilter(overnight, 'Today', CT(2026, 11, 3, 9)), true);
});

test('This Month: runs from today through the last Central day of the month', () => {
  const now = CT(2026, 11, 10);
  const day = (y, m, d) => ({ allDay: true, startDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, startsAt: chicagoMidnight(y, m, d) });
  assert.equal(overlapsDateFilter(day(2026, 11, 30), 'This Month', now), true);
  assert.equal(overlapsDateFilter(day(2026, 12, 1), 'This Month', now), false);
  assert.equal(overlapsDateFilter(day(2026, 11, 9), 'This Month', now), false);
  // A span crossing into next month still matches this month.
  const cross = { allDay: true, startDate: '2026-11-28', endDateExclusive: '2026-12-03', startsAt: chicagoMidnight(2026, 11, 28) };
  assert.equal(overlapsDateFilter(cross, 'This Month', now), true);
  // A span that started last month and is still running matches.
  const running = { allDay: true, startDate: '2026-10-30', endDateExclusive: '2026-11-12', startsAt: chicagoMidnight(2026, 10, 30) };
  assert.equal(overlapsDateFilter(running, 'This Month', now), true);
  // 11:30 PM CST on Nov 30 is Dec 1 in UTC, but it is still November in Leander.
  assert.equal(overlapsDateFilter({ startsAt: CT(2026, 11, 30, 23.5) }, 'This Month', now), true);
  // February in a non-leap year ends on the 28th.
  assert.equal(overlapsDateFilter(day(2027, 2, 28), 'This Month', CT(2027, 2, 1)), true);
  assert.equal(overlapsDateFilter(day(2027, 3, 1), 'This Month', CT(2027, 2, 1)), false);
});
