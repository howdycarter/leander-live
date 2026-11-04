/**
 * Coming-soon radar (CHR-1872).
 *
 * Turns the sales-tax permit feed (already gathered by scrape-signals /
 * scrape-businesses) into a published list with honest status labels.
 *
 * Editorial rule: a permit alone is labeled "permit filed", never "opening",
 * until a second independent source confirms it (Chamber ribbon-cutting,
 * press coverage of an opening, or a civic/EDC announcement). The permit's
 * own first-sales date is still the same source — it is timing, not
 * confirmation. Chamber membership is not a storefront opening.
 */

export const PERMIT_KIND = "permit";
export const CHAMBER_RIBBON_KIND = "chamber-ribbon";
export const PRESS_OPENING_KIND = "press-opening";
export const CIVIC_OPENING_KIND = "civic-opening";
export const CHAMBER_MEMBER_KIND = "chamber-member";

export const STATUS_PERMIT_FILED = "permit filed";
export const STATUS_OPENING = "opening";

export const PERMIT_SOURCE_LABEL = "Texas sales-tax permit";
export const PERMIT_SOURCE_URL =
  "https://data.texas.gov/dataset/Texas-Sales-and-Use-Tax-Permit-Holders";
export const CHAMBER_RIBBON_LABEL = "Leander Chamber ribbon cutting";

export const WINDOW_DAYS = 120;
export const RECENT_SALES_DAYS = 30;

export const OPENINGS_EMPTY_TITLE = "No recent permits to show";
export const OPENINGS_EMPTY_BODY =
  "The sales-tax permit feed did not return any new Leander storefronts this cycle. That can mean a quiet week, or that the latest refresh did not finish. Check back after the next update — and do not treat a missing list as an opening.";

const DAY_MS = 86400000;
const CONFIRMING_KINDS = new Set([
  CHAMBER_RIBBON_KIND,
  PRESS_OPENING_KIND,
  CIVIC_OPENING_KIND,
]);
const RIBBON_TITLE_RE = /ribbon\s*cut/i;
const GRAND_OPENING_RE = /grand opening/i;
const PRESS_OPENING_RE = /ribbon\s*cut|grand opening|\bnow open(?:ing)?\b|\bopens\b/i;

/**
 * @param {string | null | undefined} kind
 * @returns {boolean}
 */
export function isConfirmingKind(kind) {
  return CONFIRMING_KINDS.has(kind);
}

/**
 * Honest status for a radar row. Unknown or missing sources stay
 * "permit filed" — never "opening".
 *
 * @param {Array<{ kind?: string }> | null | undefined} sources
 * @returns {"permit filed" | "opening"}
 */
export function statusLabel(sources) {
  if (!Array.isArray(sources)) return STATUS_PERMIT_FILED;
  for (const source of sources) {
    if (source && isConfirmingKind(source.kind)) return STATUS_OPENING;
  }
  return STATUS_PERMIT_FILED;
}

/**
 * @param {"permit filed" | "opening" | string | null | undefined} status
 * @returns {string}
 */
export function statusDisplay(status) {
  switch (status) {
    case STATUS_OPENING:
      return "Opening";
    case STATUS_PERMIT_FILED:
      return "Permit filed";
    default:
      return "Permit filed";
  }
}

/**
 * @param {unknown} raw
 * @returns {object[]}
 */
export function loadOpenings(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const row of raw) {
    const rec = normalizeOpening(row);
    if (rec) out.push(rec);
  }
  return sortOpenings(out);
}

/**
 * Build the published radar from permit listings plus optional second sources.
 *
 * @param {{
 *   businesses?: unknown,
 *   events?: unknown,
 *   signals?: unknown,
 *   now?: number,
 *   windowDays?: number,
 *   recentSalesDays?: number,
 * }} [input]
 * @returns {object[]}
 */
