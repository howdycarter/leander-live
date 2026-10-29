// Merge step for src/data/events.json (CHR-1983 integration).
//
// This is the pure part of scripts/scrape-events.mjs. It takes the previous
// events, one result per source, and the civic meetings, and returns the new
// event list plus a report. It does no network or file I/O.
//
// City calendar and Chamber keep their existing rules exactly:
// last-good fallback on failure, backfill of missing future IDs, the
// title-plus-date dedupe against anchors, and dropping events that started
// more than six hours ago.
//
// LISD calendar records (sources "lisd-district" and "lisd-campus") follow
// stricter rules:
// - A failed fetch keeps that source's previous records (last good).
// - Cancelled occurrences are not published.
// - An event expires only after it ends (endsAt is exclusive).
// - Duplicates are found by occurrence identity only. Within LISD, that is
//   the record ID, which is derived from UID and RECURRENCE-ID. Against
//   civic.json, an event is dropped only when both are board meetings with
//   the same start time, building and room (see sameOccurrenceAsCivic).
//   Nothing is excluded by title alone.
// - Any parse error fails the whole LISD source (see lisdSourceResult).

import { dedupe, mergeSourceResults, normalizeText, partitionByFreshness } from './freshness.mjs';

export const LEGACY_SOURCES = Object.freeze(['city-calendar', 'chamber']);
export const LISD_SOURCES = Object.freeze(['lisd-district', 'lisd-campus']);
const KNOWN_SOURCES = new Set([...LEGACY_SOURCES, ...LISD_SOURCES]);
const SIX_HOURS = 6 * 3600 * 1000;

function normTitle(t) {
  return String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function legacyKey(ev) {
  return `${normTitle(ev.title)}|${new Date(ev.startsAt).toISOString().slice(0, 10)}`;
}

function venueParts(location) {
  return String(location ?? '').replace(/\\,/g, ',').split(',').map((p) => normalizeText(p)).filter(Boolean);
}

/** The venue name: the part of a location before the first comma, normalized. */
function venueName(location) {
  return venueParts(location)[0] ?? '';
}

const ROOM_PART = /\b(room|rooms|rm|suite|chambers?|boardroom|board room|auditorium|library|cafeteria|gym|hall [a-z0-9])\b/;

/** The room-specific parts of a location (for example "rooms b1001 01 and b1001 02"), or '' when none is given. */
function venueRoom(location) {
  return venueParts(location).slice(1).filter((p) => ROOM_PART.test(p)).join(' | ');
}

const BOARD_MEETING = /\bboard\b.*\b(meeting|workshop|session|trustees|hearing)\b|\bboard of trustees\b/i;

/** True when a title names a board meeting (regular, special, workshop, and so on). */
export function isBoardMeeting(title) {
  return BOARD_MEETING.test(String(title ?? ''));
}

/**
 * True when a civic meeting is the same occurrence as an LISD event. All of
 * these must hold:
 * - both titles are board meetings,
 * - the start times are identical,
 * - the building name (before the first comma) matches, and
 * - both locations name the same room.
 * A building match alone is not enough, because unrelated events can run at
 * the same time in different rooms of one building. When either side gives
 * no room, the events are kept apart, even if that leaves a duplicate.
 */
export function sameOccurrenceAsCivic(ev, meeting) {
  if (ev.startsAt !== meeting.startsAt) return false;
  if (!isBoardMeeting(ev.title) || !isBoardMeeting(meeting.title)) return false;
  const a = venueName(ev.venue);
  if (a === '' || a !== venueName(meeting.location)) return false;
  const roomA = venueRoom(ev.venue);
  return roomA !== '' && roomA === venueRoom(meeting.location);
}

/**
 * Turns one LISD parse into a source result. Any parse error (a bad VEVENT,
 * a failed expansion, or the occurrence cap) fails the whole source, so the
 * merge keeps that source's complete previous records instead of publishing
 * a partial list.
 * @param {string} source
 * @param {{ records: object[], errors: object[] }} parsed
 * @param {(record: object) => object} toEvent
 */
export function lisdSourceResult(source, parsed, toEvent) {
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    return {
      source, ok: false,
      error: `${parsed.errors.length} parse error(s), first: ${first.error}${first.uid ? ` (${first.uid})` : ''}`,
    };
  }
  return { source, ok: true, items: parsed.records.map(toEvent) };
}

/**
 * @param {object} input
 * @param {object[]} input.prev     Previous events.json contents.
 * @param {object[]} input.results  One { source, ok, items, error } per source fetched this run.
 * @param {object[]} input.civic    Current civic.json meetings.
 * @param {number}   input.now      Run time in ms.
 * @returns {{ events: object[], report: object }}
 */
