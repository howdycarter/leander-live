# Refresh pipeline runbook

This runbook covers how to watch, recover and moderate the twice-daily data refresh. It describes the code at commit `3d88dd7` (draft PR #12). Source details are in `docs/data-sources.md`.

## What a run does

`node scripts/run-refresh.mjs` runs the five scrapers in order: events, jobs, civic, businesses and signals (`scripts/run-refresh.mjs:31`).

The orchestrator:

1. Snapshots the five published data files.
2. Runs each scraper.
3. Writes a report to `signals/last-run.json`.

It never builds or deploys. The scheduler decides whether to build and deploy, based on the report's `changed` field and on whether the build succeeds (lines 1 to 15).

The orchestrator always exits with code 0, so the scheduler must read the report rather than rely on the exit code.

## Monitoring

After each run, read `signals/last-run.json`. Check these fields:

- **`scrapersFailed`:** scraper processes that exited with an error. Any entry here needs a look.
- **`scrapers.<name>.warnings`:** every line a scraper logged starting with `WARN:`. A source failure looks like `WARN: city-calendar source failed: HTTP 503; keeping previous records`.
- **`files.<name>`:** the `total`, `added` and `removed` counts, and `changed`, for each data file.
- **`newSignals`:** alert-only items for Chris. These are never published.

Treat a run as suspicious when either of these happens:

- One file loses more than about a quarter of its records in one run.
- The same source warns on two runs in a row.

Note that `scripts/scrape-signals.mjs` also writes `signals/last-run.json` during its step. The orchestrator reads that file and then overwrites it with the full report (`scripts/run-refresh.mjs:110`). So after a completed run, the file always holds the orchestrator's report.

## Last-good recovery

Every source keeps its previous records when a fetch fails, so one bad request never deletes published data. The details for each source are in `docs/data-sources.md`.

For the events file, the rules are in `scripts/lib/events-merge.mjs`:

- A result only counts as fresh when it reports `ok: true` with a list of items.
- Anything else falls back to that source's previous records.
- Source IDs must be known and unique, or the merge stops with an error before anything is written.

### If a bad run was published

1. Find the last good commit of `src/data/` with `git log -- src/data`. The data refresh commits are named "Data refresh <date> AM" or "PM".
2. Restore the affected file from that commit with `git checkout <sha> -- src/data/<file>.json`.
3. Commit the restored file.
4. Let the next scheduled run rebuild from it.

Restoring, committing and deploying are owner actions, done by Chris or the parent agent.

### If a source keeps failing

- Check the source URL in a browser.
- If the site changed its layout or moved, open a Linear issue in the Leander Live project with the warning text, and leave the previous data in place.
- Do not work around blocks, logins or rate limits.

## Turning a source off

- **LISD calendars:** these are off unless `LEANDER_ENABLE_LISD_ICS=1` is set (`scripts/scrape-events.mjs:288`). To turn them off, unset the variable in the scheduler.
- **Every other source:** there is no switch today. Turning one off needs a small code change. Until then, keep its previous data and record the decision in Linear.

## Staleness and expiry rules

| Data | Rule | Where |
|---|---|---|
| City calendar and Chamber events | Dropped once the event started more than six hours ago | `scripts/lib/events-merge.mjs:28` |
| LISD calendar events | Dropped only after the end time; all-day ends are exclusive; cancelled occurrences are not published | `scripts/lib/events-merge.mjs` |
| City and ISD board meetings | Dropped once the meeting started more than six hours ago | `scripts/scrape-civic.mjs:164`, `:239` |
| Leander ISD jobs | Only postings within 150 days, at most 60 | `scripts/scrape-jobs.mjs:26-27` |
| Google News signals | Only headlines from the last five days | `scripts/scrape-signals.mjs:292` |
| Business listings | Replaced in full each run, unless the API returns fewer than 500 rows | `scripts/scrape-businesses.mjs:202` |

## Moderation checks before anything is published

- **Signals are never published.** They go to Chris as alerts. A signal becomes a published item only when someone adds it by hand, with an `id` starting `local-`. Those items are preserved across refreshes (`scripts/scrape-civic.mjs:299-305`).
- **Featured placements are set by hand** and carried forward by ID. Paid placements must never be created by a scraper.
- **New sources:** before a new source is published (including the LISD calendars), check that:
  - its permission basis in `docs/data-sources.md` is no longer "pending";
  - a dry run shows sensible counts (`node scripts/events-dry-run.mjs`, which makes no network calls and writes no files);
  - all-day events display correctly on the site (CHR-2011).
- **Duplicates:** LISD board meetings are deduped against `civic.json` only by the same start time and venue name. Never remove board meetings by title.

## Open permission decisions

These need an owner decision. None of them is assumed to be settled.

1. **LISD calendar feeds:** confirm the district's reuse terms, and decide how to treat Google Calendar's robots.txt for a published subscription URL. This must be settled before `LEANDER_ENABLE_LISD_ICS` is enabled.
2. **governmentjobs.com:** its robots.txt disallows general user agents. The source is already in production.
3. **Google News RSS:** its robots.txt does not allow `/rss` for general user agents. The source is already used for alerts.
4. **City of Leander site:** its robots.txt could not be read (HTTP 403).
5. **Firecrawl:** an outside paid service used for two existing sources. Its cost and credentials are owned outside this repo.
6. **Terms of use** were not reviewed for any source.
