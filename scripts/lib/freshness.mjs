// Pure expiry + dedup helpers for Leander Live data (CHR-1983 / LEA-04).
// NOT INTEGRATED: nothing imports this yet. Depends on CHR-1980 (LEA-01) review.
// No I/O, no network, no clock reads: callers pass `now` and every policy value.
// Thresholds have NO defaults on purpose, so this module doesn't choose them.

function req(name, v, type) {
  if (typeof v !== type || (type === 'number' && !Number.isFinite(v))) {
    throw new TypeError(`${name} must be a finite ${type}`);
  }
}

/** Normalize text for duplicate comparison: case, accents, punctuation, whitespace. */
export function normalizeText(s) {
  return String(s ?? '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Remove duplicates. `keyOf(item)` returns a string key (falsy = never a duplicate).
 * When keys collide, `prefer(a, b)` returns the item to keep (default: first seen).
 * Order of first occurrence is preserved. Returns { items, duplicates }.
 */
export function dedupe(items, { keyOf, prefer = (a) => a }) {
  if (typeof keyOf !== 'function') throw new TypeError('keyOf must be a function');
  const slot = new Map();
  const out = [];
  const duplicates = [];
  for (const item of items) {
    const key = keyOf(item);
    if (!key) { out.push(item); continue; }
    if (!slot.has(key)) { slot.set(key, out.length); out.push(item); continue; }
    const i = slot.get(key);
    const kept = prefer(out[i], item);
    duplicates.push({ key, dropped: kept === item ? out[i] : item, kept });
    out[i] = kept;
  }
  return { items: out, duplicates };
}

/**
 * Split items into fresh and expired.
 * A timestamp field (ms epoch) is read via `timeOf(item)`.
 *  - mode 'past': expired when time < now - graceMs (e.g. an event that has ended)
 *  - mode 'age':  expired when now - time > maxAgeMs (e.g. a job posted too long ago)
 * Items with no valid time follow `missing`: 'keep' | 'expire' (required, no default).
 */
export function partitionByFreshness(items, { now, timeOf, mode, graceMs, maxAgeMs, missing }) {
  req('now', now, 'number');
  if (typeof timeOf !== 'function') throw new TypeError('timeOf must be a function');
  if (mode === 'past') req('graceMs', graceMs, 'number');
  else if (mode === 'age') req('maxAgeMs', maxAgeMs, 'number');
  else throw new TypeError("mode must be 'past' or 'age'");
  if (missing !== 'keep' && missing !== 'expire') throw new TypeError("missing must be 'keep' or 'expire'");
  const fresh = [], expired = [];
  for (const item of items) {
    const t = timeOf(item);
    if (typeof t !== 'number' || !Number.isFinite(t)) {
      (missing === 'keep' ? fresh : expired).push(item);
      continue;
    }
    const isExpired = mode === 'past' ? t < now - graceMs : now - t > maxAgeMs;
    (isExpired ? expired : fresh).push(item);
  }
  return { fresh, expired };
}

/**
 * Combine per-source results so one failing source never wipes its data.
 * results: [{ source, ok: true, items } | { source, ok: false, error }]
 * previousBySource: { [source]: items[] } from the last good run.
 * Failed sources reuse previous items; returns { items, failed, used }.
 */
export function mergeSourceResults(results, previousBySource = {}) {
  const items = [], failed = [], used = {};
  for (const r of results) {
    if (r && r.ok && Array.isArray(r.items)) {
      items.push(...r.items); used[r.source] = 'fresh';
    } else {
      const prev = previousBySource[r?.source] ?? [];
      items.push(...prev);
      failed.push({ source: r?.source, error: String(r?.error ?? 'invalid result') });
      used[r?.source] = prev.length ? 'previous' : 'none';
    }
  }
  return { items, failed, used };
}
