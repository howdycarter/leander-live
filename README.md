# Leander Live

A community events, jobs, and city-hall board for Leander, TX — a **static
site** hosted on Vercel at <https://leanderlive.com>. No backend, no accounts,
no database at runtime: all content is scraped into JSON at build time.

## Stack

- **React + Vite + Tailwind** frontend, deployed as static files on Vercel
- **Static JSON data** in `src/data/` — events, jobs, civic meetings, news
- **Node scrapers** in `scripts/` — refresh the JSON from city/chamber/job sources
- **localStorage** — saved events live in the visitor's browser only
- **mailto forms** — event submissions, job postings, and advertiser leads open
  the visitor's email client addressed to the site owner
- **`.ics` downloads** — "Add to Calendar" generates a calendar file client-side

## Setup

```bash
npm install
npm run dev        # Vite dev server
```

## Refreshing data

```bash
npm run scrape     # events + jobs + civic/news → src/data/*.json
npm run build      # rebuild dist/ with the fresh JSON
```

The scrapers are idempotent and tolerant: if a source is down or changes
format, the previous JSON is kept rather than wiped. Anchor events
(`anchor-*` ids in `src/data/events.json`) are hand-curated and always
preserved.

## Deploy

Sourceless static deploy via the Vercel API (project `leander-live`):

```bash
npm run build
python3 ~/workspace/skills/vercel/bin/vercel-deploy-files.py \
  prj_YCLPijwZsHQ0jcodsZLH3EyBceHw dist --target production
```

`public/vercel.json` provides the SPA fallback rewrite (`/(.*)` → `/index.html`)
so client-side routes (`/events`, `/jobs`, `/city-hall`, …) resolve.

> Project settings note: the Vercel project's framework, build, install, and
> output-directory settings must stay empty — the deployment is prebuilt
> static files, and any framework preset makes Vercel try `npm install` on the
> file set and fail the deploy.

## Environment

Optional, build-time only (see `.env.example`):

- `VITE_GA_MEASUREMENT_ID` — Google Analytics 4 measurement ID. The site works
  fine without it.
- `VITE_CONVEX_SITE_URL` — Convex HTTP site for `/businesses` chat
  (`https://<deployment>.convex.site`). When unset, the page still answers from
  the published permit JSON with an honest notice and no model call.

Directory chat (CHR-2355) retrieves from the Convex `directoryBusinesses`
table first, then asks `gpt-4o-mini` (Convex `OPENAI_API_KEY`, never in the
browser) only to phrase those rows. Operator steps, not done in this repo
checkout: `npx convex dev` / deploy, `npx convex env set OPENAI_API_KEY`,
`DIRECTORY_SEED_KEY`, optional `CHAT_MODEL` / `DIRECTORY_CHAT_DAILY_USD`,
then `CONVEX_URL=… DIRECTORY_SEED_KEY=… node scripts/seed-directory.mjs`.

## Retired

The hackathon-era auth, on-site lead chat widget, SMS reminders, and voice
bridge are gone. Setup docs (`PHONE_BOT_SETUP.md`, `BUDGET_SETUP.md`,
`SUBMISSION_CHECKLIST.md`, `hackathon.md`) describe that retired stack and
are kept for history only.

`convex/` is back only for `/businesses` directory chat (HTTP action +
permit-row tables). The Vite app does not import `convex/_generated`;
`npm run build` still works from a fresh clone with no Convex login. Seed
and OpenAI env stay on the Convex deployment, not in the static site.
