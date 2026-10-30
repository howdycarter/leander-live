/**
 * Scrape civic data from the City of Leander:
 *   1. CivicClerk public API (leandertx.api.civicclerk.com) — upcoming board
 *      meetings (City Council, Planning & Zoning, others).
 *   2. News Flash RSS (https://www.leandertx.gov/RSSFeed.aspx?ModID=1&CID=All-newsflash.xml)
 *   3. Leander ISD Board of Trustees meetings — BoardBook public view
 *      (https://www.leanderisd.org/boardagendas/), rendered via Firecrawl
 *      because leanderisd.org is Cloudflare-walled to plain fetches.
 *
 * Outputs: src/data/civic.json (CivicMeeting[]) and src/data/news.json (NewsItem[]),
 * sorted ascending by startsAt / publishedAt.
 *
 * Robustness: idempotent; a failed source logs WARN: to stderr, keeps the
 * previous records for that source file, and the script exits nonzero for an enabled-source failure.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { recordStatus, recordPendingStatus, runGated, runTracked } from "./lib/source-status-file.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIVIC_OUT = join(ROOT, "src/data/civic.json");
const NEWS_OUT = join(ROOT, "src/data/news.json");
const UA = "LeanderLive-Scraper/1.0 (community-events-bot; contact chris@howdycarter.com)";
const SLEEP_MS = 300;
const API = "https://leandertx.api.civicclerk.com/v1";
const PORTAL = "https://leandertx.portal.civicclerk.com";

const FIRECRAWL_BIN =
  process.env.LL_FIRECRAWL_BIN ||
  "/home/hatch/workspace/custom-connectors/custom.legacy-firecrawl/bin/firecrawl";
const FIRECRAWL_PYTHONPATH = "/opt/muse/skills/custom-connector-setup/bin";

/** Render a JS-heavy page to markdown via the Firecrawl connector CLI. */
function firecrawlScrape(url) {
  return new Promise((resolve, reject) => {
    execFile(
      FIRECRAWL_BIN,
      ["scrape", "--url", url],
      {
        env: { ...process.env, PYTHONPATH: FIRECRAWL_PYTHONPATH },
        maxBuffer: 32 * 1024 * 1024,
        timeout: 240000,
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`firecrawl scrape failed: ${(stderr || err.message || "").slice(0, 200)}`));
          return;
        }
        if (!stdout || stdout.length < 500) {
          reject(new Error("firecrawl returned suspiciously little content"));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, json = false) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return json ? res.json() : res.text();
}

function loadPrevious(path) {
  if (!existsSync(path)) return [];
  try {
    const arr = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    console.error(`WARN: could not parse previous ${path.split("/").pop()}; starting fresh`);
    return [];
  }
}

function mapBody(categoryName, eventName) {
  const t = (categoryName || "").toLowerCase();
  if (t.includes("city council")) return "City Council";
  if (t.includes("planning") && t.includes("zoning")) return "Planning & Zoning Commission";
  if (t.includes("zoning board")) return "Zoning Board of Adjustment";
  if (t.includes("parks") && t.includes("recreation")) return "Parks & Recreation Advisory Board";
  if (categoryName && !/^general$/i.test(categoryName.trim())) return categoryName;
  // "General" bucket: derive the board name from the event title.
  const b = (eventName || "").replace(/\s+(regular|special|joint|workshop)\s+meeting$/i, "").trim();
  return b || "City Board";
}

function fmtLocation(loc) {
  if (!loc) return undefined;
  const parts = [loc.address2, loc.address1, [loc.city, loc.state].filter(Boolean).join(" "), loc.zipCode]
    .filter((p) => p && String(p).trim());
  return parts.join(", ") || undefined;
}

async function resolveAgendaUrl(eventId, agendaFile) {
  // Best effort: try the CivicClerk file-stream endpoint; verify it returns a PDF.
  const fileId = agendaFile?.agendaId;
  if (!fileId) return undefined;
  const url = `${API}/Meetings/GetMeetingFileStream(fileId=${fileId})`;
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA } });
    const ct = res.headers.get("content-type") || "";
    if (res.ok && /pdf/i.test(ct)) return url;
  } catch { /* ignore */ }
  return undefined;
}

/** America/Chicago offset in minutes at a given UTC instant (handles DST). */
function chicagoOffsetMinutes(utcMs) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    +parts.hour % 24, +parts.minute, +parts.second,
  );
  return Math.round((asUtc - utcMs) / 60000);
}

