/**
 * Build the Leander business directory (src/data/businesses.json) from the
 * Texas sales-tax permit dataset (data.texas.gov Socrata) — the same
 * source the news-signal radar watches for openings/closings.
 *
 * A sales-tax permit is not a storefront guarantee, so the directory is
 * NAICS-gated to the storefront/service categories a resident would
 * actually look up (restaurants, retail, salons, auto repair, clinics,
 * fitness, child care…). Nonstore retail (454xxx e-commerce), construction
 * and contractor trades, wholesale, real-estate and professional-services
 * permits — overwhelmingly home-based — stay out, as do independent
 * artists (711510), school booster/PTA shells, and B2B industrial repair.
 *
 * Display name is the DBA name when the permit carries one. No phone or
 * website exists in this dataset, so the directory doesn't pretend to
 * have them.
 *
 * Output: src/data/businesses.json (array of Business), featured first,
 * then category, then name — stable ordering so refresh diffs stay small.
 *
 * Robustness: idempotent; a failed or suspicious fetch keeps the previous
 * file untouched and the script exits nonzero.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { recordStatus, runTracked } from "./lib/source-status-file.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/data/businesses.json");
/* Hand-published listings, verified editorially, that the permit pull cannot
 * produce (e.g. a Leander Chamber member outside the NAICS gate or outside
 * the Leander city filter). Merged into every regeneration so a refresh
 * can't wipe them; permit records win id ties. Added 2026-10-28. */
const MANUAL_IN = join(ROOT, "src/data/businesses-manual.json");
const UA = "LeanderLive-Scraper/1.0 (community-events-bot; contact chris@howdycarter.com)";
const DATASET_URL = "https://data.texas.gov/dataset/Texas-Sales-and-Use-Tax-Permit-Holders";

const TAX_URL =
  "https://data.texas.gov/resource/jrea-zgmq.json?$limit=5000" +
  "&$order=outlet_permit_issue_date%20DESC&outlet_city=LEANDER" +
  "&$select=taxpayer_number,outlet_number,outlet_name,outlet_address,outlet_zip_code,outlet_naics_code,outlet_permit_issue_date,outlet_first_sales_date";

/* NAICS prefixes admitted to the directory (most are 6-digit industries;
   a few are whole subsectors that are storefront by nature). */
const GATE = [
  // Food & drink
  "722511", "722513", "722514", "722515", "722320", "722330", "722410",
  // Retail subsectors (storefront by nature)
  "445", "446", "447", "448", "451", "452",
  // Miscellaneous store retailers — only the real shop types
  "453110", "453210", "453220", "453310", "453910", "453920",
  // Performing arts companies / venues / promoters (not 711510 artists)
  "711110", "711120", "711130", "711211", "711219", "711310",
  // Amusement & recreation (fitness, arcades, golf, marinas — not gambling)
  "713120", "713910", "713930", "713940", "713990",
  // Hotels & RV parks
  "721110", "721211", "721199",
  // Repair a resident looks up (not 811310 industrial machinery)
  "811111", "811118", "811121", "811122", "811191", "811192", "811198",
  "811211", "811213", "811219", "811411", "811412", "811420", "811490",
  // Personal services (salons/barbers/nails, funeral, laundry, pet care)
  "812111", "812112", "812113", "812199", "812210", "812310", "812320", "812910",
  // Clinics & practices (not 621610 home health / 621910 ambulance)
  "621111", "621210", "621320", "621340", "621399", "621492", "621493", "621498",
  // Instruction with a front door (fine arts, sports, tutoring, language)
  "611610", "611620", "611630", "611691", "611692", "611699",
  // Child day care
  "624410",
  // Bank / credit-union branches
  "522110", "522120", "522130",
];

/* Category labels — longest matching NAICS prefix wins. */
const CATEGORY_RULES = [
  ["722410", "Bars & Nightlife"],
  ["722320", "Catering & Food Services"],
  ["722330", "Food Trucks"],
  ["722", "Restaurants & Food"],
  ["445310", "Liquor Stores"],
  ["4452", "Specialty Food"],
  ["445", "Grocery & Markets"],
  ["446110", "Pharmacy"],
  ["446", "Health & Beauty"],
  ["447", "Gas & Convenience"],
  ["4483", "Jewelry & Accessories"],
  ["448", "Clothing & Accessories"],
  ["451", "Sports, Hobby & Music"],
  ["452", "General Merchandise"],
  ["453110", "Florists"],
  ["453220", "Gifts & Novelties"],
  ["453310", "Thrift & Resale"],
  ["453910", "Pet Supplies"],
  ["453210", "Office Supplies"],
  ["453920", "Art Galleries"],
  ["7111", "Performing Arts"],
  ["7112", "Sports Teams & Venues"],
  ["7113", "Event Venues & Promoters"],
  ["713940", "Fitness Centers"],
  ["713", "Fun & Recreation"],
  ["721", "Hotels & Lodging"],
  ["8111", "Auto Repair"],
  ["8112", "Electronics Repair"],
  ["811", "Repair Services"],
  ["8121", "Salons, Barbers & Nails"],
  ["8122", "Funeral Services"],
  ["8123", "Laundry & Dry Cleaning"],
  ["812910", "Pet Care"],
  ["812", "Personal Services"],
  ["621", "Clinics & Health Care"],
  ["611610", "Arts Instruction"],
  ["611620", "Sports & Recreation Instruction"],
  ["6116", "Lessons & Tutoring"],
  ["624410", "Child Care"],
  ["5221", "Banks & Credit Unions"],
];

