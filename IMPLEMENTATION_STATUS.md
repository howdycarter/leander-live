# Leander Live implementation status

October 11, 2026. Repository main was verified at `db7df483d7fe773afe5dda4e1bdb3ee71fa43f4a` before this work.

## Implemented and locally verified

- A public guide that does not require Convex credentials. It has a held event-source snapshot, source-check and refresh deadlines, automatic client-side stale/expired hiding, official calendar links, and an existing Howdy Carter booking handoff with the fixed `source=leander-live` token. A handoff is not a confirmed appointment or qualified lead.
- Prerendered guide and event-detail HTML, canonical URLs, source-matching Event data, sitemap and robots file. Rebuild after each source review; static HTML retains its explicit checked date between builds. Client-side freshness handling does not replace editorial review.
- Server-side moderation guards reusing the existing `ADMIN_KEY` contract. New crawls, historical seeds and incomplete emails remain pending. Source URL, venue, start/end and source-check confirmation are required for approval; records leave the public feed after their check becomes 48 hours old. AI blurbs remain drafts.
- Central-time display/filter/input handling, including the current Sunday weekend and ambiguous/nonexistent DST inputs.
- A business service request with explicit contact permission, validated contacts, idempotent retry tokens, a honeypot, and a private CRM record marked notification pending. No notification has been sent or verified. Third-party assignment and lead resale are disabled.
- A default-off automation switch and deployment-wide daily call ceiling shared by chat, crawl and summary. Chat cannot save model-inferred contact details or consent. Subscriber delivery and SMS remain held.

## Verification and remaining gates

The initial local checkpoint passed 27 behavior tests, TypeScript and the production build. Review regressions subsequently extend coverage; use the exact commit CI result for the current count. Browser tests could not start Chromium because this executor forbids its process socket; the same browser scenarios are in CI. This is scoped validation, not a general security audit.

Full backend release requires the actual Convex project, official deployment codegen, schema migration checks, and smoke tests with its existing credentials. Checked-in server/API wrappers use the installed Convex templates; the data-model type comes from the local schema and the static-hosting component binding comes from its installed API. None establishes a deployed backend.

The personal hosting project has not been verified. The public .co hosts could not be retrieved from the research environment. The actual hosting project, domain routing and deployed commit must be verified before release. Do not create a replacement account or put this personal project in the unrelated team to work around missing access.

The full Fix is not marked complete until a working public URL, actual booking/inquiry destination, owner receipt and measurement are verified. The 48-hour delivery clock requires an accepted, unblocked start. This implementation work does not fabricate that start or completion.

The broader engagement still needs: a verified analytics property and baseline; a named editorial owner; a tested owner-notification destination; confirmed subscription, suppression/unsubscribe and email provider; an approved operating budget; channel approval before traffic experiments; and real post-launch observations. No sponsorship reach, sales lift, delivered newsletter, collected revenue or lead conversion is claimed.

## Operating the small pilot

Use at most three approved sources and twenty verified records. The current public feed contains no promoted selections: the one detailed city-page snapshot is held pending a fresh check. Its direct fetch returned HTTP 403; other candidate detail pages could not be verified. The default page supplies useful official calendar links. Do not fill the inventory with invented dates or placeholders.

Before enabling any verified-event promotion, establish and verify a rebuild at least every 24 hours, plus a rebuild immediately after any source/status change and before each promotion. Alert the owner if a build is missed; hold verified promotions until the cadence is restored. Static HTML, sitemap and structured data do not expire themselves without a rebuild. This deployment cadence is a release gate and has not been configured.

Before promoting a guide, open each original event page, check cancellations, verify date/time/venue/eligibility, update `checkedAt` and set `reviewDueAt` no more than 48 hours later, rebuild, and verify the deployed version. If a source is unavailable, hold the entry. Budget 2–3 editorial hours weekly initially and measure actual effort.

The included source is the [City of Leander Residential Fall Cleanup page](https://www.leandertx.gov/Calendar.aspx?EID=3158&calType=0&day=2&month=10&year=2026), retrieved as a cached snapshot October 11. The snapshot lists October 17, 8 a.m.–noon Central, Leander Public Works at 607 Municipal Drive, free admission, city-limit residency and matching utility-bill/ID requirements. Check its item/vehicle restrictions before attending. A fresh check is required before promoting this entry. It is omitted from current-feed results, Event markup and the sitemap while held. This is an independent guide, not city sponsorship.

## Measurement definitions

Track resident source/detail actions, the fixed business booking handoff, confirmed appointment, qualified conversation, and collected Howdy service revenue as separate steps. Keep personal details out of analytics. Exclude tests/bots. A qualified conversation requires a real business, an explicit website/follow-up problem, a usable contact method and permission to respond. Unknown denominators remain unmeasured rather than zero conversion.

The first seven-day review starts only after verified release and measurement. The 30-day engagement report should include denominators, changes, source freshness, editorial time, delivery failures, tool cost and limitations. Audience-building and revenue outcomes require actual observation.
