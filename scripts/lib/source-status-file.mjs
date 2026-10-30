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
  try {
    const items = await fetcher();
    return { items, row: statusRow(id, { enabled: true, ok: true, recordsKept: items.length, prev, now }) };
  } catch (e) {
    log(`WARN: ${id} failed: ${e.message}; keeping ${previous.length} previous records`);
    return { items: previous, row: statusRow(id, { enabled: true, ok: false, recordsKept: previous.length, prev, now }) };
  }
}
