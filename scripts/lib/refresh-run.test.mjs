import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Run the actual orchestrator in an isolated checkout. Only network scrapers
// are replaced; child-process handling, snapshots and reports remain real.
function fixture(t, scripts = {}) {
  const root = mkdtempSync(join(tmpdir(), 'll-refresh-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['scripts', 'src/data', 'signals']) mkdirSync(join(root, dir), { recursive: true });
  copyFileSync(new URL('../run-refresh.mjs', import.meta.url), join(root, 'scripts/run-refresh.mjs'));
  for (const name of ['events', 'jobs', 'civic', 'news', 'businesses', 'source-status']) {
    writeFileSync(join(root, `src/data/${name}.json`), '[]\n');
  }
  for (const name of ['events', 'jobs', 'civic', 'businesses', 'signals']) {
    writeFileSync(join(root, `scripts/scrape-${name}.mjs`), scripts[name] ?? 'console.log("fixture OK")');
  }
  return {
    root,
    run: () => spawnSync(process.execPath, [join(root, 'scripts/run-refresh.mjs')], { encoding: 'utf8' }),
    report: () => JSON.parse(readFileSync(join(root, 'signals/last-run.json'), 'utf8')),
  };
}

test('status-only changes require publication even when listing counts are unchanged', (t) => {
  const f = fixture(t, { events: `import {writeFileSync} from 'node:fs'; writeFileSync('src/data/source-status.json', JSON.stringify([{id:'chamber',state:'ok',checkedAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString()}]));` });
  assert.equal(f.run().status, 0);
  assert.equal(f.report().changed, true);
  assert.equal(f.report().files.sourceStatus.changed, true);
  assert.equal(f.report().files.events.changed, false);
});

test('a failed child produces a nonzero run and retains its error evidence', (t) => {
  const f = fixture(t, { events: 'console.error("fixture crash"); process.exit(7)' });
  assert.equal(f.run().status, 1);
  const report = f.report();
  assert.equal(report.status, 'failed');
  assert.deepEqual(report.scrapersFailed, ['scrape-events.mjs']);
  assert.match(report.scrapers['scrape-events.mjs'].exitError, /fixture crash/);
});

test('a failed signals step never replays alerts from an earlier run', (t) => {
  const f = fixture(t, { signals: 'process.exit(3)' });
  writeFileSync(join(f.root, 'signals/last-run.json'), JSON.stringify({ at: 1, newSignals: [{ id: 'old-alert' }] }));
  f.run();
  assert.deepEqual(f.report().newSignals, []);
});

test('a partially failed signals step retains genuinely new alerts for review', (t) => {
  const f = fixture(t, { signals: `import {writeFileSync} from 'node:fs'; writeFileSync('signals/last-run.json', JSON.stringify({at:Date.now(),newSignals:[{id:'new-alert'}],warnings:['fixture failure']})); process.exit(1);` });
  assert.equal(f.run().status, 1);
  assert.deepEqual(f.report().newSignals, [{id:'new-alert'}]);
  assert.deepEqual(f.report().signalWarnings, ['fixture failure']);
});

test('fatal snapshot errors replace stale success reports and exit nonzero', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'signals/last-run.json'), JSON.stringify({ at: 1, status: 'ok' }));
  rmSync(join(f.root, 'src/data/events.json'));
  mkdirSync(join(f.root, 'src/data/events.json'));
  assert.equal(f.run().status, 1);
  assert.equal(f.report().status, 'failed');
  assert.match(f.report().fatalError, /EISDIR/);
  assert.notEqual(f.report().at, 1);
});

test('a current failed source is reported even if its scraper kept last-good data', (t) => {
  const f = fixture(t, { events: `import {writeFileSync} from 'node:fs'; writeFileSync('src/data/source-status.json', JSON.stringify([{id:'chamber',state:'failed',checkedAt:new Date().toISOString(),lastSuccessAt:null}]));` });
  assert.equal(f.run().status, 1);
  assert.deepEqual(f.report().sourcesFailed, ['chamber']);
});

test('paused sources are degraded rather than process failures', (t) => {
  const f = fixture(t, { jobs: `import {writeFileSync} from 'node:fs'; writeFileSync('src/data/source-status.json', JSON.stringify([{id:'governmentjobs-city-of-leander',state:'paused',checkedAt:new Date().toISOString(),lastSuccessAt:null}]));` });
  assert.equal(f.run().status, 0);
  assert.equal(f.report().status, 'degraded');
  assert.deepEqual(f.report().sourcesPaused, ['governmentjobs-city-of-leander']);
});
