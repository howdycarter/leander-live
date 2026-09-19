# PHONE_BOT_SETUP.md — Leander Live phone bot (Twilio + OpenAI Realtime)

Inbound calls to the Leander Live number are answered by an AI voice agent that
qualifies callers (event reminders vs. local business), captures leads, and saves
the transcript + extracted lead to Convex. Every call opens with the recording
disclosure: *"this call may be recorded."*

## Architecture

```
Caller → Twilio number → POST https://<deployment>.convex.site/twilio/voice
  → TwiML <Connect><Stream url="wss://<voice-bridge>/">     (convex/http.ts)
  → voice-bridge (Node, voice-bridge/server.mjs)
      → OpenAI Realtime session (VOICE_MODEL, lead-qualification prompt)
      → audio piped both ways (g711 μ-law)
      → save_lead function calls → POST /twilio/lead  (shared secret)
      → transcript → POST /twilio/call-log             (shared secret)
```

Convex HTTP actions are request/response only, so the persistent WebSocket for
Twilio Media Streams lives in the tiny `voice-bridge/` Node service. All lead
data lands in Convex (`businessLeads` source=`phone`, `callLogs`).

## Exact setup steps

### 1. OpenAI
- Create an API key at https://platform.openai.com/api-keys (see BUDGET_SETUP.md
  for the $200 spending limit + $50 alert).
- Confirm the current mini realtime model name in the docs; the default is
  `gpt-realtime-2.1-mini` (set `VOICE_MODEL` to swap — never use a full-size
  realtime model here).
- `npx convex env set OPENAI_API_KEY <key>` (also used by chat + blurbs).

### 2. Deploy the voice bridge
Anywhere Node 18+ runs (Fly.io, Render, VPS):
```bash
cd voice-bridge && npm install
OPENAI_API_KEY=sk-... \
VOICE_MODEL=gpt-realtime-2.1-mini \
CONVEX_SITE_URL=https://<deployment>.convex.site \
BRIDGE_SECRET=<long-random-string> \
npm start
```
Note the public `wss://` URL, e.g. `wss://voice-bridge.example.com/`.

### 3. Convex env vars
```bash
npx convex env set TWILIO_AUTH_TOKEN <twilio-auth-token>
npx convex env set TWILIO_STREAM_URL wss://voice-bridge.example.com/
npx convex env set TWILIO_PUBLIC_URL https://<deployment>.convex.site
npx convex env set LEAD_INGEST_SECRET <same-long-random-string-as-BRIDGE_SECRET>
```
(`TWILIO_ACCOUNT_SID` / `TWILIO_PHONE_NUMBER` are recorded for reference;
signature validation uses the auth token.)

### 4. Buy a Twilio number
- https://console.twilio.com → Phone Numbers → Buy a number (local, 512 area
  code for Leander). ~$1–2/mo + per-minute usage.
- On the number's **Voice Configuration**: webhook
  `https://<deployment>.convex.site/twilio/voice`, HTTP POST.

### 5. Test
- Call the number. The agent opens with the recording disclosure and qualifies
  you; say you're a business to exercise `save_lead`.
- Check Convex: `callLogs` (transcript) and `businessLeads` (source=`phone`).
- Confirm the 8-minute cap: wrap-up prompt at ~7:30, termination at 8:00.

## Consent posture
- Every call opens with *"this call may be recorded."*
- SMS opt-in is only captured with explicit agreement language (same TCPA copy
  as the web forms).
