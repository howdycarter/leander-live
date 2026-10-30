/**
 * Leander Live refresh orchestrator — one full pipeline cycle.
 *
 * Runs the scrapers in order (events, jobs, civic, businesses, signals),
 * diffs the
 * published data files before/after, and writes a machine-readable run
 * report to signals/last-run.json for the scheduler (build/deploy/commit
 * and Chris's news-signal alert are driven off this report).
 *
 * The scrapers themselves are failure-tolerant (a dead source keeps its old
 * data and logs WARN:). This script never builds or deploys — that stays a
 * deliberate step in the cron run, gated on `changed` and build success.
 *
 * Exits 1 on process/source failure or fatal errors. Paused sources are
 * reported as degraded, never as successful fresh fetches.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SIG_DIR = join(ROOT, "signals");
const DATA_FILES = {
  events: "src/data/events.json",
  jobs: "src/data/jobs.json",
  civic: "src/data/civic.json",
  news: "src/data/news.json",
  businesses: "src/data/businesses.json",
  sourceStatus: "src/data/source-status.json",
};
const SCRAPERS = ["scrape-events.mjs", "scrape-jobs.mjs", "scrape-civic.mjs", "scrape-businesses.mjs", "scrape-signals.mjs"];
const startedAt = Date.now();
const sigRunPath = join(SIG_DIR, "last-run.json");
let report = { at: startedAt, status: "running", changed: false, scrapersFailed: [], newSignals: [] };

function snapshot() {
  const snap = {};
  for (const [name, rel] of Object.entries(DATA_FILES)) {
    const path = join(ROOT, rel);
    if (!existsSync(path)) { snap[name] = { ids: [], hash: null, total: 0 }; continue; }
    const raw = readFileSync(path, "utf8");
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new Error(`${rel} must be an array`);
    const ids = arr.map((x) => x.id).filter(Boolean);
    snap[name] = {
      ids,
      hash: createHash("sha1").update(raw).digest("hex"),
      total: ids.length,
    };
  }
  return snap;
}

function diff(before, after) {
  const out = {};
  for (const name of Object.keys(DATA_FILES)) {
    const b = new Set(before[name].ids);
    const a = new Set(after[name].ids);
    out[name] = {
      total: after[name].total,
      added: [...a].filter((id) => !b.has(id)).length,
      removed: [...b].filter((id) => !a.has(id)).length,
      changed: before[name].hash !== after[name].hash,
    };
  }
  return out;
}

function runScraper(script) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [join(ROOT, "scripts", script)],
      { cwd: ROOT, maxBuffer: 32 * 1024 * 1024, timeout: 1200000 },
      (err, stdout, stderr) => {
        const warnings = (stderr || "")
          .split(/\r?\n/)
          .filter((l) => l.startsWith("WARN:"))
          .map((l) => `${script}: ${l.replace(/^WARN:\s*/, "")}`);
        const summary = (stdout || "").trim().split(/\r?\n/).filter(Boolean).pop() || "";
        resolve({
          script,
          ok: !err,
          exitError: err ? String(stderr || err.message || err).trim().slice(0, 2000) : null,
          summary,
          warnings,
        });
      },
    );
  });
}

async function main() {
  mkdirSync(SIG_DIR, { recursive: true });
  // Invalidate prior success/alerts before doing any work. A crash must not
  // leave a scheduler reading an earlier run as the current result.
  writeFileSync(sigRunPath, JSON.stringify(report, null, 2) + "\n");
  const before = snapshot();

  const scrapers = [];
  for (const script of SCRAPERS) {
    const r = await runScraper(script);
    scrapers.push(r);
    console.log(`[${script}] ${r.summary || r.exitError || "(no summary)"}`);
    for (const w of r.warnings) console.error(w);
  }

  const after = snapshot();
  const files = diff(before, after);
  const anyChanged = Object.values(files).some((f) => f.changed);

  let signalsReport = { newSignals: [], warnings: [] };
  if (existsSync(sigRunPath)) {
    try {
      const parsed = JSON.parse(readFileSync(sigRunPath, "utf8"));
      if (parsed?.at >= startedAt && Array.isArray(parsed.newSignals)) signalsReport = parsed;
    } catch { /* keep empty */ }
  }

  const sources = JSON.parse(readFileSync(join(ROOT, DATA_FILES.sourceStatus), "utf8"));
  const sourcesFailed = sources.filter((s) => s.state === "failed").map((s) => s.id);
  const sourcesPaused = sources.filter((s) => s.state === "paused").map((s) => s.id);
  const scrapersFailed = scrapers.filter((s) => !s.ok).map((s) => s.script);
  const warnings = scrapers.flatMap((s) => s.warnings);
  const failed = scrapersFailed.length > 0 || sourcesFailed.length > 0;
  report = {
    at: startedAt,
    durationMs: Date.now() - startedAt,
    changed: anyChanged,
    status: failed ? "failed" : sourcesPaused.length || warnings.length ? "degraded" : "ok",
    files,
    scrapers: Object.fromEntries(
      scrapers.map((s) => [s.script, { ok: s.ok, exitError: s.exitError, summary: s.summary, warnings: s.warnings }]),
    ),
    scrapersFailed,
    sourcesFailed,
    sourcesPaused,
    newSignals: signalsReport.newSignals || [],
    signalWarnings: signalsReport.warnings || [],
  };
  writeFileSync(sigRunPath, JSON.stringify(report, null, 2) + "\n");
  if (failed) process.exitCode = 1;

  const counts = Object.entries(files)
    .map(([n, f]) => `${n} ${f.total} (+${f.added}/-${f.removed})`)
    .join(", ");
  console.log(
    `refresh: ${anyChanged ? "CHANGED" : "no changes"} — ${counts}; ` +
    `${report.newSignals.length} new signal(s); ${report.scrapersFailed.length} scraper process failure(s)`,
  );
}

main().catch((e) => {
  console.error(`WARN: orchestrator fatal: ${e.message}`);
  process.exitCode = 1;
  try {
    mkdirSync(SIG_DIR, { recursive: true });
    writeFileSync(sigRunPath, JSON.stringify({ ...report, status: "failed", durationMs: Date.now() - startedAt, fatalError: e.message }, null, 2) + "\n");
  } catch (writeError) {
    console.error(`WARN: could not persist failed run report: ${writeError.message}`);
  }
});
