import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeEventSources, lisdRecordToEvent, lisdSourceResult, sameOccurrenceAsCivic, isBoardMeeting } from './events-merge.mjs';
import { parseLisdIcs } from './ics.mjs';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 29, 21, 0); // Oct 29, 2026, 4:00 PM CDT
const readJson = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const fixture = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const DISTRICT = 'leanderisd.org_3grot6ac0ug4prua1smkvfsmu8';
const CAMPUS = 'leanderisd.org_u5tfmsd61ci4efq5s1bac16uvk';

// The pre-integration algorithm from scrape-events.mjs at 7cb67fc, kept here as a reference.
function legacyMerge(prev, city, chamber, cityOk, chamberOk, now) {
  const normTitle = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const anchors = prev.filter((e) => typeof e.id === 'string' && e.id.startsWith('anchor-'));
  const prevBySource = new Map();
  for (const e of prev) {
    if (e.id && e.id.startsWith('anchor-')) continue;
    if (!prevBySource.has(e.source)) prevBySource.set(e.source, []);
    prevBySource.get(e.source).push(e);
  }
  city = cityOk ? city.map((e) => ({ ...e })) : (prevBySource.get('city-calendar') || []).map((e) => ({ ...e }));
  chamber = chamberOk ? chamber.map((e) => ({ ...e })) : (prevBySource.get('chamber') || []).map((e) => ({ ...e }));
  const freshIds = new Set([...city, ...chamber].map((e) => e.id));
  for (const src of ['city-calendar', 'chamber']) {
    for (const old of prevBySource.get(src) || []) {
      if (!freshIds.has(old.id) && old.startsAt && old.startsAt >= now - 6 * HOUR) {
        (src === 'city-calendar' ? city : chamber).push({ ...old });
        freshIds.add(old.id);
      }
    }
  }
  const seen = new Set(anchors.map((a) => `${normTitle(a.title)}|${new Date(a.startsAt).toISOString().slice(0, 10)}`));
  const fresh = [];
  for (const ev of [...city, ...chamber]) {
    if (!ev.title || !ev.startsAt) continue;
    if (ev.startsAt < now - 6 * HOUR) continue;
    const key = `${normTitle(ev.title)}|${new Date(ev.startsAt).toISOString().slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (ev.endsAt && ev.endsAt <= ev.startsAt) delete ev.endsAt;
    fresh.push(ev);
  }
  return [...anchors, ...fresh].sort((a, b) => a.startsAt - b.startsAt);
}

const current = readJson('../../src/data/events.json');
const civic = readJson('../../src/data/civic.json');
const prevOf = (s) => current.filter((e) => e.source === s);

function lisdResults(now = NOW) {
  const opts = { windowStart: now - DAY, windowEnd: now + 180 * DAY, maxOccurrencesPerEvent: 400 };
  return [
    ['lisd-district', DISTRICT, 'lisd-district.ics'],
    ['lisd-campus', CAMPUS, 'lisd-campus.ics'],
  ].map(([source, feedId, file]) => lisdSourceResult(
    source, parseLisdIcs(fixture(file), { feedId, ...opts }), (r) => lisdRecordToEvent(r, source, 'Community'),
  ));
}

test('existing sources: output matches the pre-integration algorithm exactly', () => {
  for (const [cityOk, chamberOk] of [[true, true], [false, true], [true, false], [false, false]]) {
    const city = prevOf('city-calendar').slice(0, 10);
    const chamber = prevOf('chamber').slice(3);
    const results = [
      cityOk ? { source: 'city-calendar', ok: true, items: city } : { source: 'city-calendar', ok: false, error: 'HTTP 503' },
      chamberOk ? { source: 'chamber', ok: true, items: chamber } : { source: 'chamber', ok: false, error: 'timeout' },
    ];
    const { events } = mergeEventSources({ prev: current, results, civic, now: NOW });
    assert.deepEqual(events, legacyMerge(current, city, chamber, cityOk, chamberOk, NOW), `cityOk=${cityOk} chamberOk=${chamberOk}`);
  }
});

test('deterministic source IDs: unknown or duplicate sources are rejected', () => {
  assert.throws(() => mergeEventSources({ prev: [], results: [{ source: 'lisd', ok: true, items: [] }], now: NOW }), /unknown source id/);
  assert.throws(() => mergeEventSources({
    prev: [], now: NOW,
    results: [{ source: 'chamber', ok: false }, { source: 'chamber', ok: true, items: [] }],
  }), /duplicate source id/);
});

test('LISD: occurrences are added with attribution, all-day flags and Chicago times', () => {
  const { events, report } = mergeEventSources({ prev: current, results: lisdResults(), civic, now: NOW });
  const lisd = events.filter((e) => e.source.startsWith('lisd-'));
  assert.ok(lisd.length > 0);
  for (const e of lisd) {
    assert.match(e.sourceUrl, /^https:\/\/calendar\.google\.com\/calendar\/ical\/leanderisd\.org_/);
    assert.ok(e.occurrenceKey);
  }
  const election = lisd.find((e) => e.title.includes('Election Day'));
  assert.equal(election.allDay, true);
  assert.equal(new Date(election.startsAt).toISOString(), '2026-11-03T06:00:00.000Z'); // midnight CST
  assert.equal(report.sources['lisd-district'].used, 'fresh');
});

test('LISD: board meetings are deduped against civic only by board type, start, building and room', () => {
  const at = Date.UTC(2026, 10, 20, 0, 15);
  const meeting = { title: 'Board of Trustees Regular Meeting', startsAt: at, location: 'Linda Lippe Instructional Materials Center, Board Room, 1775 W New Hope Drive' };
  const ev = { title: 'LISD Board Meeting', startsAt: at, venue: 'Linda Lippe Instructional Materials Center\\, Board Room' };
  assert.equal(sameOccurrenceAsCivic(ev, meeting), true);
  assert.equal(sameOccurrenceAsCivic({ ...ev, startsAt: at + HOUR }, meeting), false);
  assert.equal(sameOccurrenceAsCivic({ ...ev, venue: 'Vista Ridge High School, Board Room' }, meeting), false);
  assert.equal(sameOccurrenceAsCivic({ ...ev, venue: '' }, meeting), false);
  // Building alone is not enough: no room on one side keeps them apart.
  assert.equal(sameOccurrenceAsCivic({ ...ev, venue: 'Linda Lippe Instructional Materials Center' }, meeting), false);
  assert.equal(isBoardMeeting('LISD Special Board Meeting - Board Workshop'), true);
  assert.equal(isBoardMeeting('Board of Trustees — Special Meeting - Board Workshop'), true);
  assert.equal(isBoardMeeting('Robotics showcase'), false);

  const results = lisdResults();
  const before = results.flatMap((r) => r.items).filter((e) => /board meeting/i.test(e.title));
  const withCivic = mergeEventSources({ prev: [], results, civic, now: NOW });
  const withoutCivic = mergeEventSources({ prev: [], results: lisdResults(), civic: [], now: NOW });
  const boardIn = (r) => r.events.filter((e) => /board meeting/i.test(e.title)).length;
  assert.equal(boardIn(withoutCivic), before.length, 'no civic data: every board meeting stays');
  // The Oct 29 workshop is in both feeds, but civic.json gives a street address and
  // LISD gives rooms, so the room-specific rule keeps both. A visible duplicate is
  // preferred over dropping an unrelated event.
  assert.equal(withCivic.report.lisd.civicDuplicates, 0);
  assert.ok(withCivic.events.some((e) => e.title === 'LISD Special Board Meeting - Board Workshop'));
});

test('regression: simultaneous unrelated events in different rooms of one building are not conflated', () => {
  const at = Date.UTC(2026, 10, 20, 0, 0);
  const civicRows = [
    { id: 'c1', title: 'Board of Trustees Regular Meeting', startsAt: at, location: 'Linda Lippe Instructional Materials Center, Board Room' },
  ];
  const mk = (id, title, venue) => ({ id, title, startsAt: at, endsAt: at + HOUR, venue, source: 'lisd-district', category: 'Community', description: '' });
  const results = [
    { source: 'lisd-district', ok: true, items: [
      mk('lisd-a', 'Robotics showcase', 'Linda Lippe Instructional Materials Center, Rooms B1001.01 and B1001.02'),
      mk('lisd-b', 'LISD Board Meeting', 'Linda Lippe Instructional Materials Center, Rooms B1001.01 and B1001.02'),
      mk('lisd-c', 'Parent workshop', 'Linda Lippe Instructional Materials Center, Board Room'),
    ] },
    { source: 'lisd-campus', ok: true, items: [] },
  ];
  const { events, report } = mergeEventSources({ prev: [], results, civic: civicRows, now: at - DAY });
  assert.deepEqual(events.filter((e) => e.source === 'lisd-district').map((e) => e.id).sort(), ['lisd-a', 'lisd-b', 'lisd-c']);
  assert.equal(report.lisd.civicDuplicates, 0);
  // The same board meeting in the same room is the one case that is deduped.
  results[0].items.push(mk('lisd-d', 'LISD Board Meeting', 'Linda Lippe Instructional Materials Center\\, Board Room'));
  const again = mergeEventSources({ prev: [], results, civic: civicRows, now: at - DAY });
  assert.equal(again.report.lisd.civicDuplicates, 1);
  assert.ok(!again.events.some((e) => e.id === 'lisd-d'));
});

test('regression: any LISD parse error fails the source atomically and keeps the complete prior data', () => {
  const good = lisdResults();
  const first = mergeEventSources({ prev: [], results: good, civic: [], now: NOW }).events;
  const priorDistrict = first.filter((e) => e.source === 'lisd-district');
  assert.ok(priorDistrict.length > 1);
  const partial = { records: [priorDistrict[0]].map(() => ({})), errors: [{ uid: 'x@test', error: 'VEVENT is missing DTSTART' }] };
  const failed = lisdSourceResult('lisd-district', partial, (r) => r);
  assert.equal(failed.ok, false);
  assert.match(failed.error, /1 parse error\(s\), first: VEVENT is missing DTSTART \(x@test\)/);
  const { events, report } = mergeEventSources({ prev: first, results: [failed, good[1]], civic: [], now: NOW });
  assert.equal(report.sources['lisd-district'].used, 'previous');
  assert.deepEqual(events.filter((e) => e.source === 'lisd-district').map((e) => e.id), priorDistrict.map((e) => e.id));
  // A clean parse still succeeds.
  assert.equal(lisdSourceResult('lisd-district', { records: [], errors: [] }, (r) => r).ok, true);
});

test('LISD: an event expires only after it ends', () => {
  const ev = (id, startsAt, endsAt) => ({ id, title: id, startsAt, endsAt, venue: 'x', source: 'lisd-district' });
  const items = [
    ev('ended', NOW - 3 * DAY, NOW - 1),
    ev('multi-day-running', NOW - 2 * DAY, NOW + DAY),
    ev('ends-now', NOW - HOUR, NOW),
    ev('future', NOW + DAY, NOW + DAY + HOUR),
  ];
  const { events, report } = mergeEventSources({ prev: [], results: [{ source: 'lisd-district', ok: true, items }], now: NOW });
  assert.deepEqual(events.map((e) => e.id), ['multi-day-running', 'ends-now', 'future']);
  assert.equal(report.lisd.expired, 1);
});

test('LISD: cancelled occurrences are not published', () => {
  const items = [{ id: 'a', title: 'A', startsAt: NOW + DAY, endsAt: NOW + DAY + HOUR, venue: 'x', source: 'lisd-campus', cancelled: true }];
  const { events, report } = mergeEventSources({ prev: [], results: [{ source: 'lisd-campus', ok: true, items }], now: NOW });
  assert.equal(events.length, 0);
  assert.equal(report.lisd.cancelledSkipped, 1);
});

test('LISD: a temporary failure keeps the last good records', () => {
  const first = mergeEventSources({ prev: current, results: lisdResults(), civic, now: NOW }).events;
  const failed = mergeEventSources({
    prev: first, civic, now: NOW,
    results: [{ source: 'lisd-district', ok: false, error: 'HTTP 500' }, { source: 'lisd-campus', ok: 'false', items: [] }],
  });
  const lisdIds = (evs) => evs.filter((e) => e.source.startsWith('lisd-')).map((e) => e.id).sort();
  assert.deepEqual(lisdIds(failed.events), lisdIds(first));
  assert.equal(failed.report.sources['lisd-district'].used, 'previous');
  assert.equal(failed.report.failed.length, 2);
});

test('repeated runs are idempotent', () => {
  const a = mergeEventSources({ prev: current, results: lisdResults(), civic, now: NOW });
  const b = mergeEventSources({ prev: a.events, results: lisdResults(), civic, now: NOW });
  assert.deepEqual(b.events, a.events);
});

test('LISD occurrence IDs are unique; duplicates are reported', () => {
  const item = { id: 'x', title: 'X', startsAt: NOW + DAY, endsAt: NOW + DAY + HOUR, venue: 'v', source: 'lisd-district' };
  const r = mergeEventSources({ prev: [], now: NOW, results: [
    { source: 'lisd-district', ok: true, items: [item] },
    { source: 'lisd-campus', ok: true, items: [{ ...item, source: 'lisd-campus' }] },
  ] });
  assert.equal(r.events.length, 1);
  assert.equal(r.report.lisd.duplicateIds, 1);
});
