/**
 * Dry run for the events merge (CHR-1983). Reads the committed events.json,
 * civic.json and the saved LISD fixtures, runs the merge, and prints counts.
 * It never fetches anything and never writes any file.
 *
 * Usage: node scripts/events-dry-run.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseLisdIcs } from "./lib/ics.mjs";
import { mergeEventSources, lisdRecordToEvent, lisdSourceResult } from "./lib/events-merge.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const prev = JSON.parse(read("src/data/events.json"));
const civic = JSON.parse(read("src/data/civic.json"));
const now = Number(process.env.DRY_RUN_NOW || Date.now());
const opts = { windowStart: now - 86_400_000, windowEnd: now + 180 * 86_400_000, maxOccurrencesPerEvent: 400 };

const legacy = ["city-calendar", "chamber"].map((source) => ({
  source, ok: true, items: prev.filter((e) => e.source === source),
}));
const lisd = [
  ["lisd-district", "leanderisd.org_3grot6ac0ug4prua1smkvfsmu8", "lisd-district.ics"],
  ["lisd-campus", "leanderisd.org_u5tfmsd61ci4efq5s1bac16uvk", "lisd-campus.ics"],
].map(([source, feedId, file]) => lisdSourceResult(
  source,
  parseLisdIcs(read(`scripts/lib/fixtures/${file}`), { feedId, ...opts }),
  (r) => lisdRecordToEvent(r, source, "Community"),
));

const count = (evs) => evs.reduce((m, e) => ((m[e.source] = (m[e.source] || 0) + 1), m), {});
const off = mergeEventSources({ prev, results: legacy, civic, now });
const on = mergeEventSources({ prev, results: [...legacy, ...lisd], civic, now });
const offIds = new Set(off.events.map((e) => e.id));

console.log(JSON.stringify({
  now: new Date(now).toISOString(),
  committed: { total: prev.length, bySource: count(prev) },
  lisdDisabled: { total: off.events.length, bySource: count(off.events) },
  lisdEnabledWithFixtures: { total: on.events.length, bySource: count(on.events), lisd: on.report.lisd },
  addedWhenEnabled: on.events.filter((e) => !offIds.has(e.id)).map((e) => ({
    id: e.id, source: e.source, title: e.title,
    startsAt: new Date(e.startsAt).toLocaleString("en-US", { timeZone: "America/Chicago" }), allDay: !!e.allDay,
  })),
}, null, 2));
