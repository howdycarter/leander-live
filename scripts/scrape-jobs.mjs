/**
 * Scrape job postings from:
 *   1. governmentjobs.com — City of Leander
 *   2. governmentjobs.com — Williamson County (filtered to Leander-area)
 *   3. Leander ISD AppliTrack (best effort; skipped if it fights back)
 *
 * Output: src/data/jobs.json (array of Job).
 *
 * Robustness: idempotent; a failed source logs WARN: to stderr, keeps the
 * previous records for that source, and the script still exits 0.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as cheerio from "cheerio";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/data/jobs.json");
const UA = "LeanderLive-Scraper/1.0 (community-events-bot; contact chris@howdycarter.com)";
const SLEEP_MS = 300;
const MAX_DETAIL_PAGES = 40;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
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
      const desc = (ld.description || "").replace(/\s+/g, " ").trim().slice(0, 2000);
      const closesAt = ld.validThrough ? Date.parse(ld.validThrough) : undefined;
      jobs.push({
        id: `govjobs-${c.jobId}`,
        title: ld.title || c.title,
        company,
        location: ld.jobLocation?.address?.addressLocality || c.location,
        type: inferType(`${ld.employmentType} ${c.infoLine}`),
        payRange: formatPay(ld.baseSalary, c.infoLine),
        description: desc || `${c.title} at ${company}.`,
        applyUrl: c.detailUrl,
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

async function scrapeAppliTrack() {
  // Leander ISD postings load via JS/AJAX behind bot detection; best effort.
  await sleep(SLEEP_MS);
  const html = await get("https://www.applitrack.com/leander/onlineapp/JobPostings/view.asp?all=1");
  const $ = cheerio.load(html);
  const rows = [];
  $("a").each((_, a) => {
    const href = $(a).attr("href") || "";
    if (/posting/i.test(href) && $(a).text().trim().length > 3) rows.push({ t: $(a).text().trim(), href });
  });
  if (rows.length === 0) throw new Error("no parseable postings (JS-rendered/AJAX page)");
  return rows.slice(0, 20).map((r, i) => ({
    id: `applitrack-${i}`,
    title: r.t, company: "Leander ISD", location: "Leander, TX",
    type: "full-time", description: `${r.t} — Leander ISD.`,
    applyUrl: r.href.startsWith("http") ? r.href : `https://www.applitrack.com/leander/onlineapp/${r.href}`,
    source: "applitrack",
  }));
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
    console.error(`WARN: Leander ISD (AppliTrack) skipped: ${e.message}; keeping ${prevByCompany.get("Leander ISD")?.length || 0} previous`);
    isd = prevByCompany.get("Leander ISD") || [];
  }

  // Dedupe by id; drop postings closed more than a day ago.
  const seen = new Set();
  const now = Date.now();
  const all = [];
  for (const j of [...leander, ...williamson, ...isd]) {
    if (seen.has(j.id)) continue;
    seen.add(j.id);
    if (j.closesAt && j.closesAt < now - 24 * 3600 * 1000) continue;
    if (!j.payRange) delete j.payRange;
    all.push(j);
  }
  writeFileSync(OUT, JSON.stringify(all, null, 2) + "\n");
  console.log(`jobs.json: ${all.length} jobs (${leander.length} City of Leander, ${williamson.length} Williamson County, ${isd.length} Leander ISD)`);
}

main().catch((e) => { console.error(`WARN: fatal: ${e.message}`); process.exit(0); });
