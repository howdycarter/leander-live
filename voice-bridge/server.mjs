/**
 * Leander Live voice bridge — Twilio Media Streams <-> OpenAI Realtime API.
 *
 * Twilio sends a WebSocket here when someone calls the Leander Live number
 * (see the /twilio/voice webhook in convex/http.ts, which returns TwiML with
 * <Stream url="wss://<this bridge>/">). This server:
 *   1. Opens an OpenAI Realtime voice session with a lead-qualification prompt.
 *   2. Pipes caller audio (g711 ulaw) to OpenAI and agent audio back to Twilio.
 *   3. Uses a `save_lead` function tool to capture qualified leads in real time.
 *   4. Enforces a hard 8-minute call cap (polite wrap-up at ~7:30, terminate at 8:00).
 *   5. POSTs the transcript + extracted lead to Convex when the call ends.
 *
 * Env:
 *   PORT             - listen port (default 8080)
 *   OPENAI_API_KEY   - required
 *   VOICE_MODEL      - realtime model (default gpt-realtime-2.1-mini; swap freely)
 *   CONVEX_SITE_URL  - e.g. https://abc123.convex.site (no trailing slash)
 *   BRIDGE_SECRET    - must match the Convex LEAD_INGEST_SECRET env var
 *
 * Deploy anywhere that runs Node (Fly.io, Render, a VPS). See PHONE_BOT_SETUP.md.
 */

import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT ?? 8080);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VOICE_MODEL = process.env.VOICE_MODEL ?? "gpt-realtime-2.1-mini";
const CONVEX_SITE_URL = (process.env.CONVEX_SITE_URL ?? "").replace(/\/$/, "");
const BRIDGE_SECRET = process.env.BRIDGE_SECRET;

// Budget guardrail: hard 8-minute cap per call (Chris approved).
const CALL_CAP_MS = 8 * 60 * 1000;
const WRAP_UP_AT_MS = 7.5 * 60 * 1000;

if (!OPENAI_API_KEY || !CONVEX_SITE_URL || !BRIDGE_SECRET) {
  console.error(
    "Missing env: OPENAI_API_KEY, CONVEX_SITE_URL and BRIDGE_SECRET are all required.",
  );
  process.exit(1);
}

const AGENT_INSTRUCTIONS = `You are the friendly phone assistant for Leander Live, a community events board in Leander, Texas. Warm, neighborly, concise — never a salesperson.

OPENING (say this first, every call):
"Hi, thanks for calling Leander Live! Just so you know, this call may be recorded. Are you looking for event reminders, or are you a local business interested in our services?"

YOUR JOB: qualify the caller and capture a lead.
- For EVENT REMINDERS: get their name and an email or phone number, plus what kinds of events they like (families, food & drink, home & garden, nightlife, arts & culture). If they want TEXT reminders, confirm explicitly: "Is it OK if we text you event reminders at this number? Message and data rates may apply; reply STOP to opt out." Only proceed if they agree.
- For BUSINESSES: get their name, the business name, a callback number or email, what they need (featured listing, buying leads, sponsored event), and the business type (home services, real estate, restaurant/food, health & wellness, events/venues, other).

RULES:
- Keep every response to 1-2 short sentences. This is a phone call, not a lecture.
- Ask one question at a time.
- When you have the caller's NAME and what they NEED, call the save_lead function right away, then confirm warmly ("Thanks, {name}! We've got you down — anything else?").
- Never invent events or make promises about pricing. If asked something you don't know, say so and offer to have someone follow up.
- If the caller wants to end the call, say a warm goodbye immediately.`;

