/**
 * News-signal engine for Leander Live.
 *
 * Watches official/public feeds for things a person should look at BEFORE
 * anything is written up. Signals are NOT published to the site — they are
 * appended to a review queue:
 *   signals/queue.json         — every signal ever found (deduped by id)
 *   signals/last-run.json      — only the signals from the latest run
 *                                (the refresh cron alerts Chris from this)
 * State lives in signals/state-*.json (gitignored, never committed).
 *
 * Sources:
 *   1. Texas sales-tax permits (data.texas.gov Socrata, updated daily) —
 *      new Leander outlets = business-opening radar; vanished outlets =
 *      possible closures. NAICS-gated so home-office LLC noise stays low.
 *   2. Diff of src/data/civic.json — newly posted City Council / Planning &
 *      Zoning / LISD Board meetings (agenda posted = decision coming).
 *   3. Diff of src/data/news.json — city News Flash items with emergency or
 *      decision keywords (closures, delays, votes, bonds).
 *   4. Google News RSS (Leander ISD / City of Leander / development queries),
 *      relevance-filtered. Low precision by nature: signals only, always.
 *   5. Leander Chamber "new members" page — new Chamber members (low prio).
 *   6. LISD BoardBook agenda scan — newly posted board agendas are rendered
 *      via Firecrawl and scanned for hot items (closures, boundaries, bond,
 *      budget, tax rate). One agenda per run.
 *
 * Robustness: a failed source logs WARN:, keeps its state untouched, and
 * never blocks the others. Baselines: the first run for a stateful source
 * records the snapshot quietly (except permits issued in the last 14 days,
 * which are news whenever we first see them).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import * as cheerio from "cheerio";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SIG_DIR = join(ROOT, "signals");
const QUEUE_OUT = join(SIG_DIR, "queue.json");
const LASTRUN_OUT = join(SIG_DIR, "last-run.json");
const TAX_STATE = join(SIG_DIR, "state-sales-tax.json");
const MISC_STATE = join(SIG_DIR, "state-misc.json");
const UA = "LeanderLive-Scraper/1.0 (community-events-bot; contact chris@howdycarter.com)";
const SLEEP_MS = 300;

const FIRECRAWL_BIN =
  process.env.LL_FIRECRAWL_BIN ||
  "/home/hatch/workspace/custom-connectors/custom.legacy-firecrawl/bin/firecrawl";
const FIRECRAWL_PYTHONPATH = "/opt/muse/skills/custom-connector-setup/bin";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, extraHeaders = {}) {
  const res = await fetch(url, { headers: { "User-Agent": UA, ...extraHeaders } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

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

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    console.error(`WARN: could not parse ${path.split("/").pop()}; using fallback`);
    return fallback;
  }
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function normTitle(t) {
  return (t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function unesc(s) {
  return (s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

function fmtWhen(ms) {
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/* ---------------- 1. Sales-tax permits (business radar) ---------------- */

const TAX_URL =
  "https://data.texas.gov/resource/jrea-zgmq.json?$limit=5000" +
  "&$order=outlet_permit_issue_date%20DESC&outlet_city=LEANDER" +
  "&$select=taxpayer_number,outlet_number,outlet_name,outlet_address,outlet_zip_code,outlet_naics_code,outlet_permit_issue_date,outlet_first_sales_date";
// Storefront NAICS -> high: food service, grocery, pharmacy, clothing,
// sporting/hobby/book stores, general merchandise, fitness/amusement,
// personal services, clinics. Other retail (incl. 454xxx e-commerce and
// most home-based sellers) is medium at best; the rest is suppressed.
const NAICS_TALKABLE = /^(722|445|446|447|448|451|452|713|812|621)/;
const NAICS_NOTABLE = /^(44|45|236|237|488|517|518|524|531|541|561|611|624|711|721|811|813)/;

function titleCaseName(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bLlc\b/g, "LLC")
    .replace(/\bDba\b/g, "DBA")
    .trim();
}