const SKIP_NAME_RE = /\b(BOOSTER|PTA|PTO)\b/i;

function categoryFor(naics) {
  let best = null;
  for (const [prefix, label] of CATEGORY_RULES) {
    if (naics.startsWith(prefix) && (!best || prefix.length > best[0].length)) {
      best = [prefix, label];
    }
  }
  return best ? best[1] : null;
}

function titleCaseName(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bLlc\b/g, "LLC")
    .replace(/\bDba\b/g, "DBA")
    .replace(/\bTx\b/g, "TX")
    .trim();
}

const STREET_SUFFIX = {
  Cv: "Cove", Ln: "Lane", Dr: "Drive", St: "Street", Ave: "Avenue",
  Blvd: "Blvd", Rd: "Road", Ct: "Court", Trl: "Trail", Pkwy: "Parkway",
  Cir: "Circle", Hwy: "Highway", Pl: "Place",
};

function prettyAddress(raw) {
  const t = titleCaseName(String(raw || "").replace(/\s+/g, " "));
  return t
    .split(" ")
    .map((tok) => STREET_SUFFIX[tok] || tok)
    .join(" ")
    .trim();
}

function displayName(raw) {
  let n = String(raw || "").replace(/\s+/g, " ").trim();
  const dba = n.match(/\bDBA\b\s+(.+)$/i);
  if (dba) n = dba[1].trim();
  return titleCaseName(n).replace(/[\s,;]+$/, "");
}

function normKey(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function loadPrevious() {
  if (!existsSync(OUT)) return [];
  try {
    const arr = JSON.parse(readFileSync(OUT, "utf8"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    console.error("WARN: could not parse previous businesses.json; starting fresh");
    return [];
  }
}

function loadManual() {
  if (!existsSync(MANUAL_IN)) return [];
  try {
    const arr = JSON.parse(readFileSync(MANUAL_IN, "utf8"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    console.error("WARN: could not parse businesses-manual.json; ignoring it");
    return [];
  }
}

async function main() {
  const prev = loadPrevious();
  // Featured flags are set by hand (paid placements) — preserve them by id
  // across regenerations instead of wiping them every run.
  const prevFeatured = new Map(prev.filter((b) => b.featured).map((b) => [b.id, true]));

  const source = await runTracked("tx-sales-tax-businesses", async () => {
    const res = await fetch(TAX_URL, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for Socrata query`);
    const rows = JSON.parse(await res.text());
    if (!Array.isArray(rows) || rows.length < 500) {
      throw new Error(`suspicious Socrata result (${Array.isArray(rows) ? rows.length : "non-array"} rows)`);
    }
    return rows;
  }, prev);
  recordStatus([source.row]);
  if (source.row.state !== "ok") { process.exitCode = 1; return; }
  const rows = source.items;

  const byDedupe = new Map();
  let gatedOut = 0, skipped = 0;
  for (const r of rows) {
    const naics = String(r.outlet_naics_code || "");
    if (!GATE.some((p) => naics.startsWith(p))) { gatedOut++; continue; }
    const rawName = r.outlet_name || r.taxpayer_name || "";
    if (!rawName || SKIP_NAME_RE.test(rawName)) { skipped++; continue; }
    const category = categoryFor(naics);
    if (!category) { gatedOut++; continue; }
    const name = displayName(rawName);
    const address = prettyAddress(r.outlet_address || "");
    if (!name || !address) { skipped++; continue; }
    const key = `${r.taxpayer_number}-${r.outlet_number}`;
    const issued = Date.parse(r.outlet_permit_issue_date || "");
    const firstSales = Date.parse(r.outlet_first_sales_date || "");
    const rec = {
      id: `biz-${key}`,
      name,
      category,
      naics,
      address,
      zip: String(r.outlet_zip_code || ""),
      ...(Number.isFinite(issued) ? { permitIssuedAt: issued } : {}),
      ...(Number.isFinite(firstSales) ? { firstSalesAt: firstSales } : {}),
      featured: prevFeatured.has(`biz-${key}`),
      source: "tx-sales-tax",
      sourceUrl: DATASET_URL,
    };
    const dedupeKey = `${normKey(name)}|${normKey(address)}`;
    const existing = byDedupe.get(dedupeKey);
    if (!existing || (rec.permitIssuedAt || 0) > (existing.permitIssuedAt || 0)) {
      byDedupe.set(dedupeKey, rec);
    }
  }

  const all = [...byDedupe.values()];

  // Merge hand-published listings (see MANUAL_IN note) — the permit pull
  // stays authoritative on id ties.
  const permitIds = new Set(all.map((b) => b.id));
  let manualCount = 0;
  for (const rec of loadManual()) {
    if (rec && rec.id && rec.name && !permitIds.has(rec.id)) {
      all.push(rec);
      manualCount++;
    }
  }

  all.sort((a, b) =>
    Number(b.featured) - Number(a.featured) ||
    a.category.localeCompare(b.category) ||
    a.name.localeCompare(b.name),
  );
  writeFileSync(OUT, JSON.stringify(all, null, 2) + "\n");
  recordStatus([{ ...source.row, recordsKept: all.length }]);
  console.log(
    `businesses.json: ${all.length} listings (from ${rows.length} Leander outlets; ` +
    `${gatedOut} gated out by NAICS, ${skipped} skipped, ${manualCount} manual merged)`,
  );
}

main().catch((e) => { console.error(`WARN: fatal: ${e.message}`); process.exitCode = 1; });
