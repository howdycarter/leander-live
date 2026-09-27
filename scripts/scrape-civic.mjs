/**
 * Scrape civic data from the City of Leander:
 *   1. CivicClerk public API (leandertx.api.civicclerk.com) — upcoming board
 *      meetings (City Council, Planning & Zoning, others).
 *   2. News Flash RSS (https://www.leandertx.gov/RSSFeed.aspx?ModID=1&CID=All-newsflash.xml)
 *
 * Outputs: src/data/civic.json (CivicMeeting[]) and src/data/news.json (NewsItem[]),
 * sorted ascending by startsAt / publishedAt.
 *
 * Robustness: idempotent; a failed source logs WARN: to stderr, keeps the
 * previous records for that source file, and the script still exits 0.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIVIC_OUT = join(ROOT, "src/data/civic.json");
const NEWS_OUT = join(ROOT, "src/data/news.json");
const UA = "LeanderLive-Scraper/1.0 (community-events-bot; contact chris@howdycarter.com)";
const SLEEP_MS = 300;
const API = "https://leandertx.api.civicclerk.com/v1";
const PORTAL = "https://leandertx.portal.civicclerk.com";

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

async function main() {
  const prevCivic = loadPrevious(CIVIC_OUT);
  const prevNews = loadPrevious(NEWS_OUT);

  let meetings;
  try {
    meetings = await scrapeMeetings();
    console.error(`civic meetings: OK (${meetings.length} upcoming)`);
  } catch (e) {
    console.error(`WARN: civic meetings source failed: ${e.message}; keeping ${prevCivic.length} previous records`);
    meetings = prevCivic;
  }

  let news;
  try {
    news = await scrapeNews();
    console.error(`city news: OK (${news.length} items)`);
  } catch (e) {
    console.error(`WARN: city news source failed: ${e.message}; keeping ${prevNews.length} previous records`);
    news = prevNews;
  }

  writeFileSync(CIVIC_OUT, JSON.stringify(meetings, null, 2) + "\n");
  writeFileSync(NEWS_OUT, JSON.stringify(news, null, 2) + "\n");
  console.log(`civic.json: ${meetings.length} meetings; news.json: ${news.length} items`);
}

main().catch((e) => { console.error(`WARN: fatal: ${e.message}`); process.exit(0); });