async function scanSalesTax(signals, stats, warnings) {
  const state = readJson(TAX_STATE, null);
  const firstRun = !state || !state.keys;
  const prevKeys = firstRun ? {} : state.keys;
  const rows = JSON.parse(await get(TAX_URL));
  if (!Array.isArray(rows) || rows.length < 500) {
    throw new Error(`suspicious Socrata result (${Array.isArray(rows) ? rows.length : "non-array"} rows)`);
  }
  const fresh = {};
  for (const r of rows) {
    const key = `${r.taxpayer_number}-${r.outlet_number}`;
    fresh[key] = {
      n: r.outlet_name || r.taxpayer_name || "",
      a: [r.outlet_address, r.outlet_zip_code].filter(Boolean).join(" "),
      naics: r.outlet_naics_code || "",
      issued: r.outlet_permit_issue_date || "",
      firstSales: r.outlet_first_sales_date || "",
    };
  }
  stats.salesTaxOutlets = Object.keys(fresh).length;

  const now = Date.now();
  let newCount = 0, suppressed = 0;
  for (const [key, v] of Object.entries(fresh)) {
    if (prevKeys[key]) continue;
    const issuedMs = Date.parse(v.issued);
    const ageDays = Number.isFinite(issuedMs) ? (now - issuedMs) / 86400000 : 9999;
    const windowDays = firstRun ? 14 : 120;
    if (ageDays > windowDays) { suppressed++; continue; }
    const talkable = NAICS_TALKABLE.test(v.naics);
    const futureOpening = v.firstSales && Date.parse(v.firstSales) > now;
    const notable = talkable || NAICS_NOTABLE.test(v.naics) || futureOpening;
    if (!notable) { suppressed++; continue; }
    newCount++;
    if (newCount > 25) { suppressed++; continue; }
    signals.push({
      id: `permit-new-${key}`,
      kind: "business-permit-new",
      priority: talkable ? "high" : "medium",
      title: `New sales-tax permit: ${titleCaseName(v.n)}`,
      detail: `${v.a || "Leander, TX"} · NAICS ${v.naics} · permit issued ${v.issued.slice(0, 10)}` +
        (v.firstSales ? ` · first sales ${v.firstSales.slice(0, 10)}` : "") +
        ". A permit is an intent to open, not proof a storefront is open — verify before writing it up.",
      url: "https://data.texas.gov/dataset/Texas-Sales-and-Use-Tax-Permit-Holders",
      source: "tx-sales-tax",
      firstSeenAt: now,
    });
  }

  let goneCount = 0;
  if (!firstRun && Object.keys(fresh).length >= Object.keys(prevKeys).length * 0.85) {
    for (const [key, v] of Object.entries(prevKeys)) {
      if (fresh[key]) continue;
      goneCount++;
      if (goneCount > 10) continue;
      signals.push({
        id: `permit-gone-${key}`,
        kind: "business-permit-gone",
        priority: "low",
        title: `Permit no longer active: ${titleCaseName(v.n)}`,
        detail: `${v.a || "Leander, TX"} · NAICS ${v.naics}. May be a closure, a move, or a paperwork change — unconfirmed.`,
        url: "https://data.texas.gov/dataset/Texas-Sales-and-Use-Tax-Permit-Holders",
        source: "tx-sales-tax",
        firstSeenAt: now,
      });
    }
  }
  if (goneCount > 10) warnings.push(`sales-tax: ${goneCount} outlets vanished; only 10 signaled (possible data reshuffle)`);
  if (suppressed > 0) stats.salesTaxSuppressed = suppressed;
  writeJson(TAX_STATE, { keys: fresh, updatedAt: now });
}

/* ---------------- 2+3. Diffs of published data ---------------- */

const EMERGENCY_RE = /clos|delay|cancel|emergency|boil|outage|evacuat|detour|shelter|warning|advisory/i;
const DECISION_RE = /vote|approv|bond|tax|budget|fee|rate|contract|award|appoint/i;

function scanDataDiffs(signals, misc) {
  const civic = readJson(join(ROOT, "src/data/civic.json"), []);
  const news = readJson(join(ROOT, "src/data/news.json"), []);
  const firstRun = !misc.dataIds;
  const prevCivic = new Set(firstRun ? [] : misc.dataIds.civic || []);
  const prevNews = new Set(firstRun ? [] : misc.dataIds.news || []);

  if (!firstRun) {
    for (const m of civic) {
      if (prevCivic.has(m.id)) continue;
      if (!/City Council|Planning & Zoning|ISD Board/i.test(m.body || "")) continue;
      signals.push({
        id: `meeting-new-${m.id}`,
        kind: "meeting-posted",
        priority: "medium",
        title: `${m.body}: ${m.title}`,
        detail: `${fmtWhen(m.startsAt)}${m.location ? ` · ${m.location}` : ""}${m.agendaUrl ? " · agenda posted" : ""}`,
        url: m.agendaUrl || m.sourceUrl,
        source: "data-diff-civic",
        firstSeenAt: Date.now(),
      });
    }
    for (const n of news) {
      if (prevNews.has(n.id)) continue;
      const text = `${n.title} ${n.summary || ""}`;
      const emergency = EMERGENCY_RE.test(text);
      if (!emergency && !DECISION_RE.test(text)) continue;
      signals.push({
        id: `citynews-${n.id}`,
        kind: "city-news",
        priority: emergency ? "high" : "medium",
        title: n.title,
        detail: (n.summary || "").slice(0, 400),
        url: n.url,
        source: "data-diff-news",
        firstSeenAt: Date.now(),
      });
    }
  }
  misc.dataIds = { civic: civic.map((m) => m.id), news: news.map((n) => n.id) };
}

