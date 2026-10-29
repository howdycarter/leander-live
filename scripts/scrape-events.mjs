/**
 * Scrape Leander events from:
 *   1. City of Leander CivicPlus calendar  (https://www.leandertx.gov/Calendar.aspx)
 *   2. Leander Chamber calendar            (https://leander.chamberspace.net/calendar)
 * and merge with the hand-curated anchor events already in src/data/events.json.
 *
 * Output: src/data/events.json (array of LiveEvent, sorted ascending by startsAt).
 *
 * Robustness: idempotent; a failed source logs WARN: to stderr, keeps the
 * previous records for that source, and the script still exits 0.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseLisdIcs, feedUrl } from "./lib/ics.mjs";
import { mergeEventSources, lisdRecordToEvent, lisdSourceResult } from "./lib/events-merge.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as cheerio from "cheerio";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/data/events.json");
const UA = "LeanderLive-Scraper/1.0 (community-events-bot; contact chris@howdycarter.com)";
const SLEEP_MS = 300;
const MAX_DETAIL_PAGES = 60;
const LISD_SLEEP_MS = 2000;
const LISD_WINDOW_DAYS = 180;
const LISD_FEED_SOURCES = [
  ["lisd-district", "leanderisd.org_3grot6ac0ug4prua1smkvfsmu8"],
  ["lisd-campus", "leanderisd.org_u5tfmsd61ci4efq5s1bac16uvk"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** America/Chicago wall-clock -> epoch ms (handles CDT/CST correctly). */
function chicagoEpoch(y, mo, d, h, mi) {
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(guess).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, (+parts.hour) % 24, +parts.minute, +parts.second);
  return guess.getTime() - (asUtc - guess.getTime());
}

