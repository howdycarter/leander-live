# PostHog privacy note — APPROVED Nov 2, 2026 (incorporated)

Status: **Approved by Chris Carter Nov 2, 2026** under his "approve for
all" legal/compliance directive. The wording below was incorporated
into the live Privacy Policy (`/privacy`) on Nov 2, 2026, with one
truthfulness adjustment: the policy frames PostHog as active "when
enabled on this site," because the wiring ships keyless (no
`VITE_POSTHOG_KEY` in the build yet) and is additionally gated on the
visitor's analytics consent (see `src/site/consent.ts`). The wiring
itself (PR #24) was merged to the production line the same day.
Still outstanding (owner steps, unchanged): (1) Chris provides the
project key as `VITE_POSTHOG_KEY` in the Vercel project env;
(2) Chris's PostHog billing-limit decision. Until the key is set,
PostHog collects nothing.

Original draft text follows, kept for the record.

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
