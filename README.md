# Leander Live

A real-time community events board for Leander, TX — built for the
[Convex All Gas Hackathon](https://luma.com/convex-allgas-hackathon)
(sponsored by OpenAI, Firecrawl, and AgentMail).

Anyone can browse the live event feed; organizers submit events via the web
form or by emailing the AgentMail inbox. A weekly Firecrawl crawl pulls in
city/chamber listings, and OpenAI writes one-line "why go" blurbs.

## Stack

- **Convex** — database, queries, mutations, real-time sync, scheduled actions,
  HTTP routes (schema in `convex/schema.ts`)
- **React + Vite** frontend, hosted on Convex static hosting (`*.convex.site`)
- **Firecrawl** — weekly crawl of Leander event pages (`convex/ingestion.ts`)
- **AgentMail** — email inbox for organizer submissions (`convex/http.ts`)
- **OpenAI** — event summary blurbs (`convex/summarize.ts`)

## Setup

```bash
npm install
npx convex dev        # first run: logs you in, provisions the project, writes .env.local
npm run dev           # Vite dev server (Convex runs alongside via `convex dev`)
```

Copy `.env.example` values into Convex when ready:

```bash
npx convex env set FIRECRAWL_API_KEY <key>        # https://www.firecrawl.dev (20k free credits for participants)
npx convex env set AGENTMAIL_API_KEY <key>        # https://agentmail.to
npx convex env set AGENTMAIL_INBOX <inbox>        # e.g. events@agentmail.to
npx convex env set AGENTMAIL_WEBHOOK_SECRET <s>   # shared webhook secret
npx convex env set OPENAI_API_KEY <key>           # https://platform.openai.com
```

Then point the AgentMail inbox webhook at
`https://<your-deployment>.convex.site/agentmail/inbound`.

Seed the anchor annual events (idempotent — skips if the table has rows):

```bash
npx convex run seed:seedAnchorEvents
```

## Deploy

```bash
npx convex login                  # first time only (opens convex.dev in your browser)
npm run deploy                    # builds frontend + deploys backend + uploads dist/
```

The app goes live at `https://<your-deployment>.convex.site`.

Two-step alternative:

```bash
npx convex deploy
npm run deploy:static
```

## Hackathon checklist

- [x] Public repo, new app started after Aug 25
- [x] Convex backend: schema, queries, mutations, real-time sync, crons
- [x] Sponsor stack wired: Firecrawl ingestion, AgentMail inbox, OpenAI summaries
- [x] `hackathon.md` build log
- [ ] `npx convex login` + `npm run deploy` → live `*.convex.site` URL
- [ ] Firecrawl / AgentMail / OpenAI keys set via `npx convex env set`
- [ ] Register on Luma (needs Chris)
- [ ] Post build on X/LinkedIn tagging @convex @OpenAI @firecrawl @agentmail (needs Chris's approval)
- [ ] Record <3 min clickthrough demo
- [ ] Submit at vibeapps.dev before Sep 22, 12:00 PM PT (needs Chris)
