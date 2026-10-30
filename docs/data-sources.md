# Data sources inventory

This file lists every outside source the refresh pipeline reads. It was written on Oct 29, 2026, at about 5:20 PM CT, against branch `grokbot/chr-1983-integrate-freshness-lisd` at commit `3d88dd7` (draft PR #12). Line numbers refer to that commit.

The robots.txt results below were fetched at 5:19 PM CT on Oct 29, 2026, using the pipeline's own user agent. Site terms of use were not reviewed for any source. Where permission is unclear, the entry says "pending" rather than assuming it is allowed.

## How to read each entry

- **Source ID** is the value used for last-good fallback and for the `source` field on records.
- **Rate** is the delay between requests to that host, taken from the code.
- **Schedule** is when the source runs. All sources run inside `scripts/run-refresh.mjs`, which the twice-daily refresh jobs call (about 6:08 AM and 4:08 PM CT, per CHR-1871). The scheduler itself lives outside this repo.
- **Failure behavior** is what happens to published data when the source fails.
- **Expiry** is when a record stops being published.

Every scraper sends the user agent `LeanderLive-Scraper/1.0 (community-events-bot; contact chris@howdycarter.com)` (for example, `scripts/scrape-events.mjs:21`).

## Events (`src/data/events.json`, written by `scripts/scrape-events.mjs`)

### City of Leander calendar

- **Source ID:** `city-calendar`.
- **URLs:** `https://www.leandertx.gov/Calendar.aspx?month=…&year=…` and the event detail pages `Calendar.aspx?EID=…` (lines 109 and 143).
- **Owner:** City of Leander (CivicPlus site).
- **Permission basis:** pending. `https://www.leandertx.gov/robots.txt` returned HTTP 403, so its rules could not be read. Terms not reviewed.
- **Rate:** 300 ms between requests (`SLEEP_MS`, line 22), with at most 60 detail pages per run (line 23).
- **Failure behavior:** the previous `city-calendar` records are kept (`scripts/lib/events-merge.mjs`, through `mergeSourceResults`). On success, previous future records missing from the new pull are backfilled.
- **Expiry:** dropped once the event started more than six hours ago (`scripts/lib/events-merge.mjs:28`).

### Leander Chamber calendar

- **Source ID:** `chamber`.
- **URLs:** `https://leander.chamberspace.net/calendar` and the per-event ICS download `…/ICSDownload.asp?eid=…` (lines 212 and 225).
- **Owner:** Leander Chamber of Commerce (ChamberSpace).
- **Permission basis:** pending. robots.txt returned HTTP 404, so no rules are published. Terms not reviewed.
- **Rate:** 300 ms between requests (line 22).
- **Failure behavior and expiry:** same as `city-calendar`.

### Leander ISD District calendar (off by default)

- **Source ID:** `lisd-district`.
- **URL:** `https://calendar.google.com/calendar/ical/leanderisd.org_3grot6ac0ug4prua1smkvfsmu8%40group.calendar.google.com/public/basic.ics`. The district links this iCal URL from `https://www.leanderisd.org/calendar/`.
- **Owner:** Leander ISD, hosted by Google Calendar.
- **Status:** only fetched when `LEANDER_ENABLE_LISD_ICS=1` (`scripts/scrape-events.mjs:288`). It is not enabled anywhere.
- **Permission basis:** pending, for two reasons.
  - The district's terms for reusing its calendars have not been confirmed (CHR-2011).
  - `https://calendar.google.com/robots.txt` disallows `/` for all user agents. Robots rules are written for crawlers, and this feed is a published subscription URL, but whether that difference matters is an owner decision. It should not be assumed.
- **Rate:** two feed requests per run, 2 seconds apart (`LISD_SLEEP_MS`, line 24).
- **Window:** occurrences from one day ago to 180 days ahead (`LISD_WINDOW_DAYS`, line 25).
- **Failure behavior:** the previous `lisd-district` records are kept.
- **Expiry:** dropped only after the event's end time. For all-day events, the end is exclusive. Cancelled occurrences are never published.
- **Dedupe:** by UID plus RECURRENCE-ID. Against `civic.json`, an event is dropped only when both are board meetings with the same start time, building and named room. A building match alone never removes an event.
- **Parse errors:** any parse error, including hitting the occurrence cap inside the window, fails that feed for the run, and the previous complete records are kept.

### Leander ISD All-Campus calendar (off by default)

- **Source ID:** `lisd-campus`.
- **URL:** the same pattern as above with feed ID `leanderisd.org_u5tfmsd61ci4efq5s1bac16uvk`.
- Everything else is the same as `lisd-district`.

### Hand-curated anchors

- **Source ID:** `anchor` (IDs start with `anchor-`).
- No outside fetch. They are kept exactly as committed.

## Jobs (`src/data/jobs.json`, written by `scripts/scrape-jobs.mjs`)

### City of Leander and Williamson County (governmentjobs.com)

- **URL:** `https://www.governmentjobs.com/jobs?organization[0]=…` and detail pages (lines 158 and 172).
- **Owner:** NEOGOV (governmentjobs.com), listing the two employers.
- **Permission basis:** pending, and flagged. `https://www.governmentjobs.com/robots.txt` disallows `/` for all user agents not named in its allow list. Only named search crawlers are allowed. This source is already in production. Whether to keep it is an owner decision.
- **Rate:** 300 ms between requests (line 24), with at most 40 detail pages (line 25).
- **Failure behavior:** previous postings for that employer are kept (lines 311 and 319).

### Leander ISD jobs (AppliTrack)

- **URL:** `https://www.applitrack.com/leander/onlineapp/JobPostings/view.asp?all=1` (line 221).
- **Owner:** Frontline Education (AppliTrack), for Leander ISD.
- **Permission basis:** robots permits crawling; reuse terms pending. robots.txt only disallows `/*/onlineapp/admin`. That is a crawler instruction, not permission to republish, and the terms of use have not been reviewed.
- **Fetch method:** rendered through Firecrawl, which is an outside paid service called through a local helper (`scripts/scrape-civic.mjs:29-41` shows the same helper). Its cost and credentials sit outside this repo.
- **Limits:** at most 60 postings, published within 150 days (lines 26, 27 and 287).
- **Failure behavior:** previous ISD postings are kept (line 327).

## Civic (`src/data/civic.json` and `src/data/news.json`, written by `scripts/scrape-civic.mjs`)

### City meetings (CivicClerk)

- **URLs:** `https://leandertx.api.civicclerk.com/v1` and `https://leandertx.portal.civicclerk.com` (lines 26 and 27).
- **Owner:** City of Leander (CivicPlus CivicClerk).
- **Permission basis:** robots.txt on both hosts says `Allow: /`. Terms not reviewed.
- **Rate:** 300 ms (line 25).
- **Failure behavior:** previous records kept (line 275).
- **Expiry:** meetings that started more than six hours ago are dropped (line 164).

### City News Flash RSS

- **URL:** `https://www.leandertx.gov/RSSFeed.aspx?ModID=1&CID=All-newsflash.xml` (line 190).
- **Permission basis:** pending (robots.txt returned 403, as above). This is a published RSS feed.
- **Failure behavior:** previous news kept (line 294). Hand-published items with IDs starting `local-` are always preserved (lines 299 to 305).

### Leander ISD board meetings (BoardBook)

- **URL:** `https://www.leanderisd.org/boardagendas/`, rendered through Firecrawl (line 223).
- **Permission basis:** robots.txt disallows only `/wp-admin/` and asks for a 10-second crawl delay. This is one request per run. Terms not reviewed.
- **Failure behavior:** previous records kept (line 283).
- **Expiry:** six hours after start (line 239).

## Businesses (`src/data/businesses.json`, written by `scripts/scrape-businesses.mjs`)

### Texas sales and use tax permit holders

- **URL:** `https://data.texas.gov/resource/jrea-zgmq.json` (Socrata API, lines 36 to 39).
- **Owner:** Texas Comptroller of Public Accounts, published on the Texas Open Data Portal.
- **What it is:** businesses registered to collect sales tax. It is not a building permit dataset.
- **Permission basis:** a public open-data API. robots.txt asks for a 1-second crawl delay and disallows only browse-page filters.
- **Failure behavior:** previous listings are kept on failure, or when the API returns fewer than 500 rows (lines 199 to 203).
- **Manual entries:** `src/data/businesses-manual.json` (line 34) is merged in.

## Signals (alert only, never published; written by `scripts/scrape-signals.mjs`)

These feed `signals/queue.json` and `signals/last-run.json` (lines 40 and 41). Both are gitignored and never published to the site.

- **Texas sales tax permit radar:** the same Socrata dataset as above (line 126).
- **Google News RSS:** `https://news.google.com/rss/search?q=…` (line 280), using three queries.
  - Permission basis: pending, and flagged. `https://news.google.com/robots.txt` disallows `/` for all user agents, with exceptions that do not include `/rss`. This source is already in use for alerts. Whether to keep it is an owner decision.
  - Only headlines from the last five days are kept (line 292).
- **Chamber new members:** `https://chamber.leandercc.org/new-members` (line 317). robots.txt returned 404. Terms not reviewed.
- **Civic and news diffs:** comparisons of the published data files. No outside fetch.

## Sources researched but not used

These are covered in the CHR-1875 research.

- **Community Impact** article pages are disallowed by its robots.txt (`/article/`).
- The **City of Leander's issued-permit reports** are historical only (2010 to 2016). They are a different dataset from the sales tax permits, and no current public source was found.