function normTitle(t) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mapCategory(text, fallback) {
  const t = text.toLowerCase();
  if (/(music|concert|band|dj|choir|symphony|karaoke|open mic)/.test(t)) return "Music";
  if (/(food|wine|beer|brew|tasting|cook-off|chili|bbq|brunch|dinner|lunch|farmer'?s market|food truck)/.test(t)) return "Food & Drink";
  if (/(kid|family|children|toddler|story ?time|pumpkin|santa|easter|trick-or-treat|halloween|youth|teen|camp)/.test(t)) return "Family";
  if (/(hike|trail|run |5k|marathon|golf|fishing|kayak|paddle|park|camping|outdoor|nature|bike|cycling)/.test(t)) return "Outdoors";
  if (/(workshop|class|training|course|seminar|education|learn|lecture|book club|library|stem)/.test(t)) return "Learn";
  return fallback || "Community";
}

const BOILERPLATE_DESC_RE = /see the (City of Leander|Leander Chamber of Commerce) calendar for details/i;

/**
 * Card blurb: neither source publishes a short hook, so derive one
 * mechanically from the event's own description — its first sentence,
 * clamped. Never invented copy; events whose only text is the boilerplate
 * placeholder get no blurb.
 */
function deriveBlurb(ev) {
  if (ev.blurb && String(ev.blurb).trim()) return;
  const desc = (ev.description || "").replace(/\s+/g, " ").trim();
  if (desc.length < 60 || BOILERPLATE_DESC_RE.test(desc)) return;
  const firstSentence = (desc.match(/^[^.!?]+[.!?]+/) || [desc])[0].trim();
  let blurb = firstSentence.length >= 40 ? firstSentence : desc;
  if (blurb.length > 140) {
    blurb = blurb.slice(0, 140).replace(/\s+\S*$/, "").trim() + "…";
  }
  if (blurb) ev.blurb = blurb;
}

function loadPrevious() {
  if (!existsSync(OUT)) return [];
  try {
    const arr = JSON.parse(readFileSync(OUT, "utf8"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    console.error("WARN: could not parse previous events.json; starting fresh");
    return [];
  }
}

/* ---------------- City of Leander calendar ---------------- */

async function scrapeCityCalendar() {
  const now = new Date();
  const months = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }
  const found = new Map(); // EID -> partial record
  for (const { month, year } of months) {
    await sleep(SLEEP_MS);
    const html = await get(`https://www.leandertx.gov/Calendar.aspx?month=${month}&year=${year}`);
    const $ = cheerio.load(html);
    $(".calendars .calendar").each((_, cal) => {
      const section = $(cal).find("h2.title").first().text().trim(); // "Library" | "Meetings" | ...
      const fallbackCat = section.toLowerCase().includes("librar") ? "Learn" : "Community";
      $(cal).find("ol > li").each((_, li) => {
        const a = $(li).find("h3 a[id^='eventTitle_']").first();
        const href = a.attr("href") || "";
        const m = href.match(/EID=(\d+)/i);
        if (!m) return;
        const eid = m[1];
        if (found.has(eid)) return;
        const title = a.find("span").text().trim() || a.text().trim();
        const schema = $(li).find("[itemscope][itemtype='http://schema.org/Event']");
        const startISO = schema.find("[itemprop='startDate']").first().text().trim(); // "2026-09-28T18:30:00" (floating, America/Chicago)
        const sm = startISO.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (!sm) return;
        const startsAt = chicagoEpoch(+sm[1], +sm[2], +sm[3], +sm[4], +sm[5]);
        // end time from the visible "September 28, 2026, 6:30 PM - 7:30 PM" range
        let endsAt;
        const dateText = $(li).find(".subHeader .date").first().text().replace(/\s+/g, " ").trim();
        const em = dateText.match(/-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (em) {
          let eh = +em[1] % 12; if (/pm/i.test(em[3])) eh += 12;
          endsAt = chicagoEpoch(+sm[1], +sm[2], +sm[3], eh, +em[2]);
          if (endsAt <= startsAt) endsAt += 24 * 3600 * 1000; // crosses midnight
        }
        const venue = $(li).find(".subHeader .eventLocation .name").first().text().trim();
        const addr = schema.find("[itemprop='address']");
        const street = addr.find("[itemprop='streetAddress']").text().trim();
        const city = addr.find("[itemprop='addressLocality']").text().trim();
        const region = addr.find("[itemprop='addressRegion']").text().trim();
        const zip = addr.find("[itemprop='postalCode']").text().trim();
        const address = [street, [city, region].filter(Boolean).join(" "), zip].filter(Boolean).join(", ") || undefined;
        const detailUrl = `https://www.leandertx.gov/Calendar.aspx?EID=${eid}`;
        found.set(eid, {
          id: `citycal-${eid}`, title, startsAt, endsAt,
          venue: venue || "Leander, TX", address,
          description: `${title} — see the City of Leander calendar for details.`,
          url: detailUrl, sourceUrl: detailUrl,
          category: mapCategory(`${title} ${section}`, fallbackCat),
          source: "city-calendar",
        });
      });
    });
    console.error(`city-calendar: month ${month}/${year} -> ${found.size} events so far`);
  }

  // Detail pages for full descriptions (capped).
  let n = 0;
  for (const ev of found.values()) {
    if (n >= MAX_DETAIL_PAGES) break;
    n++;
    await sleep(SLEEP_MS);
    try {
      const html = await get(ev.url);
      const $ = cheerio.load(html);
      const descDiv = $("div[itemprop='description']").first();
      const desc = descDiv.text().replace(/\s+/g, " ").trim();
      if (desc) ev.description = desc;
      // The city almost never embeds a photo in a calendar description
      // (verified Oct 2026: text-only, and og:image is one generic site
      // image for every event) — but take a real one if it ever appears.
      const embedded = descDiv.find("img").first().attr("src");
      if (embedded) {
        ev.image = embedded.startsWith("http") ? embedded : `https://www.leandertx.gov${embedded}`;
      }
      // detail page may refine the date line
      const dline = $("[id$='eventDate']").first().text().trim();
      if (dline) ev._dateLine = dline;
    } catch (e) {
      console.error(`WARN: city detail ${ev.id}: ${e.message}`);
      ev.description = ev.description || `${ev.title} — see the City of Leander calendar for details.`;
    }
  }
  return [...found.values()];
}

/* ---------------- Chamber of Commerce calendar ---------------- */

function parseICS(ics) {
  const out = {};
  const unfolded = ics.replace(/\r\n[ \t]/g, "");
  for (const line of unfolded.split(/\r\n|\n/)) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).split(";")[0];
    let val = line.slice(i + 1).replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/g, "\n").trim();
    if (["DTSTART", "DTEND", "SUMMARY", "LOCATION", "DESCRIPTION", "UID"].includes(key)) out[key] = val;
  }
  return out;
}

function parseICSDate(s) {
  // "20261010T100000" (floating -> America/Chicago) or "...Z"
  const m = s.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/);
  if (!m) return null;
  if (m[7] === "Z") return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return chicagoEpoch(+m[1], +m[2], +m[3], +m[4], +m[5]);
}

