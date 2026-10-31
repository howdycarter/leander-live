// Reads and writes src/data/source-status.json (source compliance).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { mergeStatus, sourceEnabled, statusRow } from './source-gates.mjs';

export const STATUS_PATH = join(import.meta.dirname, '..', '..', 'src', 'data', 'source-status.json');

export function readStatus(path = STATUS_PATH) {
  if (!existsSync(path)) return [];
  try {
    const rows = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Record one run's rows, keeping rows for sources this script did not touch. */
export function recordStatus(rows, path = STATUS_PATH) {
  writeFileSync(path, JSON.stringify(mergeStatus(readStatus(path), rows), null, 2) + '\n');
}

/**
 * A successful fetch is only a candidate until transformation and output writes
 * finish. Persist a conservative failed/unconfirmed state first, preserving the
 * last published success, then let the caller record its candidate rows AFTER
 * all output writes succeed. A throw or process crash cannot leave fresh "ok"
 * provenance over old data. This does not claim multi-file writes are atomic.
 */
export function recordPendingStatus(rows, path = STATUS_PATH) {
  const previous = new Map(readStatus(path).map((row) => [row.id, row]));
  recordStatus(rows.map((row) => {
    if (row.state !== 'ok') return row;
    const prev = previous.get(row.id);
    const recordsKept = prev?.recordsKept ?? 0;
    return {
      ...row, state: 'failed', reason: 'refresh output not confirmed; last verified success retained',
      lastSuccessAt: prev?.lastSuccessAt ?? null, recordsKept, historical: recordsKept > 0,
    };
  }), path);
}

/**
 * Runs one gated source. When it is off, nothing is fetched, the previous
 * records are returned as history, and a paused row is produced.
 * @returns {Promise<{ items: object[], row: object }>}
 */
export async function runGated(id, fetcher, previous, { env = process.env, now = new Date().toISOString(), log = console.error, statusPath = STATUS_PATH } = {}) {
  const prev = readStatus(statusPath).find((r) => r.id === id) ?? {};
  if (!sourceEnabled(id, env)) {
    log(`${id}: paused (rights pending); keeping ${previous.length} previous records as history`);
    return { items: previous, row: statusRow(id, { enabled: false, recordsKept: previous.length, prev, now }) };
  }
  return fetchTracked(id, fetcher, previous, { now, log, prev });
}

// Only these existing automatic sources may use the ungated wrapper. Restricted
// sources must go through runGated, even when the caller omits an environment.
const UNGATED_SOURCES = new Set(['chamber', 'civicclerk-meetings', 'tx-sales-tax-businesses']);
export async function runTracked(id, fetcher, previous, { now = new Date().toISOString(), log = console.error, statusPath = STATUS_PATH } = {}) {
  if (!UNGATED_SOURCES.has(id)) throw new Error(`${id} is not an ungated source`);
  const prev = readStatus(statusPath).find((r) => r.id === id) ?? {};
  return fetchTracked(id, fetcher, previous, { now, log, prev });
}

async function fetchTracked(id, fetcher, previous, { now, log, prev }) {
  try {
    const items = await fetcher();
    if (!Array.isArray(items)) throw new Error('source result must be an array');
    return { items, row: statusRow(id, { enabled: true, ok: true, recordsKept: items.length, prev, now }) };
  } catch (e) {
    log(`WARN: ${id} failed: ${e.message}; keeping ${previous.length} previous records`);
    return { items: previous, row: statusRow(id, { enabled: true, ok: false, recordsKept: previous.length, prev, now }) };
  }
}