/**
 * The city's CivicClerk feed stamps LOCAL wall-clock time with a `Z` suffix
 * (e.g. "2026-10-01T17:00:00Z" for a 5:00 PM CT council meeting). Parsing that
 * as UTC shifts every meeting 5-6 hours early (3:30 AM "meetings"). Interpret
 * the wall time as America/Chicago and convert to a true UTC instant.
 */
function parseCentral(s) {
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return NaN;
  const [, Y, Mo, D, h, mi, sec] = m.map(Number);
  const wallAsUtc = Date.UTC(Y, Mo - 1, D, h, mi, sec || 0);
  // Iterate once: offset at the guess, then at the corrected instant.
  let off = chicagoOffsetMinutes(wallAsUtc);
  off = chicagoOffsetMinutes(wallAsUtc - off * 60000);
  return wallAsUtc - off * 60000;
}

async function scrapeMeetings() {
  const today = new Date().toISOString().slice(0, 10);
  let url = `${API}/Events?$filter=startDateTime ge ${today}T00:00:00Z&$top=100`;
  const events = [];
  let pages = 0;
  while (url && pages < 5) {
    pages++;
    await sleep(SLEEP_MS);
    const data = await get(url, true);
    if (!Array.isArray(data.value)) throw new Error("unexpected Events API shape");
    events.push(...data.value);
    url = data["@odata.nextLink"] || null;
  }
  if (events.length === 0) throw new Error("no upcoming events returned");

  const now = Date.now();
  const meetings = [];
  for (const e of events) {
    const startsAt = parseCentral(e.startDateTime);
    if (!Number.isFinite(startsAt) || startsAt < now - 6 * 3600 * 1000) continue;
    const body = mapBody(e.eventCategoryName, e.eventName);
    const agendaUrl = await resolveAgendaUrl(e.id, e.agendaFile);
    const m = {
      id: `civic-${e.id}`,
      body,
      title: (e.eventName || `${body} Meeting`).trim(),
      startsAt,
      location: fmtLocation(e.eventLocation),
      sourceUrl: `${PORTAL}/event/${e.id}`,
    };
    if (!m.location) delete m.location;
    if (agendaUrl) m.agendaUrl = agendaUrl;
    meetings.push(m);
    await sleep(SLEEP_MS);
  }
  meetings.sort((a, b) => a.startsAt - b.startsAt);
  return meetings;
}

function unesc(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function scrapeNews() {
  await sleep(SLEEP_MS);
  const xml = await get("https://www.leandertx.gov/RSSFeed.aspx?ModID=1&CID=All-newsflash.xml");
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1];
    const pick = (re) => { const x = it.match(re); return x ? unesc(x[1].trim()) : ""; };
    const title = pick(/<title>([\s\S]*?)<\/title>/);
    const link = pick(/<link>([\s\S]*?)<\/link>/);
    const pub = pick(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const desc = pick(/<description>([\s\S]*?)<\/description>/).replace(/<[^>]+>/g, "").trim();
    if (!title || !link) continue;
    const publishedAt = Date.parse(pub);
    const aid = (link.match(/aid=(\d+)/) || [])[1];
    items.push({
      id: aid ? `newsflash-${aid}` : `newsflash-${Buffer.from(link).toString("base64").slice(0, 12)}`,
      title,
      publishedAt: Number.isFinite(publishedAt) ? publishedAt : Date.now(),
      ...(desc ? { summary: desc.slice(0, 500) } : {}),
      url: link,
    });
  }
  if (items.length === 0) throw new Error("no items in News Flash RSS");
  items.sort((a, b) => b.publishedAt - a.publishedAt);
  return items;
}

/* ---------------- Leander ISD Board (BoardBook, via Firecrawl) ---------------- */

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

