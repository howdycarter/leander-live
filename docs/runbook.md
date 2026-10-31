# Refresh pipeline runbook

`npm run refresh` runs events, jobs, civic, businesses and signals sequentially. It writes `signals/last-run.json`; it does **not** build, commit, push or deploy. The static site updates only after reviewed data/status changes reach a successful deployment.

## Before a scheduled run

The AM/PM schedule lives outside this repository in Muse. Repository code does not prove that a schedule fired or that a deployment completed. Keep the existing cadence; inspect the external job's run ID, timestamp, branch/SHA, command results and deployment receipt. Do not create duplicate jobs.

After pulling the intended branch, install the committed lockfile with `npm ci --no-audit --no-fund` before running scrapers. Stop if installation fails. The Oct 30 AM observation recorded a missing `ical.js` import after a pull; installing dependencies alone does not establish a successful scrape or publication.

Keep `LEANDER_ENABLE_NEOGOV`, `LEANDER_ENABLE_GOOGLE_NEWS`, `LEANDER_ENABLE_FIRECRAWL`, `LEANDER_ENABLE_LEANDERTX` and `LEANDER_ENABLE_LISD_ICS` unset unless that exact source has separately cleared its permission/service review. See `source-compliance-runbook.md`. Do not work around blocks, logins or rate limits.

## Interpret the report

The command now exits **1** for a failed scraper process, an enabled-source failure or an orchestrator fatal error. Paused sources alone exit 0 but produce `status: "degraded"`. A last-good fallback protects availability; it is not fresh data.

Always inspect the current report, including after a nonzero exit:

- `at`, `durationMs`, `status`: identify this run; `running` means incomplete. A fatal report includes `fatalError`.
- `scrapersFailed`, `scrapers.<name>.exitError`, `warnings`: process failures and diagnostic evidence.
- `sourcesFailed`, `sourcesPaused`: persisted source states. Paused sources are intentional restrictions, not successful fetches.
- `files.<name>`: count, additions, removals and byte changes. `sourceStatus` is included, so a status-only failure/recovery requires publication consideration too.
- `newSignals`, `signalWarnings`: current-run items for private review. Signals are never published automatically. A partially failed signals step can still produce valid new review items; old reports are invalidated before work starts.

`src/data/source-status.json` preserves each source's prior `lastSuccessAt` on failure/pause. `checkedAt` is an attempted check, not a successful fetch. Chamber events, CivicClerk meetings and the existing Texas business pull now record source success/failure as well as the gated feeds. Never backfill a success timestamp without a successful fetch and completed output writes. A successful fetch is first persisted as unconfirmed/failed with its prior success time; only completed transformation and output writes promote it to `ok`. This prevents status-only publication from claiming a refresh after a downstream failure. Multi-file writes are not atomic: a civic partial-write failure remains failed even if its first file was written.

## Publication gate

Do not use `changed` alone as proof of a healthy run. A failed run can contain a mixture of fresh sources, retained history and status updates. Review its data/status diff and decide how to publish the truthful failure notice without claiming full freshness. A shell `&&` chain now stops on a failed refresh; the external scheduler must explicitly handle failure reporting/status publication rather than silently discarding the report.

Before any reviewed publication:

1. Check source permissions and flags, run status, duplicate IDs, large count changes, expired rows and hand-published/paid placements.
2. Run `npm run validate:listings`, `npm test`, `npm run build`, `npm run test:uiarc`, and `npm run test:preservation`.
3. Include `src/data/source-status.json` with all reviewed data changes.
4. Record source commit, exact deployment ID, successful build, public asset/source verification and the run being published. A locally modified file or HTTP 200 from an older deployment does not prove publication.

No repository scheduler or production ingestion is activated by these repairs.

## Retention and expiry

- City/Chamber legacy events retain their existing backfill and six-hour-after-start expiry rules. Hand-curated `anchor-` records are retained. This means a removed/cancelled legacy listing may persist until expiry; no new deletion policy is assumed.
- LISD calendar occurrences retain the reviewed end-time, cancellation and occurrence-identity rules. A failed parse keeps last-good history; disabled feeds are not fetched.
- Civic meetings use the existing six-hour grace on **all** merged records, including failed/paused fallback records.
- Jobs close after the existing one-day closing-date grace. The existing ISD 150-day age limit now also applies to retained postings with a known `postedAt`. No age policy is invented for other employers or undated postings; those remain a freshness limitation while their sources are paused.
- Businesses retain the existing suspicious-result threshold (at least 500 upstream rows), deduplication, manual listings and featured flags. A failed pull leaves the last-good file intact.
- A Chamber event-detail failure rejects the incomplete source result and retains last-good data; optional flyer-image failure does not invalidate valid event details.
- News signals stay in the private review queue. Editorial `local-` news and paid flags remain manual.

## Recovery

Inspect `git log -- src/data` and the exact faulty diff. Restore only affected reviewed files from a known good commit, including status if appropriate, then validate/build and obtain the normal publication review. Do not reset unrelated work or activate a restricted source to mask missing content. Two consecutive failures, a sharp unexplained count drop, or an old last-success timestamp require follow-up.
