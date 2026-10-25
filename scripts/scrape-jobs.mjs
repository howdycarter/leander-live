/**
 * Scrape job postings from:
 *   1. governmentjobs.com — City of Leander
 *   2. governmentjobs.com — Williamson County (filtered to Leander-area)
 *   3. Leander ISD AppliTrack — via Firecrawl (the board is JS-rendered and
 *      bot-walled to plain fetches; Firecrawl renders it to markdown, which
 *      this script parses). Replaced the old direct-fetch attempt that never
 *      parsed a single posting.
 *
 * Output: src/data/jobs.json (array of Job), newest first by postedAt.
 *
 * Robustness: idempotent; a failed source logs WARN: to stderr, keeps the
 * previous records for that source, and the script still exits 0.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import * as cheerio from "cheerio";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/data/jobs.json");
const UA = "LeanderLive-Scraper/1.0 (community-events-bot; contact chris@howdycarter.com)";
const SLEEP_MS = 300;
const MAX_DETAIL_PAGES = 40;
const ISD_MAX_JOBS = 60;
const ISD_MAX_AGE_DAYS = 150;

const FIRECRAWL_BIN =
  process.env.LL_FIRECRAWL_BIN ||
  "/home/hatch/workspace/custom-connectors/custom.legacy-firecrawl/bin/firecrawl";
const FIRECRAWL_PYTHONPATH = "/opt/muse/skills/custom-connector-setup/bin";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

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

function loadPrevious() {
  if (!existsSync(OUT)) return [];
  try {
    const arr = JSON.parse(readFileSync(OUT, "utf8"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    console.error("WARN: could not parse previous jobs.json; starting fresh");
    return [];
  }
}

const NAMED_ENTITIES = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…", bull: "•",
  copy: "©", reg: "®", trade: "™", deg: "°", middot: "·",
};

/** Decode HTML entities (named + numeric), repeating until stable so
 *  double-encoded text like "&amp;lt;" fully resolves. */
function decodeEntities(s) {
  let out = String(s ?? "");
  for (let pass = 0; pass < 3; pass++) {
    const next = out
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
        const cp = parseInt(h, 16);
        return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : " ";
      })
      .replace(/&#(\d+);/g, (_, d) => {
        const cp = parseInt(d, 10);
        return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : " ";
      })
      .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (m, name) =>
        Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : m,
      );
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * Store descriptions as clean plain text, never markup: governmentjobs.com
 * JSON-LD ships entity-encoded HTML, which the old scraper stored verbatim
 * (and the site then printed as raw code). Block tags become line breaks;
 * everything else is stripped.
 */
function cleanDescription(raw) {
  if (!raw) return "";
  let t = decodeEntities(String(raw));
  t = t
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|ul|ol|h[1-6]|tr|section|article)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ");
  t = decodeEntities(t);
  return t
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
}

function inferType(text) {
  const t = (text || "").toLowerCase();
  if (/\bpart[\s-]?time\b/.test(t)) return "part-time";
  if (/\btemporar/.test(t) || /\bseasonal\b/.test(t) || /\bintern/.test(t)) return "temporary";
  if (/\bcontract\b/.test(t)) return "contract";
  return "full-time";
}

function formatPay(baseSalary, fallbackText) {
  if (baseSalary?.value) {
    const v = baseSalary.value;
    const unit = (v.unitText || "").toLowerCase();
    const per = unit === "hour" ? "Hourly" : unit === "year" ? "Annually" : unit === "month" ? "Monthly" : unit;
    const fmt = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })
      .replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    const min = v.minValue, max = v.maxValue;
    const amt = min != null && max != null && min !== max ? `$${fmt(min)} - $${fmt(max)}` : `$${fmt(min ?? max)}`;
    return `${amt}${per ? " " + per : ""}`.trim();
  }
  // card text like "$92,171.00 - $110,614.40 Annually"
  const m = (fallbackText || "").match(/(\$[\d,]+(?:\.\d+)?(?:\s*-\s*\$[\d,]+(?:\.\d+)?)?\s*(?:Hourly|Annually|Monthly|Hour|Year|Month)?)/i);
  return m ? m[1].trim() : undefined;
}

const AREA_RE = /leander|williamson|cedar park|georgetown|austin|round rock|hutto|jarrell|taylor|liberty hill|florence|granger/i;

