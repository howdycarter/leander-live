# PostHog privacy note — DRAFT (Chris must approve before anything ships)

Status: **DRAFT — not live, not merged.** This is the proposed addition to
the Leander Live Privacy Policy (`/privacy`, `PrivacyPage` in
`src/site/pages.tsx`) if/when the PostHog wiring in `src/site/posthog.ts`
is approved, merged, and deployed with a real `VITE_POSTHOG_KEY`.

## Proposed policy text (for the "Information we collect" list)

> **Product analytics (PostHog).** We use PostHog to understand, in
> aggregate, how the board is used — which pages are visited and which
> listing actions are taken (for example, clicking an advertising
> package). PostHog is configured on this site to be anonymous: it does
> not know who you are, we never send it your name, email address, phone
> number, or the text you type into search or forms, it does not record
> your screen or session, and it does not track clicks automatically —
> only the specific actions listed above are reported. Page addresses
> are sent without their query strings. If your browser sends a
> Do Not Track signal, PostHog is not loaded at all.

## What the code actually collects (verifiable in src/site/posthog.ts)

Collected, only when a project key is configured at build time:

- `$pageview` on each in-app route change — **pathname only**
  (e.g. `/events`), never the query string or hash.
- Explicit app events mirrored from `trackEvent()` — today that is
  `advertise_cta_clicked` with a package id (e.g. `featured-listing`).
  Properties pass through a sanitizer first (see below).

NOT collected — enforced in code, not just promised:

- **No identity:** `person_profiles: "never"`; there is no `identify()`
  call anywhere in the app. Events are anonymous.
- **No autocapture:** `autocapture: false` — no automatic click, input,
  or form tracking.
- **No session recording / heatmaps:** `disable_session_recording: true`,
  surveys disabled.
- **No PII in properties:** `sanitizeProps()` drops any property whose
  key looks like email/name/phone/address/password/token/secret/SSN/user
  id, drops string values that look like email addresses, and reduces
  URL-like values to their pathname.
- **No search terms:** the Events page search lives in the `?q=` query
  string, which is stripped before any PostHog capture.
- **Do Not Track honored:** if the browser reports DNT, PostHog is never
  initialized.

## Decisions Chris still owns

1. Approve (or edit) the policy text above before it is added to
   `/privacy` — the wiring PR intentionally does **not** change the live
   privacy page.
2. Provide the project key (PostHog → Project 700301 → Project Settings →
   Project API Key) as `VITE_POSTHOG_KEY` in the Vercel project env —
   the code ships keyless and no-ops until then.
3. Billing limits for the PostHog project (a ~$160/mo cap was proposed
   in the Oct 31 startup-credits work) — a PostHog billing decision,
   not set by this code.
4. Merge + deploy approval for the draft PR itself.
