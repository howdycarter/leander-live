// Source gates for Leander Live (source compliance).
//
// Leander Live is commercial. Automatic fetch paths whose published terms do
// not support commercial reuse, or that need a paid service, are off unless
// an explicit flag is set to "1". When a source is off, its previous records
// are kept as history and its status says so. No freshness is claimed for a
// source that was not fetched.
//
// The terms behind each gate are cited in docs/source-compliance-runbook.md.

export const SOURCE_GATES = Object.freeze({
  'governmentjobs-city-of-leander': {
    flag: 'LEANDER_ENABLE_NEOGOV',
    reason: 'paused: rights pending',
    basis: 'NEOGOV Terms of Use sections 4 and 6 (personal, non-commercial use only; no page-scrape, robot or spider access).',
  },
  'governmentjobs-williamson-county': {
    flag: 'LEANDER_ENABLE_NEOGOV',
    reason: 'paused: rights pending',
    basis: 'NEOGOV Terms of Use sections 4 and 6 (personal, non-commercial use only; no page-scrape, robot or spider access).',
  },
  'google-news': {
    flag: 'LEANDER_ENABLE_GOOGLE_NEWS',
    reason: 'paused: rights pending',
    basis: 'Google News terms section 2 and the Google News feed terms (non-commercial use only).',
  },
  'lisd-board-agendas': {
    flag: 'LEANDER_ENABLE_FIRECRAWL',
    reason: 'paused: rights pending, paid service',
    basis: 'Fetched through Firecrawl, a paid service. No LISD site terms found that permit commercial reuse.',
  },
  'lisd-agenda-signals': {
    flag: 'LEANDER_ENABLE_FIRECRAWL',
    reason: 'paused: rights pending, paid service',
    basis: 'Fetched through Firecrawl, a paid service. No LISD site terms found that permit commercial reuse.',
  },
  'lisd-applitrack-jobs': {
    flag: 'LEANDER_ENABLE_FIRECRAWL',
    reason: 'paused: rights pending, paid service',
    basis: 'Fetched through Firecrawl, a paid service. AppliTrack reuse terms not reviewed.',
  },
  'leandertx-city-calendar': {
    flag: 'LEANDER_ENABLE_LEANDERTX',
    reason: 'paused: rights pending, site blocked',
    basis: 'www.leandertx.gov returns HTTP 403, so its terms could not be read.',
  },
  'leandertx-city-news': {
    flag: 'LEANDER_ENABLE_LEANDERTX',
    reason: 'paused: rights pending, site blocked',
    basis: 'www.leandertx.gov returns HTTP 403, so its terms could not be read.',
  },
});

/** True only when the source's flag is exactly "1". Unknown sources are off. */
export function sourceEnabled(id, env = process.env) {
  const gate = SOURCE_GATES[id];
  if (!gate) return false;
  return env[gate.flag] === '1';
}

/**
 * One status row. A paused source never gets a new lastSuccessAt; it keeps
 * the previous value (or null when none was ever recorded).
 * @param {string} id
 * @param {{ enabled: boolean, ok?: boolean, recordsKept?: number, prev?: object, now: string }} info
 */
export function statusRow(id, { enabled, ok = false, recordsKept = 0, prev = {}, now }) {
  const gate = SOURCE_GATES[id];
  if (!enabled) {
    return {
      id,
      state: 'paused',
      reason: gate ? gate.reason : 'paused: unknown source',
      basis: gate ? gate.basis : null,
      lastSuccessAt: prev.lastSuccessAt ?? null,
      checkedAt: now,
      recordsKept,
      historical: recordsKept > 0,
    };
  }
  return {
    id,
    state: ok ? 'ok' : 'failed',
    reason: ok ? null : 'fetch failed; previous records kept',
    basis: gate ? gate.basis : null,
    lastSuccessAt: ok ? now : prev.lastSuccessAt ?? null,
    checkedAt: now,
    recordsKept,
    historical: !ok && recordsKept > 0,
  };
}

/** Merge new rows into the previous status list by id, sorted by id. */
export function mergeStatus(prevRows, rows) {
  const byId = new Map((Array.isArray(prevRows) ? prevRows : []).map((r) => [r.id, r]));
  for (const r of rows) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Queue `source` values produced by each gated signal source. */
export const SIGNAL_SOURCE_TAGS = {
  'google-news': ['google-news'],
  'lisd-agenda-signals': ['boardbook-agenda'],
};

/**
 * Status rows for the gated signal sources. `queue` is the signal queue as
 * written, so a paused or failed source reports the history it still has.
 * @param {{ id: string, enabled: boolean, ok: boolean }[]} gates
 */
export function signalGateRows(gates, queue, { now, prevStatus = [] }) {
  return gates.map(({ id, enabled, ok }) => {
    const tags = new Set(SIGNAL_SOURCE_TAGS[id] ?? [id]);
    const recordsKept = queue.filter((s) => tags.has(s.source)).length;
    const prev = prevStatus.find((r) => r.id === id) ?? {};
    return statusRow(id, { enabled, ok, recordsKept, prev, now });
  });
}
