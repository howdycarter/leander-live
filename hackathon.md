# hackathon.md — Leander Live build log

> What judges read: what was built, the stack, the live URL, the demo link.

## What it is

**Leander Live** — a real-time community events board for Leander, Texas.
An everyday app a local would actually open this week: browse what's on,
submit your own event from your phone, and get city listings pulled in
automatically.

## What was built

- **Real-time event feed** — Convex query `listUpcoming` (approved + upcoming,
  soonest first) with live updates; mobile-friendly dark UI.
- **Community submit form** — Convex mutation `submit` with validation;
  submissions land as `pending` for review.
- **Firecrawl ingestion** — weekly scheduled action (`crawlLeander`, Mondays
  8am CT) stubbed to crawl Leander city/chamber event pages; parsed listings
  insert with source `crawl`. Env: `FIRECRAWL_API_KEY`.
- **AgentMail inbox** — HTTP route `POST /agentmail/inbound` receives emailed
  event submissions, inserts with source `email`, status `pending`. Env:
  `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX`, `AGENTMAIL_WEBHOOK_SECRET`.
- **OpenAI summaries** — action `summarizeEvent` generates a one-line "why go"
  blurb per event (Convex AI Gateway noted as the keyless alternative, but it
  needs a paid Convex team). Env: `OPENAI_API_KEY`.
- **Convex static hosting** — `@convex-dev/static-hosting` component serves
  the Vite SPA from the deployment's `*.convex.site` URL (SPA fallback on).

## Stack

Convex (schema + queries + mutations + actions + crons + HTTP routes),
React 18 + Vite 5, TypeScript, `@convex-dev/static-hosting`, Firecrawl,
AgentMail, OpenAI. Built with Codex (OpenAI coding agent) + Muse.

## Live URL

_TODO — after `npx convex login` + `npm run deploy`:_
`https://<deployment>.convex.site`

## Demo video

_TODO — record <3 min clickthrough before Sep 22, 12:00 PM PT._

## Log

- **2026-09-19** — Scaffolded repo: Convex schema/functions (events, ingestion,
  inbox webhook, summarizer, crons, static hosting), Vite + React feed UI with
  submit form, README, `.env.example`. Sponsor integrations stubbed behind env
  keys; awaiting Convex login to provision + deploy.
- **2026-09-19** — Content pass from Leander research: About section (1882
  railroad founding, "Catfish" Brown, Leanderthal Lady, lee-AN-der, 59,202 →
  ~91,132 growth story), original train-town SVG mark (city is mid-rebrand —
  not official art), taglines ("All Aboard Leander." hero, "10,000 years in
  the making." footer), and `convex/seed.ts` with 8 verified anchor annual
  events (ArtFest, Floating Pumpkin Patch, Spooktacular, Veterans Day,
  Old Town Christmas, Kite Festival, Old Town Street Festival, Liberty Fest).