export function buildOpeningsFeed(input = {}) {
  const now = Number.isFinite(input.now) ? input.now : Date.now();
  const windowDays = Number.isFinite(input.windowDays) ? input.windowDays : WINDOW_DAYS;
  const recentSalesDays = Number.isFinite(input.recentSalesDays)
    ? input.recentSalesDays
    : RECENT_SALES_DAYS;
  const businesses = Array.isArray(input.businesses) ? input.businesses : [];
  const events = Array.isArray(input.events) ? input.events : [];
  const signals = Array.isArray(input.signals) ? input.signals : [];

  const candidates = [];
  for (const raw of businesses) {
    const rec = fromBusiness(raw, now, windowDays, recentSalesDays);
    if (rec) candidates.push(rec);
  }

  attachConfirmingSources(candidates, events, signals);
  return sortOpenings(candidates);
}

export function sortOpenings(records) {
  return records.slice().sort(
    (a, b) =>
      (b.permitIssuedAt || 0) - (a.permitIssuedAt || 0) ||
      (b.firstSalesAt || 0) - (a.firstSalesAt || 0) ||
      String(a.name).localeCompare(String(b.name)),
  );
}

export function namesMatch(a, b) {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  return shorter.length >= 4 && longer.includes(shorter);
}

export function ribbonSubject(event) {
  if (!event || typeof event !== "object") return null;
  const title = String(event.title || "").replace(/\s+/g, " ").trim();
  const url = String(event.url || event.sourceUrl || "");
  const labeled = title.match(/ribbon\s*cutting\s*[:;,—-]\s*(.+)/i);
  if (labeled) return labeled[1].replace(/\s+/g, " ").trim() || null;
  const grand = title.match(/grand opening(?:\s+of)?\s+(.+)/i);
  if (grand) return grand[1].replace(/\s+/g, " ").trim() || null;
  const slug = url.match(/ribbon-cutting-([^/?#]+)/i);
  if (slug) return slug[1].replace(/[-_]+/g, " ").trim() || null;
  if (RIBBON_TITLE_RE.test(title)) {
    const rest = title.replace(/ribbon\s*cutting\s*[:;,—-]?\s*/i, "").trim();
    return rest || null;
  }
  return null;
}

function fromBusiness(raw, now, windowDays, recentSalesDays) {
  if (!raw || typeof raw !== "object") return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const permitIssuedAt = Number(raw.permitIssuedAt);
  if (!name || !id || !Number.isFinite(permitIssuedAt)) return null;
  if (!inRadarWindow(permitIssuedAt, Number(raw.firstSalesAt), now, windowDays, recentSalesDays)) {
    return null;
  }
  const firstSalesAt = Number(raw.firstSalesAt);
  return {
    id,
    name,
    address: typeof raw.address === "string" ? raw.address : "",
    zip: typeof raw.zip === "string" ? raw.zip : "",
    category: typeof raw.category === "string" ? raw.category : "",
    naics: typeof raw.naics === "string" ? raw.naics : "",
    permitIssuedAt,
    ...(Number.isFinite(firstSalesAt) ? { firstSalesAt } : {}),
    sources: [
      {
        kind: PERMIT_KIND,
        label: PERMIT_SOURCE_LABEL,
        url: typeof raw.sourceUrl === "string" && raw.sourceUrl
          ? raw.sourceUrl
          : PERMIT_SOURCE_URL,
        date: permitIssuedAt,
      },
    ],
  };
}

function inRadarWindow(permitIssuedAt, firstSalesAt, now, windowDays, recentSalesDays) {
  if (now - permitIssuedAt <= windowDays * DAY_MS) return true;
  if (!Number.isFinite(firstSalesAt)) return false;
  if (firstSalesAt > now) return true;
  return now - firstSalesAt <= recentSalesDays * DAY_MS;
}

function attachConfirmingSources(records, events, signals) {
  for (const event of events) {
    if (!isRibbonEvent(event)) continue;
    const subject = ribbonSubject(event);
    if (!subject) continue;
    const match = findNameMatch(records, subject) || findNameMatch(records, event.venue);
    if (!match) continue;
    pushSource(match, {
      kind: CHAMBER_RIBBON_KIND,
      label: CHAMBER_RIBBON_LABEL,
      url: event.url || event.sourceUrl || "",
      date: Number(event.startsAt),
    });
  }
  for (const signal of signals) {
    if (!signal || typeof signal !== "object") continue;
    if (signal.kind === "chamber-new-member") continue;
    if (signal.kind === "press" && PRESS_OPENING_RE.test(String(signal.title || ""))) {
      const match = findNameMatch(records, signal.title);
      if (!match) continue;
      pushSource(match, {
        kind: PRESS_OPENING_KIND,
        label: sourceLabel(signal.source, "Press coverage"),
        url: signal.url || "",
        date: Number(signal.firstSeenAt),
      });
      continue;
    }
    if (signal.kind === "city-news" && PRESS_OPENING_RE.test(`${signal.title || ""} ${signal.detail || ""}`)) {
      const match = findNameMatch(records, signal.title);
      if (!match) continue;
      pushSource(match, {
        kind: CIVIC_OPENING_KIND,
        label: "City announcement",
        url: signal.url || "",
        date: Number(signal.firstSeenAt),
      });
    }
  }
}

function isRibbonEvent(event) {
  if (!event || typeof event !== "object") return false;
  if (event.source && event.source !== "chamber") return false;
  const blob = `${event.title || ""} ${event.url || ""} ${event.sourceUrl || ""} ${event.description || ""}`;
  return RIBBON_TITLE_RE.test(blob) || GRAND_OPENING_RE.test(String(event.title || ""));
}

function findNameMatch(records, candidate) {
  const needle = normName(candidate);
  if (!needle) return null;
  let best = null;
  let bestLen = 0;
  for (const rec of records) {
    if (!namesMatch(rec.name, candidate)) continue;
    const len = Math.min(normName(rec.name).length, needle.length);
    if (len > bestLen) {
      best = rec;
      bestLen = len;
    }
  }
  return best;
}

function pushSource(record, source) {
  const date = Number(source.date);
  const next = {
    kind: source.kind,
    label: source.label,
    url: source.url || "",
    ...(Number.isFinite(date) ? { date } : {}),
  };
  const dup = record.sources.some(
    (s) => s.kind === next.kind && normName(s.label) === normName(next.label) && (s.url || "") === (next.url || ""),
  );
  if (!dup) record.sources.push(next);
}

function sourceLabel(source, fallback) {
  if (source === "google-news") return "Press coverage";
  return fallback;
}

function normalizeOpening(row) {
  if (!row || typeof row !== "object") return null;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const permitIssuedAt = Number(row.permitIssuedAt);
  if (!name || !id || !Number.isFinite(permitIssuedAt)) return null;
  const firstSalesAt = Number(row.firstSalesAt);
  const sources = Array.isArray(row.sources)
    ? row.sources.map(normalizeSource).filter(Boolean)
    : [];
  if (!sources.some((s) => s.kind === PERMIT_KIND)) {
    sources.unshift({
      kind: PERMIT_KIND,
      label: PERMIT_SOURCE_LABEL,
      url: PERMIT_SOURCE_URL,
      date: permitIssuedAt,
    });
  }
  return {
    id,
    name,
    address: typeof row.address === "string" ? row.address : "",
    zip: typeof row.zip === "string" ? row.zip : "",
    category: typeof row.category === "string" ? row.category : "",
    naics: typeof row.naics === "string" ? row.naics : "",
    permitIssuedAt,
    ...(Number.isFinite(firstSalesAt) ? { firstSalesAt } : {}),
    sources,
  };
}

function normalizeSource(raw) {
  if (!raw || typeof raw !== "object") return null;
  const kind = typeof raw.kind === "string" ? raw.kind : "";
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (!kind || !label) return null;
  const date = Number(raw.date);
  return {
    kind,
    label,
    url: typeof raw.url === "string" ? raw.url : "",
    ...(Number.isFinite(date) ? { date } : {}),
  };
}

function normName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&(?:amp|rsquo|lsquo|nbsp|#\d+);/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|llc|inc|dba|co|company)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
