// Parser for the official public Leander ISD Google Calendar ICS feeds (CHR-2008).
//
// Integration hold: nothing in the refresh pipeline imports this module yet.
// Wiring it in is a separate, reviewed step.
//
// The module is pure. It does no network or file I/O and never reads the clock.
// The caller passes the feed text, the feed ID and an explicit time window.
//
// Parsing uses ical.js (Mozilla, MPL-2.0, no runtime dependencies), so
// RRULE expansion, RECURRENCE-ID overrides and VTIMEZONE handling come from a
// maintained library rather than hand-written code.

import ICAL from 'ical.js';
import { createHash } from 'node:crypto';

export const TIMEZONE = 'America/Chicago';

/** The only feeds this parser accepts. */
export const LISD_FEEDS = Object.freeze({
  'leanderisd.org_3grot6ac0ug4prua1smkvfsmu8': 'District',
  'leanderisd.org_u5tfmsd61ci4efq5s1bac16uvk': 'All-Campus',
});

export function feedUrl(feedId) {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(feedId + '@group.calendar.google.com')}/public/basic.ics`;
}

export class IcsParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IcsParseError';
  }
}

// America/Chicago rules, used when a feed omits its VTIMEZONE block.
const CHICAGO_VTIMEZONE = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//leander-live//tz//EN',
  'BEGIN:VTIMEZONE', 'TZID:America/Chicago',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0500', 'TZNAME:CDT',
  'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0600', 'TZNAME:CST',
  'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
  'END:VTIMEZONE', 'END:VCALENDAR',
].join('\r\n');

let chicagoZone;
function getChicagoZone() {
  if (!chicagoZone) {
    const comp = new ICAL.Component(ICAL.parse(CHICAGO_VTIMEZONE));
    chicagoZone = new ICAL.Timezone(comp.getFirstSubcomponent('vtimezone'));
  }
  return chicagoZone;
}

function finiteMs(name, v) {
  if (typeof v !== 'number' || !Number.isFinite(v) || Number.isNaN(new Date(v).getTime())) {
    throw new TypeError(`${name} must be a valid millisecond timestamp`);
  }
}

/** Convert an ICAL.Time to epoch milliseconds. Date-only values become Chicago midnight. */
function toMs(time) {
  if (time.isDate) {
    const t = ICAL.Time.fromData(
      { year: time.year, month: time.month, day: time.day, hour: 0, minute: 0, second: 0, isDate: false },
      getChicagoZone(),
    );
    return t.toUnixTime() * 1000;
  }
  if (time.zone === ICAL.Timezone.localTimezone) {
    // A floating time has no zone. Read it as Chicago wall time.
    const t = time.clone();
    t.zone = getChicagoZone();
    return t.toUnixTime() * 1000;
  }
  return time.toUnixTime() * 1000;
}

function dateString(time) {
  const p = (n) => String(n).padStart(2, '0');
  return `${time.year}-${p(time.month)}-${p(time.day)}`;
}

/** Safety bound on slots skipped before the window (about 270 years of a daily series). */
const MAX_PRE_WINDOW_SLOTS = 100_000;

/** End of one occurrence: the master's duration added to the slot start. */
function endFor(slot, event) {
  const end = slot.clone();
  end.addDuration(event.duration);
  return end;
}

function recurrenceKey(time) {
  // Normalize RECURRENCE-ID to a stable string regardless of how it was written.
  return time.isDate ? dateString(time) : new Date(toMs(time)).toISOString();
}

function text(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function buildRecord({ uid, recurrenceId, item, start, end, source }) {
  const occurrenceKey = recurrenceId ? `${uid}#${recurrenceId}` : uid;
  const allDay = start.isDate;
  const startsAt = toMs(start);
  let endsAt;
  if (end) endsAt = toMs(end);
  if (allDay) {
    // DTEND on a DATE value is exclusive. With no DTEND, the event lasts one day.
    const endDate = end ? end.clone() : start.clone();
    if (!end) endDate.adjust(1, 0, 0, 0);
    endsAt = toMs(endDate);
  }
  if (endsAt === undefined || endsAt < startsAt) endsAt = startsAt;
  const status = text(item.component.getFirstPropertyValue('status')).toUpperCase() || 'CONFIRMED';
  return {
    id: 'lisd-' + createHash('sha256').update(`${source.feedId}|${occurrenceKey}`).digest('hex').slice(0, 20),
    occurrenceKey,
    uid,
    recurrenceId: recurrenceId || null,
    title: text(item.summary),
    description: text(item.description),
    location: text(item.location),
    startsAt,
    endsAt,
    allDay,
    startDate: allDay ? dateString(start) : null,
    endDateExclusive: allDay ? new Date(endsAt).toLocaleDateString('en-CA', { timeZone: TIMEZONE }) : null,
    timezone: TIMEZONE,
    status,
    cancelled: status === 'CANCELLED',
    source,
  };
}