async function scrapeGovJobs(orgQuery, company, areaFilter) {
  const listUrl = `https://www.governmentjobs.com/jobs?organization%5B0%5D=${encodeURIComponent(orgQuery)}`;
  await sleep(SLEEP_MS);
  const html = await get(listUrl);
  const $ = cheerio.load(html);
  const cards = [];
  $("li.job-item").each((_, li) => {
    const a = $(li).find("a.job-details-link").first();
    const href = a.attr("href") || "";
    const jobId = ($(li).attr("data-job-id") || "").split("-")[0];
    const title = a.text().trim();
    const location = $(li).find(".job-location").text().trim();
    const infoLine = $(li).find(".job-item-container").text().replace(/\s+/g, " ").trim();
    if (!jobId || !title) return;
    if (areaFilter && !AREA_RE.test(location)) return; // drop clearly non-local
    cards.push({ jobId, title, location: location || "Leander, TX", infoLine, detailUrl: `https://www.governmentjobs.com${href}` });
  });
  if (cards.length === 0) throw new Error("no job cards parsed");
  console.error(`${company}: ${cards.length} cards`);

  const jobs = [];
  let n = 0;
  for (const c of cards) {
    if (n >= MAX_DETAIL_PAGES) break;
    n++;
    await sleep(SLEEP_MS);
    try {
      const dhtml = await get(c.detailUrl);
      const $d = cheerio.load(dhtml);
      let ld = null;
      $d('script[type="application/ld+json"]').each((_, s) => {
        try {
          const parsed = JSON.parse($d(s).text());
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const it of items) if (it["@type"] === "JobPosting") ld = it;
        } catch { /* ignore */ }
      });
      if (!ld) throw new Error("no JobPosting JSON-LD");
      const desc = cleanDescription(ld.description || "");
      const closesAt = ld.validThrough ? Date.parse(ld.validThrough) : undefined;
      const postedAt = ld.datePosted ? Date.parse(ld.datePosted) : undefined;
      jobs.push({
        id: `govjobs-${c.jobId}`,
        title: (ld.title || c.title || "").trim(),
        company,
        location: ld.jobLocation?.address?.addressLocality || c.location,
        type: inferType(`${ld.employmentType} ${c.infoLine}`),
        payRange: formatPay(ld.baseSalary, c.infoLine),
        description: desc || `${c.title} at ${company}.`,
        applyUrl: c.detailUrl,
        ...(postedAt && !Number.isNaN(postedAt) ? { postedAt } : {}),
        ...(closesAt && !Number.isNaN(closesAt) ? { closesAt } : {}),
        source: "governmentjobs",
        sourceUrl: c.detailUrl,
      });
    } catch (e) {
      console.error(`WARN: job detail ${c.jobId}: ${e.message}`);
    }
  }
  return jobs;
}

/* ---------------- Leander ISD via Firecrawl ---------------- */

const APPLITRACK_LIST = "https://www.applitrack.com/leander/onlineapp/JobPostings/view.asp?all=1";
const APPLITRACK_DETAIL = (id) =>
  `https://www.applitrack.com/leander/onlineapp/default.aspx?AppliTrackJobId=${id}`;

function unescMd(s) {
  return (s || "").replace(/\\(.)/g, "$1").replace(/\s+/g, " ").trim();
}

function parseAppliTrackMarkdown(md) {
  const headerRe = /\|\s*(.+?)\s*\|\s*JobID:\s*(\d+)\s*\|/g;
  const heads = [...md.matchAll(headerRe)];
  if (heads.length === 0) throw new Error("no JobID blocks in AppliTrack markdown");
  const jobs = [];
  for (let i = 0; i < heads.length; i++) {
    const [, rawTitle, jobId] = heads[i];
    const segStart = heads[i].index + heads[i][0].length;
    const segEnd = i + 1 < heads.length ? heads[i + 1].index : md.length;
    const seg = md.slice(segStart, segEnd);
    const pick = (re) => {
      const m = seg.match(re);
      return m ? unescMd(m[1]) : "";
    };
    const positionType = pick(/Position Type:\s+([^\n]+)/);
    const datePostedStr = pick(/Date Posted:\s+([^\n]+)/);
    const location = pick(/Location:\s+([^\n]+)/) || "Leander, TX";
    const closingStr = pick(/Closing Date:\s+([^\n]+)/);
    // Salary / full-part-time table (best effort; often blank).
    let salary = "", ftpt = "";
    const sm = seg.match(/Salary Range:\s*\|\s*Full\/Part-Time:[^|\n]*\|[^|\n]*\|\s*\n\|\s*([^|]*)\|\s*([^|]*)\|/);
    if (sm) { salary = unescMd(sm[1]); ftpt = unescMd(sm[2]); }

    const postedAt = datePostedStr ? Date.parse(datePostedStr) : NaN;
    if (!Number.isFinite(postedAt)) continue; // can't freshness-rank it; skip
    const closesAt = closingStr && /\d{1,2}\/\d{1,2}\/\d{4}/.test(closingStr)
      ? Date.parse(closingStr.match(/\d{1,2}\/\d{1,2}\/\d{4}/)[0])
      : undefined;

    let type = "full-time";
    if (/part/i.test(ftpt)) type = "part-time";
    else if (/substitute|temporary/i.test(positionType)) type = "temporary";

    const title = unescMd(rawTitle).replace(/^\|+\s*/, "").replace(/\|+\s*$/, "").trim();
    jobs.push({
      id: `applitrack-${jobId}`,
      title,
      company: "Leander ISD",
      location,
      type,
      ...(salary ? { payRange: salary } : {}),
      description:
        `${positionType || "District"} position at Leander ISD — ${location}. ` +
        `Posted ${datePostedStr}${closingStr ? `; closing: ${closingStr}` : ""}. ` +
        `See the Leander ISD job board for the full posting and application.`,
      applyUrl: APPLITRACK_DETAIL(jobId),
      postedAt,
      ...(closesAt && Number.isFinite(closesAt) ? { closesAt } : {}),
      source: "applitrack",
      sourceUrl: APPLITRACK_LIST,
    });
  }
  return jobs;
}