async function scrapeChamber() {
  await sleep(SLEEP_MS);
  const html = await get("https://leander.chamberspace.net/calendar");
  const urls = new Map();
  for (const m of html.matchAll(/href="((?:https:\/\/leander\.chamberspace\.net)?\/event\/[^"]+)"/g)) {
    const u = m[1].startsWith("http") ? m[1] : `https://leander.chamberspace.net${m[1]}`;
    const em = u.match(/\/event\/[^/]+\/(\d+)/);
    if (em) urls.set(em[1], u);
  }
  if (urls.size === 0) throw new Error("no /event/ URLs found on chamber calendar page");
  console.error(`chamber: ${urls.size} event pages found`);
  const events = [];
  for (const [eid, pageUrl] of urls) {
    await sleep(SLEEP_MS);
    try {
      const ics = await get(`https://leander.chamberspace.net/virtualdir/includesV2/ICSDownload.asp?eid=${eid}`);
      if (!ics.includes("BEGIN:VEVENT")) throw new Error("no VEVENT in ICS");
      const f = parseICS(ics);
      const startsAt = f.DTSTART ? parseICSDate(f.DTSTART) : null;
      if (!startsAt) throw new Error("unparseable DTSTART");
      const endsAt = f.DTEND ? parseICSDate(f.DTEND) : undefined;
      const loc = (f.LOCATION || "").replace(/\s+/g, " ").trim();
      const venue = loc.split(",")[0].trim() || "Leander, TX";
      // Chamber event pages carry a per-event flyer image (CalendarImages)
      // that the ICS feed omits — fetch the page and take it when present.
      let image;
      try {
        const pageHtml = await get(pageUrl);
        const $p = cheerio.load(pageHtml);
        const flyer = $p("img[src*='CalendarImages']").first().attr("src");
        if (flyer) {
          const abs = flyer.startsWith("http") ? flyer : `https://leander.chamberspace.net${flyer}`;
          image = encodeURI(abs);
        }
      } catch { /* image is optional; the card falls back to category art */ }
      events.push({
        id: `chamber-${eid}`,
        title: (f.SUMMARY || "Chamber Event").trim(),
        description: (f.DESCRIPTION || "").replace(/\s+/g, " ").trim() || "See the Leander Chamber of Commerce calendar for details.",
        startsAt, endsAt,
        venue, address: loc.includes(",") ? loc : undefined,
        ...(image ? { image } : {}),
        url: pageUrl, sourceUrl: pageUrl,
        category: mapCategory(`${f.SUMMARY} ${f.DESCRIPTION}`, "Community"),
        source: "chamber",
      });
    } catch (e) {
      console.error(`WARN: chamber eid ${eid}: ${e.message}`);
    }
  }
  return events;
}

/* ---------------- main ---------------- */

async function main() {
  const prev = loadPrevious();
  // Featured pins are set by hand (paid placements): an event's pin is its
  // featuredUntil timestamp. Preserve pins by stable id across
  // regenerations instead of wiping them every run — the same
  // carry-forward scrape-businesses.mjs applies to its `featured` flag.
  const prevFeaturedUntil = new Map(
    prev.filter((e) => e.id && e.featuredUntil).map((e) => [e.id, e.featuredUntil]),
  );
  const now = Date.now();
  const results = [];
  for (const [source, scrape] of [["city-calendar", scrapeCityCalendar], ["chamber", scrapeChamber]]) {
    try {
      const items = await scrape();
      results.push({ source, ok: true, items });
      console.error(`${source}: OK (${items.length} events)`);
    } catch (e) {
      results.push({ source, ok: false, error: e.message });
      console.error(`WARN: ${source} source failed: ${e.message}; keeping previous records`);
    }
  }

  // Official public Leander ISD calendars. Off unless explicitly enabled.
  if (process.env.LEANDER_ENABLE_LISD_ICS === "1") {
    for (const [source, feedId] of LISD_FEED_SOURCES) {
      await sleep(LISD_SLEEP_MS);
      try {
        const text = await get(feedUrl(feedId));
        const parsed = parseLisdIcs(text, {
          feedId,
          windowStart: now - 86_400_000,
          windowEnd: now + LISD_WINDOW_DAYS * 86_400_000,
          maxOccurrencesPerEvent: 400,
        });
        for (const err of parsed.errors) console.error(`WARN: ${source}: ${err.error}${err.uid ? ` (${err.uid})` : ""}`);
        // Any parse error fails the source atomically, so the merge keeps the
        // complete previous records rather than a partial parse.
        const result = lisdSourceResult(source, parsed, (r) => lisdRecordToEvent(r, source, mapCategory(`${r.title} ${r.description}`, "Community")));
        results.push(result);
        if (result.ok) console.error(`${source}: OK (${result.items.length} occurrences)`);
        else console.error(`WARN: ${source} source failed: ${result.error}; keeping previous records`);
      } catch (e) {
        results.push({ source, ok: false, error: e.message });
        console.error(`WARN: ${source} source failed: ${e.message}; keeping previous records`);
      }
    }
  }

  let civic = [];
  try {
    const parsed = JSON.parse(readFileSync(join(ROOT, "src/data/civic.json"), "utf8"));
    if (Array.isArray(parsed)) civic = parsed;
  } catch { /* no civic data: nothing to dedupe against */ }

  const { events: all, report } = mergeEventSources({ prev, results, civic, now });
  for (const f of report.failed) console.error(`WARN: ${f.source}: ${f.error}`);
  for (const ev of all) {
    if (prevFeaturedUntil.has(ev.id)) ev.featuredUntil = prevFeaturedUntil.get(ev.id);
    deriveBlurb(ev);
  }
  writeFileSync(OUT, JSON.stringify(all, null, 2) + "\n");
  const counts = Object.entries(report.sources).map(([k, v]) => `${v.count} ${k}`).join(", ");
  console.log(`events.json: ${all.length} events (${counts})`);
}

main().catch((e) => { console.error(`WARN: fatal: ${e.message}`); process.exit(0); });