export function mergeEventSources({ prev, results, civic = [], now }) {
  if (!Array.isArray(prev)) throw new TypeError('prev must be an array');
  if (!Array.isArray(results)) throw new TypeError('results must be an array');
  if (!Array.isArray(civic)) throw new TypeError('civic must be an array');
  if (typeof now !== 'number' || !Number.isFinite(now)) throw new TypeError('now must be a finite number');
  for (const r of results) {
    if (!r || !KNOWN_SOURCES.has(r.source)) throw new TypeError(`unknown source id: ${r && r.source}`);
  }

  const anchors = prev.filter((e) => typeof e.id === 'string' && e.id.startsWith('anchor-'));
  const prevBySource = Object.create(null);
  for (const e of prev) {
    if (typeof e.id === 'string' && e.id.startsWith('anchor-')) continue;
    if (typeof e.source !== 'string') continue;
    (prevBySource[e.source] ||= []).push(e);
  }

  // mergeSourceResults validates unique, nonempty source IDs before merging.
  const merged = mergeSourceResults(results, prevBySource);
  const itemsFor = (source) => {
    const r = results.find((x) => x.source === source);
    if (!r) return [];
    return mergeSourceResults([r], prevBySource).items.map((e) => ({ ...e }));
  };

  const report = {
    sources: Object.fromEntries([...merged.used].map(([s, how]) => [s, { used: how, count: 0 }])),
    failed: merged.failed,
    legacyBackfilled: 0,
    lisd: { cancelledSkipped: 0, expired: 0, civicDuplicates: 0, duplicateIds: 0 },
  };

  // Legacy sources: existing behavior, unchanged.
  const legacy = Object.fromEntries(LEGACY_SOURCES.map((s) => [s, itemsFor(s)]));
  const freshIds = new Set(Object.values(legacy).flat().map((e) => e.id));
  for (const src of LEGACY_SOURCES) {
    if (!results.some((r) => r.source === src)) continue;
    for (const old of prevBySource[src] || []) {
      if (!freshIds.has(old.id) && old.startsAt && old.startsAt >= now - SIX_HOURS) {
        legacy[src].push({ ...old });
        freshIds.add(old.id);
        report.legacyBackfilled++;
      }
    }
  }
  const seen = new Set(anchors.map(legacyKey));
  const fresh = [];
  for (const ev of [...legacy['city-calendar'], ...legacy.chamber]) {
    if (!ev.title || !ev.startsAt) continue;
    if (ev.startsAt < now - SIX_HOURS) continue;
    const key = legacyKey(ev);
    if (seen.has(key)) continue;
    seen.add(key);
    if (ev.endsAt && ev.endsAt <= ev.startsAt) delete ev.endsAt;
    fresh.push(ev);
  }

  // LISD sources.
  let lisd = LISD_SOURCES.flatMap((s) => itemsFor(s));
  const live = [];
  for (const ev of lisd) {
    if (ev.cancelled) report.lisd.cancelledSkipped++;
    else live.push(ev);
  }
  const { fresh: current, expired } = partitionByFreshness(live, {
    now, timeOf: (e) => e.endsAt, mode: 'past', graceMs: 0, missing: 'expire',
  });
  report.lisd.expired = expired.length;
  const notCivic = current.filter((ev) => {
    const dup = civic.some((m) => sameOccurrenceAsCivic(ev, m));
    if (dup) report.lisd.civicDuplicates++;
    return !dup;
  });
  const deduped = dedupe(notCivic, { keyOf: (e) => e.id });
  report.lisd.duplicateIds = deduped.duplicates.length;
  lisd = deduped.items;

  // Same stable sort as before (start time only), so existing order is unchanged.
  const events = [...anchors, ...fresh, ...lisd].sort((a, b) => a.startsAt - b.startsAt);
  for (const ev of events) {
    if (report.sources[ev.source]) report.sources[ev.source].count++;
  }
  return { events, report };
}

/** Map a parsed LISD ICS record (scripts/lib/ics.mjs) to a LiveEvent. */
export function lisdRecordToEvent(record, sourceId, category) {
  return {
    id: record.id,
    title: record.title,
    description: record.description || `${record.source.calendarName}. See the Leander ISD calendar for details.`,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    allDay: record.allDay,
    venue: record.location || 'Leander ISD',
    url: 'https://www.leanderisd.org/calendar/',
    category,
    source: sourceId,
    sourceUrl: record.source.feedUrl,
    occurrenceKey: record.occurrenceKey,
    cancelled: record.cancelled,
  };
}
