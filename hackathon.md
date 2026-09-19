# hackathon.md — Leander Live build log

> What judges read: what was built, the stack, the live URL, the demo link.

## What it is

**Leander Live** — a real-time community events board for Leander, Texas.
An everyday app a local would actually open this week: browse what's on,
submit your own event from your phone, get reminders, and (for local
businesses) buy into a lead pipeline that routes community demand to them.

## What was built

- **Event feed** — Convex query `listUpcoming` (approved + upcoming, soonest
  first) with live updates; search + date + category filters; save-to-favorites.
- **Community submit** — Convex mutation `submit` with validation; submissions
  land as `pending` for review. Presented as a shadcn Dialog.
- **Two-sided lead capture** — `subscribers` (event reminders, TCPA-compliant
  SMS opt-in) and `businessLeads` (business name/contact/vertical/interests),
  all validated server-side.
- **Chat bot** (OpenAI) — on-site shadcn chat widget backed by the public
  `chat.chatReply` action: converses, determines intent (reminders vs.
  business), extracts structured leads via a hidden `<!--LEAD {...}-->` block,
  writes to Convex. Graceful fallback when `OPENAI_API_KEY` is missing.
  Budget-hardened: cheap model only (`CHAT_MODEL`, default `gpt-4o-mini`),
  300-token cap, 20-req/10-min per-session rate limit, per-session token usage
  logged to `chatSessions`.
- **Phone bot** (Twilio + OpenAI Realtime) — inbound calls answered via
  `POST /twilio/voice` (Twilio-signature-verified TwiML → media stream) into
  the `voice-bridge/` Node service: realtime voice session with a
  lead-qualification prompt, `save_lead` function tool, transcript + lead saved
  to Convex (`callLogs`, `businessLeads` source=`phone`). Opens every call with
  the recording disclosure. Hard 8-minute cap; `VOICE_MODEL` env-swappable mini
  realtime tier. Setup: `PHONE_BOT_SETUP.md`.
- **Lead pipeline + mini-CRM** — `businessLeads` carries source
  (form/chat/phone), status (`new → contacted → qualified → sold → closed`),
  assigned business, sale price, notes. `/admin/leads` route (SPA fallback):
  pipeline board with stage columns, lead detail Sheet (move stage, assign to a
  business, mark sold with price, notes), `businesses` table with vertical
  matching so leads route to the right business. Gated by `ADMIN_KEY`
  (fail-closed shared secret; Convex Auth is the documented post-hackathon
  follow-up).
- **Firecrawl ingestion** — weekly scheduled action (`crawlLeander`, Mondays
  8am CT) calls `v2/extract` on visitleandertx.com + leandertx.gov, polls to
  completion, validates future dates, dedupes, schedules OpenAI blurbs. Env:
  `FIRECRAWL_API_KEY`.
- **AgentMail inbox** — `POST /agentmail/inbound` verifies Svix signatures
  (HMAC-SHA256, 5-min tolerance, idempotent delivery IDs), parses emailed event
  submissions into `pending` events. Env: `AGENTMAIL_API_KEY`,
  `AGENTMAIL_INBOX`, `AGENTMAIL_WEBHOOK_SECRET`.
- **OpenAI blurbs** — `summarizeEvent` writes a ≤140-char "why go" line per
  event (`gpt-4o-mini`, 60-token cap). Env: `OPENAI_API_KEY`.
- **Design system** — Tailwind CSS v4 + shadcn (`components.json`,
  `@/components/ui/*`, `cn()` util). Tokens sampled from the **real City of
  Leander logo** (leandertx.gov/ImageRepository/Document?documentID=71):
  river blue `#215ba3` (primary), hill green `#47704c` (secondary), star gold
  `#deae49` (accent). The orange/cream mockup palette was ChatGPT's invention
  and was discarded. The city is mid brand-definition (CivicBrand, 2025–2026),
  so colors reflect current official art — noted in `SOURCES.md`.
- **Authenticity** — every Leander claim (About, seed events, footer, chat
  knowledge) traced to the research pack; `SOURCES.md` lists each claim's
  source. No official city motto exists — "All Aboard Leander." is presented
  explicitly as the app's tagline, never the city's.
- **Convex static hosting** — `@convex-dev/static-hosting` serves the Vite SPA
  from the deployment's `*.convex.site` URL (SPA fallback on).

## Stack

