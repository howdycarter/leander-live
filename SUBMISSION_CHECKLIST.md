# SUBMISSION_CHECKLIST.md — Convex "All Gas" Hackathon

Deadline: **September 22, 2026 at 12:00 PM PT**. Nothing below is submitted
until Chris says so.

## Requirements

- [ ] **Luma registration** — register for the hackathon on Luma (NOT done)
- [ ] **Public GitHub repo** — https://github.com/howdycarter/leander-live ✅ (public)
- [ ] **Live `*.convex.site` URL** — blocked on `npx convex login` (needs Chris)
- [ ] **Build log** — `hackathon.md` in repo ✅ (keep updating)
- [x] **Under-3-minute demo video** — recorded 2026-09-19: `demo/leander-live-demo.mp4` (82s, narrated). Beats: event feed + Music filter, submit-event moderation, reminder signup with SMS opt-in, architecture slide.
- [ ] **Sponsor tags** — all three sponsors do real work:
  - OpenAI: event blurbs (`summarize.ts`), chat bot + lead extraction (`chat.ts`),
    voice agent (Realtime via `voice-bridge/`) ✅ code-complete, key-gated
  - Firecrawl: weekly crawl of visitleandertx.com + leandertx.gov (`ingestion.ts`) ✅ code-complete, key-gated
  - AgentMail: emailed event submissions via Svix-verified webhook (`http.ts`) ✅ code-complete, key-gated
- [ ] **vibeapps.dev submission** — https://vibeapps.dev/judging/convex-all-gas-hackathon-openai/submit?utm_source=luma (NOT submitted)

## Before submitting

1. `npx convex login` (Chris, interactive) → `npx convex dev` → real codegen
2. Set env keys: `FIRECRAWL_API_KEY`, `AGENTMAIL_*`, `OPENAI_API_KEY`, `ADMIN_KEY`,
   `TWILIO_AUTH_TOKEN`, `TWILIO_STREAM_URL`, `TWILIO_PUBLIC_URL`, `LEAD_INGEST_SECRET`
   (see PHONE_BOT_SETUP.md)
3. `npm run deploy` → verify live URL → `VITE_CONVEX_URL` → seed events
4. Record demo video (<3 min)
5. Chris approves launch copy (LAUNCH_POST.md) — optional social proof
6. Submit at the vibeapps.dev link above before Sep 22, 12:00 PM PT
