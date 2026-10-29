// Pure expiry + dedup helpers for Leander Live data (CHR-1983 / LEA-04).
//
// INTEGRATION HOLD: nothing imports this module. It is not wired into
// run-refresh.mjs, scrapers or crons. Integration depends on CHR-1980 (LEA-01) review.
//
// No I/O, no network, no clock reads: callers pass `now` and every policy value.
// Thresholds have NO defaults on purpose, so this module doesn't pick policy.
//
// Omitted-source retention: mergeSourceResults() only keeps data for sources that
// appear in `results`. A source present in `previousBySource` but absent from
// `results` is NOT retained; it is reported in `omitted` so the caller decides.

const hasOwn = Object.hasOwn;

function finiteNumber(name, v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new TypeError(`${name} must be a finite number (got ${typeof v === 'number' ? v : typeof v})`);
  }
}
function nonNegative(name, v) {
  finiteNumber(name, v);
  if (v < 0) throw new RangeError(`${name} must be >= 0 (got ${v})`);
}

/** True only for a finite ms timestamp that a Date can represent. */
export function isValidTimestamp(t) {
  return typeof t === 'number' && Number.isFinite(t) && !Number.isNaN(new Date(t).getTime());
}

/**
 * Normalize text for duplicate comparison. NFKC, lowercase, strips combining marks,
 * keeps Unicode letters and numbers (\p{L}\p{N}) so non-Latin titles stay distinct.
 * Returns '' when nothing letter/number-like remains; dedupe() treats '' as unkeyed.
 */
export function normalizeText(s) {
  return String(s ?? '')
    .normalize('NFKD').replace(/\p{M}+/gu, '').normalize('NFKC')
    .toLowerCase().replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Remove duplicates. `keyOf(item)` returns the caller's explicit occurrence identity
 * (e.g. normalized title + exact start time + venue/session). Empty or non-string keys
 * are never treated as duplicates and are counted in `unkeyed`.
 * On collision `prefer(a, b)` returns the item to keep (default: first seen).
 * Returns { items, duplicates, unkeyed }.
 */
export function dedupe(items, { keyOf, prefer = (a) => a } = {}) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  if (typeof keyOf !== 'function') throw new TypeError('keyOf must be a function');
  if (typeof prefer !== 'function') throw new TypeError('prefer must be a function');
  const slot = new Map();
  const out = [];
  const duplicates = [];
  let unkeyed = 0;
  for (const item of items) {
    const key = keyOf(item);
    if (typeof key !== 'string' || key === '') { unkeyed++; out.push(item); continue; }
    if (!slot.has(key)) { slot.set(key, out.length); out.push(item); continue; }
    const i = slot.get(key);
    const kept = prefer(out[i], item);
    duplicates.push({ key, dropped: kept === item ? out[i] : item, kept });
    out[i] = kept;
  }
  return { items: out, duplicates, unkeyed };
}

/**
 * Split items into fresh and expired. `timeOf(item)` returns an ms epoch.
 *  - mode 'past': expired when time < now - graceMs
 *  - mode 'age':  expired when now - time > maxAgeMs (boundary kept)
 * Windows must be finite and >= 0. Items whose time is not a valid, Date-representable
 * timestamp (missing, NaN, string, 1e20...) follow `missing`: 'keep' | 'expire' (required).
 */
export function partitionByFreshness(items, opts = {}) {
  const { now, timeOf, mode, graceMs, maxAgeMs, missing } = opts;
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  if (!isValidTimestamp(now)) throw new TypeError('now must be a valid ms timestamp');
  if (typeof timeOf !== 'function') throw new TypeError('timeOf must be a function');
  if (mode === 'past') nonNegative('graceMs', graceMs);
  else if (mode === 'age') nonNegative('maxAgeMs', maxAgeMs);
  else throw new TypeError("mode must be 'past' or 'age'");
  if (missing !== 'keep' && missing !== 'expire') throw new TypeError("missing must be 'keep' or 'expire'");
  const fresh = [], expired = [];
  for (const item of items) {
    const t = timeOf(item);
    if (!isValidTimestamp(t)) { (missing === 'keep' ? fresh : expired).push(item); continue; }
    const isExpired = mode === 'past' ? t < now - graceMs : now - t > maxAgeMs;
    (isExpired ? expired : fresh).push(item);
  }
  return { fresh, expired };
}

/**
 * Combine per-source results so one failing source never wipes its data.
 * results: [{ source: string, ok: true, items: [] } | { source, ok: false, error }]
 * A result counts as fresh ONLY when ok === true (strict boolean) and items is an array.
 * Anything else (ok:'false', items not an array, null) falls back to that source's
 * previous items. previousBySource lookups use own properties only, so keys like
 * 'constructor' or '__proto__' are safe. Sources in previousBySource but missing from
 * results are NOT retained (see `omitted`).
 * Returns { items, failed, used: Map<source, 'fresh'|'previous'|'none'>, omitted }.
 */
export function mergeSourceResults(results, previousBySource = {}) {
  if (!Array.isArray(results)) throw new TypeError('results must be an array');
  if (previousBySource === null || typeof previousBySource !== 'object') {
    throw new TypeError('previousBySource must be an object');
  }
  const prevOf = (source) => {
    if (typeof source !== 'string' || !hasOwn(previousBySource, source)) return [];
    const p = previousBySource[source];
    return Array.isArray(p) ? p : [];
  };
  const items = [], failed = [], used = new Map();
  for (const r of results) {
    const source = r && typeof r === 'object' ? r.source : undefined;
    if (r && r.ok === true && Array.isArray(r.items)) {
      items.push(...r.items); used.set(source, 'fresh');
      continue;
    }
    const prev = prevOf(source);
    items.push(...prev);
    const reason = r && r.ok === true ? 'items is not an array'
      : String((r && r.error) ?? 'invalid result');
    failed.push({ source, error: reason });
    used.set(source, prev.length ? 'previous' : 'none');
  }
  const omitted = Object.keys(previousBySource).filter((s) => !used.has(s));
  return { items, failed, used, omitted };
}
