/**
 * Build shareable weekend / new-near-you text from local JSON only (CHR-1873).
 * Does not scrape, post, email, or deploy. Writes signals/shareables-last.json
 * (gitignored) so a person can copy the card.
 *
 *   node scripts/generate-shareables.mjs
 *   node scripts/generate-shareables.mjs --now=2026-11-05T22:00:00Z
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decisionAlertText, newNearYou, weekendRoundup } from "./lib/shareables.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const nowArg = process.argv.find((a) => a.startsWith("--now="));
const now = nowArg ? Date.parse(nowArg.slice("--now=".length)) : Date.now();
if (!Number.isFinite(now)) {
  console.error("WARN: invalid --now=");
  process.exitCode = 1;
} else {
  const events = JSON.parse(readFileSync(join(ROOT, "src/data/events.json"), "utf8"));
  const businesses = JSON.parse(
    readFileSync(join(ROOT, "src/data/businesses.json"), "utf8"),
  );
  let summaries = [];
  try {
    summaries = JSON.parse(
      readFileSync(join(ROOT, "src/data/decision-summaries.json"), "utf8"),
    );
  } catch {
    summaries = [];
  }
  const payload = {
    generatedAt: now,
    weekend: weekendRoundup(events, now),
    newNearYou: newNearYou(businesses, now),
    decisionAlerts: decisionAlertText(summaries),
  };
  const outDir = join(ROOT, "signals");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, "shareables-last.json");
  writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");
  console.log(`weekend events: ${payload.weekend.events.length}`);
  console.log(`new near you: ${payload.newNearYou.items.length}`);
  console.log(`wrote ${out} (not committed)`);
}