async function scrapeLisdBoard() {
  const md = await firecrawlScrape("https://www.leanderisd.org/boardagendas/");
  const re = /([A-Z][a-z]+) (\d{1,2}), (\d{4}) at (\d{1,2}):(\d{2}) ([AP]M)\s*-\s*([^<|]+?)(?=<br|\||$)/gm;
  const matches = [...md.matchAll(re)];
  if (matches.length === 0) throw new Error("no meeting rows parsed from BoardBook public view");
  const now = Date.now();
  const out = [];
  const seenIds = new Set();
  for (const m of matches) {
    const [, monName, day, year, hh, mm, ampm, rawTitle] = m;
    const mon = MONTHS[monName.toLowerCase()];
    if (!mon) continue;
    let h = +hh % 12;
    if (ampm === "PM") h += 12;
    const startsAt = parseCentral(
      `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:${mm}`,
    );
    if (!Number.isFinite(startsAt) || startsAt < now - 6 * 3600 * 1000) continue;
    const seg = md.slice(m.index, m.index + 6000);
    const agenda = seg.match(/(https:\/\/meetings\.boardbook\.org\/Public\/Agenda\/\d+\?meeting=(\d+))/);
    const id = agenda ? `lisd-board-${agenda[2]}` : `lisd-board-${year}${String(mon).padStart(2, "0")}${String(day).padStart(2, "0")}-${String(h).padStart(2, "0")}${mm}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const loc = seg.match(/([A-Z][A-Za-z ]+(?:Center|School|Building))<br>\s*(\d+[^<]+)</);
    const title = rawTitle.replace(/\s+/g, " ").trim();
    const rec = {
      id,
      body: "Leander ISD Board of Trustees",
      title: `Board of Trustees — ${title}`,
      startsAt,
      sourceUrl: agenda ? agenda[1] : "https://www.leanderisd.org/boardagendas/",
    };
    if (loc) rec.location = `${loc[1].trim()}, ${loc[2].replace(/\s+/g, " ").trim()}`;
    if (agenda) rec.agendaUrl = agenda[1];
    out.push(rec);
  }
  out.sort((a, b) => a.startsAt - b.startsAt);
  const capped = out.slice(0, 10);
  if (capped.length === 0) throw new Error("no upcoming LISD board meetings parsed");
  return capped;
}

async function main() {
  const prevCivic = loadPrevious(CIVIC_OUT);
  const prevNews = loadPrevious(NEWS_OUT);
  const prevCity = prevCivic.filter((m) => !String(m.id).startsWith("lisd-board-"));
  const prevLisd = prevCivic.filter((m) => String(m.id).startsWith("lisd-board-"));

  const city = await runTracked("civicclerk-meetings", scrapeMeetings, prevCity);
  recordPendingStatus([city.row]);
  const cityMeetings = city.items;
  let lisdMeetings;

  // Source compliance: Firecrawl (paid) LISD agendas are off unless
  // LEANDER_ENABLE_FIRECRAWL=1. Previous meetings are kept as history.
  const lisdGate = await runGated("lisd-board-agendas", () => scrapeLisdBoard(), prevLisd);
  recordPendingStatus([lisdGate.row]);
  lisdMeetings = lisdGate.items;

  const now = Date.now();
  const meetings = [...cityMeetings, ...lisdMeetings]
    .filter((m) => Number.isFinite(m.startsAt) && m.startsAt >= now - 6 * 3600 * 1000)
    .sort((a, b) => a.startsAt - b.startsAt);

  // Source compliance: leandertx.gov is off unless LEANDER_ENABLE_LEANDERTX=1.
  const prevCityNews = prevNews.filter((n) => !String(n.id).startsWith("local-"));
  const newsGate = await runGated("leandertx-city-news", () => scrapeNews(), prevCityNews);
  let news = newsGate.items;
  recordPendingStatus([newsGate.row]);
  if ([city, lisdGate, newsGate].some((g) => g.row.state === "failed")) process.exitCode = 1;

  // Hand-published items (ids starting "local-") are editorial content the
  // city RSS never carries — preserve them across refreshes instead of
  // wiping them on every successful scrape. (Added 2026-10-28 after the
  // Oct 26 Leo's FunZone / Oak & Steel items were wiped by a refresh.)
  const manualNews = prevNews.filter((n) => String(n.id).startsWith("local-"));
  if (manualNews.length) {
    const freshIds = new Set(news.map((n) => n.id));
    news = [...manualNews.filter((n) => !freshIds.has(n.id)), ...news]
      .sort((a, b) => b.publishedAt - a.publishedAt);
  }

  writeFileSync(CIVIC_OUT, JSON.stringify(meetings, null, 2) + "\n");
  writeFileSync(NEWS_OUT, JSON.stringify(news, null, 2) + "\n");
  recordStatus([city.row, lisdGate.row, newsGate.row]);
  console.log(`civic.json: ${meetings.length} meetings; news.json: ${news.length} items`);
}

main().catch((e) => { console.error(`WARN: fatal: ${e.message}`); process.exitCode = 1; });