/* ---------------- 4. Google News RSS ---------------- */

const GNEWS_QUERIES = [
  '"Leander ISD"',
  '"City of Leander"',
  'Leander Texas ("city council" OR development OR "grand opening" OR closure OR delay)',
];
const GNEWS_SIGNAL_RE = /isd|school|board|council|closure|closed|delay|opens|opening|development|bond|vote|approv|zoning|permit|groundbreaking|ribbon|fire|crash|water|road|tax|budget|superintendent|trustee|election|stadium|hospital|library/i;
const GNEWS_LOCAL_SRC = /community impact|hill country|kxan|kvue|austin american|statesman|leanderisd|fox 7|austin business journal|culturemap|austin monitor/i;
const GNEWS_HOT_RE = /clos|delay|cancel|emergency|fire|crash|boil/i;

async function scanGoogleNews(signals, misc, stats) {
  const seen = new Set(misc.gnewsSeen || []);
  let itemsSeen = 0;
  for (const q of GNEWS_QUERIES) {
    await sleep(SLEEP_MS);
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
    const xml = await get(url, { "User-Agent": "Mozilla/5.0 (compatible; LeanderLive/1.0)" });
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const it = m[1];
      const pick = (re) => { const x = it.match(re); return x ? unesc(x[1].trim()) : ""; };
      const title = pick(/<title>([\s\S]*?)<\/title>/);
      const link = pick(/<link>([\s\S]*?)<\/link>/);
      const pub = pick(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const src = pick(/<source[^>]*>([\s\S]*?)<\/source>/);
      if (!title || !link) continue;
      itemsSeen++;
      const publishedAt = Date.parse(pub);
      if (Number.isFinite(publishedAt) && Date.now() - publishedAt > 5 * 24 * 3600 * 1000) continue;
      if (!/leander/i.test(title)) continue;
      if (!GNEWS_SIGNAL_RE.test(title) && !GNEWS_LOCAL_SRC.test(src)) continue;
      const id = `press-${hash(normTitle(title))}`;
      if (seen.has(id)) continue;
      seen.add(id);
      signals.push({
        id,
        kind: "press",
        priority: GNEWS_HOT_RE.test(title) ? "high" : "medium",
        title,
        detail: `via ${src || "Google News"}${Number.isFinite(publishedAt) ? ` · ${fmtWhen(publishedAt)}` : ""}. Press coverage — verify against the official source before writing.`,
        url: link,
        source: "google-news",
        firstSeenAt: Date.now(),
      });
    }
  }
  stats.gnewsItems = itemsSeen;
  misc.gnewsSeen = [...seen].slice(-600);
}

/* ---------------- 5. Chamber new members ---------------- */

async function scanChamber(signals, misc, stats) {
  const html = await get("https://chamber.leandercc.org/new-members");
  const $ = cheerio.load(html);
  const names = [];
  $(".member-card").each((_, el) => {
    const t = $(el).find(".member-card__title").first().text().replace(/\s+/g, " ").trim();
    if (t) names.push(t);
  });
  if (names.length < 3) throw new Error(`only ${names.length} member cards parsed`);
  stats.chamberCards = names.length;
  const known = new Set(misc.chamberMembers || []);
  const firstRun = !misc.chamberMembers;
  if (!firstRun) {
    for (const name of names) {
      if (known.has(name)) continue;
      signals.push({
        id: `chamber-new-${hash(normTitle(name))}`,
        kind: "chamber-new-member",
        priority: "low",
        title: `New Chamber member: ${name}`,
        detail: "Joined the Leander Chamber of Commerce (per the Chamber's new-members page). A membership is not proof of a new storefront.",
        url: "https://chamber.leandercc.org/new-members",
        source: "chamber",
        firstSeenAt: Date.now(),
      });
    }
  }
  misc.chamberMembers = [...new Set([...known, ...names])].slice(-800);
}