/**
 * Parse one LISD ICS feed into occurrence records.
 *
 * Options:
 *  - feedId: one of LISD_FEEDS (required).
 *  - windowStart, windowEnd: ms timestamps (required). Only occurrences that
 *    overlap this window are returned, which bounds recurring expansion.
 *  - maxOccurrencesPerEvent: cap on occurrences of one recurring event that reach the window (required).
 *    Slots before the window are skipped and not counted. Hitting the cap is reported in errors.
 *
 * Returns { calendarName, records, errors }. Records are sorted by start time,
 * then ID, so repeated runs on the same input give identical output.
 * Cancelled events are returned with cancelled: true, not dropped.
 * Throws IcsParseError when the input as a whole is unusable.
 */
export function parseLisdIcs(icsText, { feedId, windowStart, windowEnd, maxOccurrencesPerEvent } = {}) {
  if (typeof feedId !== 'string' || !Object.hasOwn(LISD_FEEDS, feedId)) {
    throw new TypeError(`feedId must be one of: ${Object.keys(LISD_FEEDS).join(', ')}`);
  }
  finiteMs('windowStart', windowStart);
  finiteMs('windowEnd', windowEnd);
  if (windowEnd <= windowStart) throw new RangeError('windowEnd must be after windowStart');
  if (!Number.isInteger(maxOccurrencesPerEvent) || maxOccurrencesPerEvent < 1) {
    throw new TypeError('maxOccurrencesPerEvent must be a positive integer');
  }
  if (typeof icsText !== 'string' || icsText.trim() === '') throw new IcsParseError('ICS input is empty');
  const trimmed = icsText.trim();
  if (!trimmed.startsWith('BEGIN:VCALENDAR')) throw new IcsParseError('ICS input does not start with BEGIN:VCALENDAR');
  if (!trimmed.endsWith('END:VCALENDAR')) throw new IcsParseError('ICS input is truncated (no END:VCALENDAR)');

  let root;
  try {
    root = new ICAL.Component(ICAL.parse(icsText));
  } catch (err) {
    throw new IcsParseError(`ICS input could not be parsed: ${err.message}`);
  }
  if (root.name !== 'vcalendar') throw new IcsParseError('ICS root is not VCALENDAR');

  // Register the feed's own timezone definitions, with Chicago as a fallback.
  if (!ICAL.TimezoneService.has(TIMEZONE)) ICAL.TimezoneService.register(getChicagoZone());
  for (const vtz of root.getAllSubcomponents('vtimezone')) {
    const tz = new ICAL.Timezone(vtz);
    if (tz.tzid && !ICAL.TimezoneService.has(tz.tzid)) ICAL.TimezoneService.register(tz);
  }

  const calendarName = text(root.getFirstPropertyValue('x-wr-calname'));
  const source = Object.freeze({
    kind: 'lisd-calendar',
    feedId,
    feedName: LISD_FEEDS[feedId],
    calendarName,
    feedUrl: feedUrl(feedId),
  });

  const errors = [];
  const masters = new Map();
  const overrides = [];
  root.getAllSubcomponents('vevent').forEach((vevent, index) => {
    const uid = text(vevent.getFirstPropertyValue('uid'));
    if (!uid) { errors.push({ index, error: 'VEVENT is missing UID' }); return; }
    if (!vevent.getFirstPropertyValue('dtstart')) { errors.push({ index, uid, error: 'VEVENT is missing DTSTART' }); return; }
    if (vevent.hasProperty('recurrence-id')) overrides.push({ uid, vevent });
    else if (masters.has(uid)) errors.push({ index, uid, error: 'duplicate UID without RECURRENCE-ID' });
    else masters.set(uid, new ICAL.Event(vevent));
  });

  const records = [];
  const inWindow = (r) => r.endsAt > windowStart && r.startsAt < windowEnd;

  // Overrides are grouped by UID and RECURRENCE-ID. Each one is judged by its
  // own (moved) start and end, never by its original slot, so an override that
  // moves a later occurrence into the window is kept, and one that moves an
  // in-window occurrence out of it is dropped.
  const overridesByUid = new Map();
  for (const o of overrides) {
    let ev;
    try {
      ev = new ICAL.Event(o.vevent);
    } catch (err) {
      errors.push({ uid: o.uid, error: `could not read override: ${err.message}` });
      continue;
    }
    if (!overridesByUid.has(o.uid)) overridesByUid.set(o.uid, new Map());
    overridesByUid.get(o.uid).set(recurrenceKey(ev.recurrenceId), ev);
  }

  for (const [uid, event] of masters) {
    try {
      if (!event.isRecurring()) {
        const r = buildRecord({ uid, recurrenceId: null, item: event, start: event.startDate, end: event.endDate, source });
        if (inWindow(r)) records.push(r);
        continue;
      }
      const moved = overridesByUid.get(uid) ?? new Map();
      const durationMs = toMs(event.endDate) - toMs(event.startDate);
      const it = event.iterator();
      let next;
      let skipped = 0;
      let count = 0;
      while ((next = it.next())) {
        const slotStart = toMs(next);
        if (slotStart >= windowEnd) break;
        // Fast-forward through slots that end before the window. These do not
        // count against the cap, but a separate bound stops runaway series.
        if (slotStart + durationMs <= windowStart) {
          if (++skipped > MAX_PRE_WINDOW_SLOTS) {
            errors.push({ uid, error: `recurrence skipped more than ${MAX_PRE_WINDOW_SLOTS} slots before the window` });
            break;
          }
          continue;
        }
        if (moved.has(recurrenceKey(next))) continue; // handled with the overrides below
        // The cap counts only occurrences that reach the window. Hitting it is
        // an error, so the caller can keep its last good data rather than
        // publish a silently shortened list.
        if (++count > maxOccurrencesPerEvent) {
          errors.push({ uid, error: `recurrence expansion stopped at ${maxOccurrencesPerEvent} occurrences inside the window` });
          break;
        }
        const r = buildRecord({ uid, recurrenceId: recurrenceKey(next), item: event, start: next, end: endFor(next, event), source });
        if (inWindow(r)) records.push(r);
      }
    } catch (err) {
      errors.push({ uid, error: `could not expand event: ${err.message}` });
    }
  }

  for (const [uid, byKey] of overridesByUid) {
    for (const ev of byKey.values()) {
      try {
        const r = buildRecord({
          uid, recurrenceId: recurrenceKey(ev.recurrenceId), item: ev,
          start: ev.startDate, end: ev.endDate, source,
        });
        if (inWindow(r)) records.push(r);
      } catch (err) {
        errors.push({ uid, error: `could not read override: ${err.message}` });
      }
    }
  }

  // One record per occurrence. A later duplicate is reported, not merged.
  const seen = new Set();
  const unique = [];
  for (const r of records) {
    if (seen.has(r.occurrenceKey)) { errors.push({ uid: r.uid, error: `duplicate occurrence ${r.occurrenceKey}` }); continue; }
    seen.add(r.occurrenceKey);
    unique.push(r);
  }
  unique.sort((a, b) => a.startsAt - b.startsAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { calendarName, records: unique, errors };
}
