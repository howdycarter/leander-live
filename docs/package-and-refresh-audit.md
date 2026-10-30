# Package and scraper readiness — 2026-10-30

## Scope and ancestry

Repository-only inspection and fixture testing on `fix/refresh-failure-provenance`, based on `rebuild/vercel-static` at `44ea57b` (PR21), which contains PR22 (`87d9c27`) and production's reported PR20 source (`3c748e4`). Default `main` is a different application lineage and is not the release base. This change preserves the approved photography/logo uplift and does not use the rejected PR16 redesign.

The parent audit identified production as `3c748e4dc7337d8e22a2fb7fd50885694aa7c216`; this repository-only pass did not access deployment APIs or a browser. No local UI/browser was activated. No production ingestion, upload, deployment, source activation or schedule mutation was performed.

## Advertising packages

The three offers are proposed and inquiry-only. Featured Listing is proposed at $49/month, Sponsored Event at $29/event and Featured Job at $99/30 days. These are not approved live rates. Service Leads is explicitly unavailable. All payment URLs are empty by design.

Existing automated tests cover package selection in draft identity, A/B/A changes, required fields, Central-time event input, exact email details, copy races, manual fallback and truthful unsent states. The parent separately exercised the public forms. No broken payment link was repaired because there is no active checkout. Approval of final prices/scope, a real payment configuration, buyer receipts, fulfillment ownership and refund/cancellation terms remain operational gates; this work neither creates them nor claims payment/fulfillment tests passed.

## Verified repairs

- Refresh reports include `source-status.json` in byte-change detection.
- Failed processes, enabled-source failures and fatal errors exit nonzero. Fatal reports replace prior success rather than leaving a stale report. Diagnostics retain process error evidence.
- Current partial signal reports preserve their new review items; earlier alerts cannot be replayed after a failure.
- Already-enabled Chamber events, CivicClerk meetings and Texas business pulls persist real success/failure evidence. Restricted-source flags remain unchanged and the ungated wrapper rejects restricted/unknown source IDs.
- Civic fallback/paused records follow the existing six-hour expiry. Retained ISD jobs follow the existing 150-day age rule when their posting date is known.
- Incomplete Chamber detail fetches cannot claim a successful refresh; last-good data survives.
- Freshness notices name only affected sources on each page and offer source details with evidenced last-success dates or explicit unknown dates. Failed and paused sources remain distinct. Notices keep `role="note"` without live-region noise.

The old notice rendered cleanly in repository SSR: no literal HTML-entity artifacts were reproduced. The notice change improves scope and evidence rather than claiming an encoding defect that was not found.

## Verification boundaries

The new tests run actual scraper/orchestrator processes in temporary fixture checkouts with network replaced at `fetch`; real parsing, data writes, status writes, child-process handling and exit codes execute. Chamber, CivicClerk and Socrata success fixtures reach output JSON; outage, partial-result, fatal-write, stale-report and expiry cases are covered. No fixture data is written to committed content.

The preservation fixture retains its original baseline hashes and adds an explicit eight-file functional exception list for these scraper/report repairs. Assets, data, source gates, date/ICS/merge helpers and other preserved files remain under the original checks. No baseline content hashes were silently replaced.

## Remaining operating gaps

The external Muse AM job observation reported scheduler-level success despite the original missing `ical.js` import. A later reported events rerun succeeded but did not deploy; its raw pre-merge Chamber artifact was unavailable. Those local observation reports are audit evidence, not independent proof of today's full production refresh.

The parent owns schedule/deployment confirmation. This repository supplies no authoritative last-run receipt or deploy automation. Applying `npm ci` after pulls and handling the new nonzero exit contract must be reviewed in the existing external job. Status-only publication also requires the scheduler to include that file and handle failed runs deliberately.

All eight restricted feeds remain paused. Jobs and some civic/news/event content therefore cannot be promised always fresh. Unknown/undated job ages, legacy event backfill after source removals, and permission/service decisions remain explicit limitations. Signal warnings are surfaced as failed runs; private signal state/alerts were not verified against the live Muse filesystem in this pass.

## Local verification result

On this branch after the final source changes:

- `npm ci --no-audit --no-fund`: locked dependencies installed. The initial sandboxed attempt could not resolve npm; the authorized network-enabled retry succeeded.
- `npm test`: 198 passed, 0 failed.
- `npm run build`: passed TypeScript and Vite production build.
- `npm run test:preservation`: 26 passed, 0 failed.
- `npm run test:uiarc`: 11 passed, 0 failed.
- `npm run validate:listings`: valid.
- `git diff --check`: clean.

Non-failing diagnostics remain: Vite warns about the existing large application chunk; SSR of the Arc/motion alert emits React key warnings; the existing preservation/UIARC Vite test harness attempts an HMR socket denied by the sandbox (`EPERM` on port 24678), while the assertions and commands still complete successfully. These are not reported as a browser playtest or live production verification.

## Review correction: output confirmation

Independent review reproduced a false-freshness path: a successful fetch persisted `ok` before transformation/output, then a downstream failure left that new timestamp over old data. Five new real-process regressions cover Chamber/CivicClerk/business output-write failures, `Array(500).fill(null)` business transformation failure, and a CivicClerk second-output failure after the first write. Status now remains unconfirmed/failed with the prior verified success until all output writes finish. The same ordering protects gated event/civic/job source rows. Successful output still promotes status normally. Multi-file output is not transactional; a partial write is explicitly failed and requires review rather than falsely claiming confirmed freshness.