/* ---------------- 6. LISD agenda hot-item scan ---------------- */

const AGENDA_KEYWORD_RE = /clos|boundar|bond|budget|tax rate|superintendent|demograph|zoning|construction|attendance|enrollment|staffing|policy|sale of|purchase of|real estate/i;
const AGENDA_HOT_RE = /school clos|boundar|bond election|consolidat/i;

async function scanLisdAgenda(signals, misc) {
  const civic = readJson(join(ROOT, "src/data/civic.json"), []);
  const scanned = new Set(misc.agendaScanned || []);
  const candidate = civic
    .filter((m) => String(m.id).startsWith("lisd-board-") && m.agendaUrl && !scanned.has(m.id))
    .sort((a, b) => a.startsAt - b.startsAt)[0];
  if (!candidate) return;
  const md = await firecrawlScrape(candidate.agendaUrl);
  scanned.add(candidate.id);
  misc.agendaScanned = [...scanned].slice(-60);
  const hits = [];
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.replace(/[#>*[\]()|]/g, "").replace(/\s+/g, " ").trim();
    if (line.length < 12 || line.length > 170) continue;
    if (/boardbook|public view|leander isd public|agenda for|posted|citizens|sign up|live ?stream|open meetings act|accommodation/i.test(line)) continue;
    if (!AGENDA_KEYWORD_RE.test(line)) continue;
    if (!hits.includes(line)) hits.push(line);
    if (hits.length >= 6) break;
  }
  if (hits.length === 0) return;
  signals.push({
    id: `isd-agenda-${candidate.id}`,
    kind: "isd-agenda",
    priority: hits.some((h) => AGENDA_HOT_RE.test(h)) ? "high" : "medium",
    title: `LISD board agenda flagged items — ${candidate.title} (${fmtWhen(candidate.startsAt)})`,
    detail: hits.join(" • "),
    url: candidate.agendaUrl,
    source: "boardbook-agenda",
    firstSeenAt: Date.now(),
  });
}

/* ---------------- main ---------------- */

async function main() {
  mkdirSync(SIG_DIR, { recursive: true });
  const signals = [];
  const warnings = [];
  const stats = {};
  const misc = readJson(MISC_STATE, {});
  const warn = (msg) => { warnings.push(msg); console.error(`WARN: ${msg}`); };

  try { await scanSalesTax(signals, stats, warnings); }
  catch (e) { warn(`sales-tax source failed: ${e.message}`); }

  try { scanDataDiffs(signals, misc); }
  catch (e) { warn(`data-diff failed: ${e.message}`); }

  try { await scanGoogleNews(signals, misc, stats); }
  catch (e) { warn(`google-news source failed: ${e.message}`); }

  try { await scanChamber(signals, misc, stats); }
  catch (e) { warn(`chamber source failed: ${e.message}`); }

  try { await scanLisdAgenda(signals, misc); }
  catch (e) { warn(`lisd-agenda scan failed: ${e.message}`); }

  writeJson(MISC_STATE, misc);

  const queue = readJson(QUEUE_OUT, []);
  const queueIds = new Set(queue.map((s) => s.id));
  const freshSignals = signals.filter((s) => !queueIds.has(s.id));
  const merged = [...queue, ...freshSignals]
    .sort((a, b) => a.firstSeenAt - b.firstSeenAt)
    .slice(-400);
  writeJson(QUEUE_OUT, merged);
  writeJson(LASTRUN_OUT, {
    at: Date.now(),
    newSignals: freshSignals,
    warnings,
    stats,
  });

  const byPrio = { high: 0, medium: 0, low: 0 };
  for (const s of freshSignals) byPrio[s.priority] = (byPrio[s.priority] || 0) + 1;
  console.log(
    `signals: ${freshSignals.length} new (${byPrio.high || 0} high, ${byPrio.medium || 0} medium, ${byPrio.low || 0} low), ` +
    `queue total ${merged.length}${warnings.length ? `, ${warnings.length} warning(s)` : ""}`,
  );
}

main().catch((e) => { console.error(`WARN: fatal: ${e.message}`); process.exit(0); });