async function postToConvex(path, body) {
  try {
    const res = await fetch(`${CONVEX_SITE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-secret": BRIDGE_SECRET,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error(`Convex ${path} failed:`, res.status, await res.text());
  } catch (err) {
    console.error(`Convex ${path} error:`, err.message);
  }
}

function handleCall(twilioWs) {
  let streamSid = null;
  let callSid = null;
  let from = "unknown";
  let to = "";
  let openaiWs = null;
  let sessionReady = false;
  const audioQueue = [];
  const transcript = [];
  let leadSaved = false;
  let finalized = false;

  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => timers.forEach(clearTimeout);

  function sendToOpenAI(msg) {
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(JSON.stringify(msg));
    }
  }

  function finalize(reason) {
    if (finalized) return;
    finalized = true;
    clearTimers();
    try {
      openaiWs?.close();
    } catch {}
    const text = transcript.join("\n").slice(0, 20000);
    console.log(`Call ${callSid} ended (${reason}). Transcript lines: ${transcript.length}`);
    postToConvex("/twilio/call-log", { callSid, from, to, transcript: text }).finally(() => {
      try {
        twilioWs.close();
      } catch {}
    });
  }

  // --- 8-minute budget cap -------------------------------------------------
  later(WRAP_UP_AT_MS, () => {
    sendToOpenAI({
      type: "response.create",
      response: {
        instructions:
          "We are nearly out of time on this call. Wrap up politely in one short sentence, thank the caller, and say goodbye. Do not ask any new questions.",
      },
    });
  });
  later(CALL_CAP_MS, () => {
    console.log(`Call ${callSid} hit the 8-minute cap — terminating.`);
    finalize("8-minute cap");
  });

  // --- OpenAI Realtime session ---------------------------------------------
  function connectOpenAI() {
    openaiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=${VOICE_MODEL}`, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    openaiWs.on("open", () => {
      openaiWs.send(
        JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: AGENT_INSTRUCTIONS,
            voice: "marin",
            input_audio_format: "g711_ulaw",
            output_audio_format: "g711_ulaw",
            input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
            turn_detection: { type: "server_vad" },
            tools: [
              {
                type: "function",
                name: "save_lead",
                description:
                  "Save a qualified lead the moment you have the caller's name and what they need.",
                parameters: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Caller's full name" },
                    phone: { type: "string", description: "Callback number, if given" },
                    need: {
                      type: "string",
                      description:
                        "What they want: event reminders (with interests) or business service (featured listing, buy leads, sponsored event)",
                    },
                    vertical: {
                      type: "string",
                      description:
                        "Business type if a business caller: Home Services, Real Estate, Restaurant/Food, Health & Wellness, Events/Venues, Other",
                    },
                  },
                  required: ["name", "need"],
                },
              },
            ],
            tool_choice: "auto",
          },
        }),
      );
    });

    openaiWs.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (msg.type) {
        case "session.created":
        case "session.updated":
          sessionReady = true;
          for (const audio of audioQueue.splice(0)) {
            sendToOpenAI({ type: "input_audio_buffer.append", audio });
          }
          break;

        case "response.audio.delta":
          if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.send(
              JSON.stringify({ event: "media", streamSid, media: { payload: msg.delta } }),
            );
          }
          break;

        case "conversation.item.input_audio_transcription.completed":
          transcript.push(`Caller: ${msg.transcript}`);
          break;

        case "response.audio_transcript.done":
          transcript.push(`Agent: ${msg.transcript}`);
          break;

        case "response.function_call_arguments.done":
          if (msg.name === "save_lead" && !leadSaved) {
            leadSaved = true;
            let args = {};
            try {
              args = JSON.parse(msg.arguments ?? "{}");
            } catch {}
            console.log(`Call ${callSid}: saving lead for ${args.name}`);
            postToConvex("/twilio/lead", {
              callSid,
              name: args.name ?? "Unknown caller",
              phone: args.phone ?? from,
              need: args.need ?? "general inquiry",
              vertical: args.vertical ?? "Other",
            });
          }
          break;

        case "error":
          console.error("OpenAI realtime error:", JSON.stringify(msg).slice(0, 500));
          break;
      }
    });

    openaiWs.on("close", () => finalize("openai closed"));
    openaiWs.on("error", (err) => {
      console.error("OpenAI WS error:", err.message);
      finalize("openai error");
    });
  }

  // --- Twilio media stream ---------------------------------------------------
  twilioWs.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.event) {
      case "connected":
        break;
      case "start":
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        from = msg.start.customParameters?.from ?? msg.start.from ?? "unknown";
        to = msg.start.to ?? "";
        console.log(`Incoming call ${callSid} from ${from} -> ${to}`);
        connectOpenAI();
        break;
      case "media":
        if (sessionReady) {
          sendToOpenAI({ type: "input_audio_buffer.append", audio: msg.media.payload });
        } else {
          audioQueue.push(msg.media.payload);
        }
        break;
      case "stop":
        finalize("twilio stop");
        break;
    }
  });

  twilioWs.on("close", () => finalize("twilio closed"));
  twilioWs.on("error", (err) => {
    console.error("Twilio WS error:", err.message);
    finalize("twilio error");
  });
}

const wss = new WebSocketServer({ port: PORT });
wss.on("connection", (ws) => handleCall(ws));
wss.on("listening", () => {
  console.log(`Leander Live voice bridge listening on :${PORT} (model: ${VOICE_MODEL})`);
});