async function scrapeAppliTrack() {
  const md = await firecrawlScrape(APPLITRACK_LIST);
  const all = parseAppliTrackMarkdown(md);
  const cutoff = Date.now() - ISD_MAX_AGE_DAYS * 24 * 3600 * 1000;
  const fresh = all
    .filter((j) => j.postedAt >= cutoff)
    .sort((a, b) => b.postedAt - a.postedAt)
    .slice(0, ISD_MAX_JOBS);
  console.error(`Leander ISD: ${all.length} postings parsed, ${fresh.length} within ${ISD_MAX_AGE_DAYS}d (cap ${ISD_MAX_JOBS})`);
  if (fresh.length === 0) throw new Error("no fresh ISD postings parsed");
  return fresh;
}

async function main() {
  const prev = loadPrevious();
  const prevByCompany = new Map();
  for (const j of prev) {
    if (!prevByCompany.has(j.company)) prevByCompany.set(j.company, []);
    prevByCompany.get(j.company).push(j);
  }

  let leander = [], williamson = [], isd = [];

  try {
    leander = await scrapeGovJobs("City of Leander", "City of Leander", false);
    console.error(`City of Leander: OK (${leander.length} jobs)`);
  } catch (e) {
    console.error(`WARN: City of Leander jobs failed: ${e.message}; keeping ${prevByCompany.get("City of Leander")?.length || 0} previous`);
    leander = prevByCompany.get("City of Leander") || [];
  }

  try {
    williamson = await scrapeGovJobs("Williamson County", "Williamson County", true);
    console.error(`Williamson County: OK (${williamson.length} jobs)`);
  } catch (e) {
    console.error(`WARN: Williamson County jobs failed: ${e.message}; keeping ${prevByCompany.get("Williamson County")?.length || 0} previous`);
    williamson = prevByCompany.get("Williamson County") || [];
  }

  try {
    isd = await scrapeAppliTrack();
    console.error(`Leander ISD: OK (${isd.length} jobs)`);
  } catch (e) {
    console.error(`WARN: Leander ISD (AppliTrack/Firecrawl) failed: ${e.message}; keeping ${prevByCompany.get("Leander ISD")?.length || 0} previous`);
    isd = prevByCompany.get("Leander ISD") || [];
  }

  // First-seen tracking: carry each posting's firstSeenAt forward by id.
  // Postings already on the board get this run's timestamp as their
  // backfill — it is the board's first *tracked* sighting, labeled as such,
  // never presented as the employer's original post date (that's postedAt).
  const prevFirstSeen = new Map();
  for (const j of prev) {
    if (j.id && Number.isFinite(j.firstSeenAt)) prevFirstSeen.set(j.id, j.firstSeenAt);
  }

  // Dedupe by id; drop postings closed more than a day ago; newest first.
  // The normalization pass also cleans records kept from a previous run
  // (trimmed titles, plain-text descriptions), so a source outage can
  // never resurrect the old entity-encoded text.
  const seen = new Set();
  const now = Date.now();
  const all = [];
  for (const j of [...leander, ...williamson, ...isd]) {
    if (seen.has(j.id)) continue;
    seen.add(j.id);
    if (j.closesAt && j.closesAt < now - 24 * 3600 * 1000) continue;
    if (!j.payRange) delete j.payRange;
    j.title = decodeEntities(j.title || "").replace(/\s+/g, " ").trim();
    if (j.description) j.description = cleanDescription(j.description);
    j.firstSeenAt = prevFirstSeen.get(j.id) ?? now;
    all.push(j);
  }
  all.sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0));
  writeFileSync(OUT, JSON.stringify(all, null, 2) + "\n");
  console.log(`jobs.json: ${all.length} jobs (${leander.length} City of Leander, ${williamson.length} Williamson County, ${isd.length} Leander ISD)`);
}

main().catch((e) => { console.error(`WARN: fatal: ${e.message}`); process.exit(0); });
