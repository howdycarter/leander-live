# Source compliance runbook

Leander Live is commercial (paid jobs and listings). This page records which automatic sources are paused, why, and how to run the site without them. It is a reading of published terms, not legal advice.

Execution owner: Grok Bot. Reviewer: Samantha.

## What is paused

Each source below is off unless its flag is set to exactly `1`. Nothing sets these flags today.

| Source id | Flag | Script |
| --- | --- | --- |
| governmentjobs-city-of-leander | LEANDER_ENABLE_NEOGOV | scrape-jobs.mjs |
| governmentjobs-williamson-county | LEANDER_ENABLE_NEOGOV | scrape-jobs.mjs |
| google-news | LEANDER_ENABLE_GOOGLE_NEWS | scrape-signals.mjs |
| lisd-board-agendas | LEANDER_ENABLE_FIRECRAWL | scrape-civic.mjs |
| lisd-agenda-signals | LEANDER_ENABLE_FIRECRAWL | scrape-signals.mjs |
| lisd-applitrack-jobs | LEANDER_ENABLE_FIRECRAWL | scrape-jobs.mjs |
| leandertx-city-calendar | LEANDER_ENABLE_LEANDERTX | scrape-events.mjs |
| leandertx-city-news | LEANDER_ENABLE_LEANDERTX | scrape-civic.mjs |

The LISD calendar feeds (LEANDER_ENABLE_LISD_ICS, in the PR #11 to #13 stack) also stay off until a permission basis is verified.

Sources not listed here (CivicClerk meetings, the Chamber, data.texas.gov, business data) are unchanged by this work.

## What happens when a source is paused

- Nothing is fetched.
- Previous records stay in the data files as history. Nothing is deleted. Events still expire on their normal rules.
- `src/data/source-status.json` gets a row with `state: "paused"`, the reason (for example "paused: rights pending"), `recordsKept`, and `historical: true` when old records remain.
- `lastSuccessAt` is never refreshed for a paused source. It keeps its previous value, or null. No freshness is claimed.

## Terms behind each pause

All fetch times are Oct 29, 2026, Central time.

### governmentjobs.com (NEOGOV)

Terms of Use, https://www.governmentjobs.com/home/termsofuse, effective Sept 2, 2025, fetched 5:45 PM.

- Section 4, Intellectual Property Rights: "These Terms of Use permit you to use the Services for your personal, non-commercial use only".
- Section 6, Prohibited Uses, item 4: you must not "Reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, republish, download, store ... any NEOGOV Content".
- Section 6, item 7: you must not "Access or use for any commercial purposes any part of the Services".
- Section 6, second list, item 8: you agree not to use "any "page-scrape", "robot", "spider" or other automatic device ... to access, acquire, copy or monitor any portion of the Services".
- Section 6, closing paragraph: the restrictions apply to career pages at governmentjobs.com/careers "regardless of whether such content is public or viewable without a login".

No scraping of NEOGOV in any form. The path forward is an official feed or written permission from each employer.

### Google News RSS

- Google News terms, https://www.google.com/intl/en_us/terms_google_news.html, section 2, "Use of the Service" (read through the search index, about 5:45 PM): "You may only display the content of the Service for your own personal use (i.e., non-commercial use)", and you may not "take the results from the Service and reformat and display them".
- Google News feed terms, https://www.google.com/intl/pl_pl/news_feed_terms.html (the English page now redirects to the Help center), "Terms of use" section: Google invites non-commercial use of its feeds on websites and says Google feeds may not be redistributed.

No commercial permission is assumed.

### Leander ISD board agendas and AppliTrack (Firecrawl)

- Firecrawl is a paid service. Paid calls are not allowed in the refresh.
- https://www.leanderisd.org/terms-of-use/ returned 404 at 5:45 PM, and https://www.leanderisd.org/website/ (5:46 PM) has no copyright or reuse terms. Nothing found grants commercial reuse.

### City of Leander (leandertx.gov)

- https://www.leandertx.gov/, /terms-of-use and /disclaimer all returned HTTP 403 at 5:45 PM. The terms could not be read. No retries or workarounds were used.

### Leander ISD calendar ICS

- https://www.leanderisd.org/calendar/ (5:46 PM) offers an "iCal URL" for each calendar, which is an offer to subscribe, not a grant to republish commercially.
- Google Terms of Service, https://policies.google.com/terms?hl=en-US (5:47 PM), "Abuse of our services" list: no "using automated means to access content from any of our services in violation of the machine-readable instructions on our web pages (for example, robots.txt files...)". calendar.google.com's robots.txt disallows "/".

## Manual submitted listings

This is the permitted path for jobs and events while the feeds are paused.

1. The employer or organizer sends the listing and confirms they own it or may share it.
2. Add it to `src/data/submitted-listings.json`. The fields are in `docs/submitted-listings.schema.json`.
3. Run `npm run validate:listings`. It must print "submitted-listings.json is valid".
4. Listings drop out after `expiresAt`.

The site does not render submitted listings yet. That UI must use UIARC, which is not installed in this repo, so this change is data and docs only.

## Scheduler change for Samantha

This PR does not touch Muse's external scheduler. Needed change: keep LEANDER_ENABLE_NEOGOV, LEANDER_ENABLE_GOOGLE_NEWS, LEANDER_ENABLE_FIRECRAWL, LEANDER_ENABLE_LEANDERTX and LEANDER_ENABLE_LISD_ICS unset. Run `npm run validate:listings` before the build, and stop the deploy if it fails. Commit `src/data/source-status.json` along with the other data files.
