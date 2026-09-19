# Leander Live voice bridge

Tiny Node WebSocket service that connects **Twilio Media Streams** to the
**OpenAI Realtime API** for the Leander Live phone bot.

Why a separate service? Convex HTTP actions are request/response only — a
persistent WebSocket server for Twilio's bidirectional media stream can't live
inside `convex/http.ts`. The Convex side holds the real business logic
(`POST /twilio/voice` answers the call with TwiML, `POST /twilio/lead` and
`POST /twilio/call-log` persist leads + transcripts); this bridge only moves
audio and function calls between Twilio and OpenAI.

## Run

```bash
cd voice-bridge
npm install
OPENAI_API_KEY=sk-... \
VOICE_MODEL=gpt-realtime-2.1-mini \
CONVEX_SITE_URL=https://<your-deployment>.convex.site \
BRIDGE_SECRET=<same value as Convex LEAD_INGEST_SECRET> \
npm start
```

`VOICE_MODEL` is the cheap mini realtime tier (swappable via env — never run
the full-size realtime model here). `BRIDGE_SECRET` must exactly match the
`LEAD_INGEST_SECRET` env var on the Convex deployment.

## Deploy

Anywhere Node runs — Fly.io, Render, a VPS. It needs a public `wss://` URL,
which becomes `TWILIO_STREAM_URL` on the Convex deployment, e.g.:

```
TWILIO_STREAM_URL=wss://voice-bridge.example.com/
```

See `../PHONE_BOT_SETUP.md` for the full end-to-end checklist.

## Behavior

- Answers each call with a lead-qualification voice agent (OpenAI Realtime).
- Every call opens with the recording disclosure: *"this call may be recorded."*
- Captures name / need / business vertical via the `save_lead` function tool and
  POSTs it to Convex in real time.
- **Hard 8-minute cap:** polite wrap-up at ~7:30, session terminated at 8:00.
- On call end, POSTs the full transcript to Convex (`callLogs` table).