Convex (schema + queries + mutations + actions + crons + HTTP routes),
React 18 + Vite 5, TypeScript, Tailwind CSS v4, shadcn, lucide-react,
`@convex-dev/static-hosting`, Firecrawl, AgentMail, OpenAI (chat + Realtime),
Twilio (voice). Built with Muse.

## Business model (hackathon slice)

Two-sided: residents subscribe for reminders (SMS opt-in, TCPA copy); local
businesses submit interest and get worked through a real pipeline —
new → contacted → qualified → sold → closed — with vertical-matched assignment
and priced sales. The mini-CRM is the working slice of a bigger lead
marketplace; email sequences and automation come after the hackathon.

## Genuine vs key-gated

All sponsor integrations are real, working code — key-gated until keys exist:
OpenAI (blurbs, chat, voice — needs `OPENAI_API_KEY`), Firecrawl (needs
`FIRECRAWL_API_KEY`, 20k free participant credits), AgentMail (needs
`AGENTMAIL_*`; webhook signature verification is live code), Twilio (needs
`TWILIO_*`; TwiML + signature validation is live code). Without keys the app
runs fully on Convex with graceful fallbacks (chat shows a fallback message;
ingestion/summarizer skip; phone webhook returns 503).

## Live URL

`https://adventurous-ostrich-311.convex.site`

_Deployed 2026-09-19 via `npm run deploy` (Convex backend + static hosting). Backend data verified live (events:listUpcoming returns seeded events)._

## Demo video

_TODO — record <3 min clickthrough before Sep 22, 12:00 PM PT._ Shot list in
`LAUNCH_POST.md`.

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
  events.
- **2026-09-19** — Repo public at https://github.com/howdycarter/leander-live.
  Linear: CHR-1470 (parent, done) → CHR-1471…CHR-1478. `tsc --noEmit` clean
  except `./_generated/*` (produced by `npx convex dev` after login).
- **2026-09-19** — Real integrations: Firecrawl `v2/extract` + polling,
  AgentMail Svix verification, OpenAI blurbs, category support, dedupe,
  idempotency. Two-sided lead capture (`subscribers`, `businessLeads`) with
  server validation + TCPA SMS copy. Warm mockup-styled UI (later replaced —
  see below).
- **2026-09-19** — Chat bot: `convex/chat.ts` (`chatReply` action, OpenAI chat
  completions, hidden `<!--LEAD>` extraction block → validated mutations,
  graceful no-key fallback) + on-site chat widget. Phone bot: Twilio webhook
  routes in `convex/http.ts` (signature-verified TwiML, `/twilio/lead`,
  `/twilio/call-log`), `voice-bridge/` Node service (Media Streams ↔ OpenAI
  Realtime, `save_lead` function tool, 8-min cap), `PHONE_BOT_SETUP.md`.
  Every call opens with the recording disclosure.
- **2026-09-19** — Budget lock ($200 OpenAI): cheap models only
  (`gpt-4o-mini` chat/blurbs, mini realtime voice via `VOICE_MODEL`), token
  caps, 20-req/10-min chat rate limit, per-session token usage in
  `chatSessions`, 8-minute phone cap. `BUDGET_SETUP.md` has the exact dashboard
  steps ($200 hard limit, $50 alert).
- **2026-09-19** — Lead pipeline + mini-CRM: `businessLeads` extended (source,
  status, assigned business, sale price, notes), `businesses` table with
  vertical matching, `convex/crm.ts` (`ADMIN_KEY`-gated), ``/admin/leads``
  pipeline board + lead detail + businesses tab. Subtle howdycarter.com
  cross-promo (footer, About, one business-section card).
- **2026-09-19** — Color correction + design system rebuild: discarded the
  ChatGPT mockup palette (unverified invention). Fetched the real city header
  logo (leandertx.gov/ImageRepository/Document?documentID=71, verified live),
  sampled dominant colors (river blue #215ba3, hill green #47704c, star gold
  #deae49), set them as shadcn/Tailwind v4 tokens. Rebuilt all surfaces on
  shadcn (ui/*, dialogs, sheets, tables, tabs). Authenticity audit: About fixed
  to "10,000–13,000-year-old"; footer motto replaced with the app tagline
  "All Aboard Leander." (explicitly the app's, not the city's); `SOURCES.md`
  added tracing every claim.
- **2026-09-19** — BLOCKED: `npx convex login` needs an interactive terminal
  (browser OAuth) — Chris runs it, then `npx convex dev` (real codegen),
  env keys, `npm run deploy`, seed, verify. Local `tsc --noEmit` is clean;
  `npm run build` additionally needs the real generated `api.js` (login step).
