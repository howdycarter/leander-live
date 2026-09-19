import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components, internal } from "./_generated/api";

const http = httpRouter();

/**
 * AgentMail inbound webhook: organizers email event submissions to the
 * AgentMail inbox, and they land in `events` with source "email",
 * status "pending" for review.
 *
 * AgentMail signs deliveries Svix-style. Verification uses the webhook's
 * signing secret (starts with "whsec_", shown in the AgentMail console when
 * you create the webhook, or via `agentmail webhooks get`).
 *
 * Setup:
 *   1. Create an inbox at https://agentmail.to (get AGENTMAIL_API_KEY)
 *   2. Create a webhook on the inbox pointing at:
 *        https://<your-deployment>.convex.site/agentmail/inbound
 *      with the `message.received` event type
 *   3. npx convex env set AGENTMAIL_WEBHOOK_SECRET <whsec_...>
 *
 * Docs: https://docs.agentmail.to/webhooks/webhooks-overview
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Verify AgentMail's Svix signature against the exact raw request body. */
async function verifySvix(
  rawBody: string,
  headers: Headers,
  secret: string,
): Promise<boolean> {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Reject stale deliveries (5-minute tolerance).
  const ts = parseInt(svixTimestamp, 10);
  if (Number.isNaN(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;

  const b64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const keyBytes = new Uint8Array(b64.length);
  try {
    const bin = atob(b64);
    for (let i = 0; i < bin.length; i++) keyBytes[i] = bin.charCodeAt(i);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${svixId}.${svixTimestamp}.${rawBody}`),
  );
  const macBytes = new Uint8Array(mac);
  let computed = "";
  for (let i = 0; i < macBytes.length; i++) {
    computed += String.fromCharCode(macBytes[i]);
  }
  computed = btoa(computed);

  return svixSignature
    .split(" ")
    .map((part) => (part.startsWith("v1,") ? part.slice(3) : part))
    .some((sig) => timingSafeEqual(sig, computed));
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

http.route({
  path: "/agentmail/inbound",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
    if (!secret) {
      return json(503, { ok: false, reason: "webhook not configured" });
    }
    const rawBody = await req.text();
    if (!(await verifySvix(rawBody, req.headers, secret))) {
      return json(401, { ok: false, reason: "bad signature" });
    }

    let payload: {
      event_type?: string;
      message?: {
        message_id?: string;
        id?: string;
        thread_id?: string;
        from?: string;
        sender?: string;
        subject?: string;
        text?: string;
        body?: string;
      };
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json(400, { ok: false, reason: "invalid json" });
    }

    // Only inbound mail creates submissions; acks everything else.
    if (payload.event_type !== "message.received") {
      return json(200, { ok: true, ignored: payload.event_type ?? null });
    }

    const svixId = req.headers.get("svix-id") as string;
    const message = payload.message ?? {};
    const { isNew } = await ctx.runMutation(
      internal.events.recordWebhookEvent,
      {
        svixId,
        eventType: payload.event_type,
        messageId: message.message_id ?? message.id,
      },
    );
    if (!isNew) {
      return json(200, { ok: true, deduped: true });
    }

    await ctx.runMutation(internal.events.insertFromEmail, {
      from: message.from ?? message.sender ?? "unknown",
      subject: message.subject ?? "(no subject)",
      body: message.text ?? message.body ?? "",
      messageId: message.message_id ?? message.id,
    });
    return json(200, { ok: true });
  }),
});

// Serve the Vite SPA from Convex static hosting (root, SPA fallback).
registerStaticRoutes(http, components.staticHosting, {
  pathPrefix: "/",
  spaFallback: true,
});

// ---------------------------------------------------------------------------
// Phone bot (Twilio + OpenAI Realtime via the voice bridge in voice-bridge/)
// ---------------------------------------------------------------------------

/**
 * Validate Twilio's X-Twilio-Signature: HMAC-SHA1 (base64) of the full
 * request URL plus sorted POST params, keyed with the auth token.
 */
async function validateTwilio(
  req: Request,
  path: string,
  authToken: string,
): Promise<boolean> {
  const signature = req.headers.get("X-Twilio-Signature");
  if (!signature) return false;
  const publicUrl = process.env.TWILIO_PUBLIC_URL;
  if (!publicUrl) return false;
  const url = `${publicUrl}${path}`;

  const raw = await req.text();
  const params = new URLSearchParams(raw);
  const keys = Array.from(new Set(Array.from(params.keys()))).sort();
  let signed = url;
  for (const k of keys) {
    for (const value of params.getAll(k)) signed += k + value;
  }

  const keyBytes = new TextEncoder().encode(authToken);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signed),
  );
  const bytes = new Uint8Array(mac);
  let computed = "";
  for (let i = 0; i < bytes.length; i++) computed += String.fromCharCode(bytes[i]);
  return timingSafeEqual(signature, btoa(computed));
}

/** Twilio voice webhook: answer the Leander Live number with a media stream. */
http.route({
  path: "/twilio/voice",
  method: "POST",
  handler: httpAction(async (_ctx, req) => {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const streamUrl = process.env.TWILIO_STREAM_URL;
    if (!authToken || !streamUrl) {
      return new Response("phone bot not configured", { status: 503 });
    }
    if (!(await validateTwilio(req, "/twilio/voice", authToken))) {
      return new Response("bad twilio signature", { status: 403 });
    }
    const twiml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Response><Connect><Stream url="${streamUrl}"/></Connect></Response>`;
    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  }),
});

function requireBridgeSecret(req: Request): boolean {
  const expected = process.env.LEAD_INGEST_SECRET;
  const got = req.headers.get("x-bridge-secret");
  return !!expected && !!got && timingSafeEqual(got, expected);
}

/** Voice bridge → Convex: save a lead extracted from a call. */
http.route({
  path: "/twilio/lead",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!requireBridgeSecret(req)) {
      return json(401, { ok: false, reason: "bad bridge secret" });
    }
    const body = (await req.json()) as {
      callSid?: string;
      name?: string;
      phone?: string;
      need?: string;
      vertical?: string;
    };
    if (!body.callSid || !body.name) {
      return json(400, { ok: false, reason: "callSid and name required" });
    }
    const leadId = await ctx.runMutation(internal.leads.insertCallLead, {
      callSid: body.callSid,
      name: body.name,
      phone: body.phone,
      need: body.need ?? "general inquiry",
      vertical: body.vertical ?? "Other",
    });
    return json(200, { ok: true, leadId });
  }),
});

/** Voice bridge → Convex: persist the call transcript. */
http.route({
  path: "/twilio/call-log",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!requireBridgeSecret(req)) {
      return json(401, { ok: false, reason: "bad bridge secret" });
    }
    const body = (await req.json()) as {
      callSid?: string;
      from?: string;
      to?: string;
      transcript?: string;
    };
    if (!body.callSid) {
      return json(400, { ok: false, reason: "callSid required" });
    }
    const id = await ctx.runMutation(internal.leads.logCall, {
      callSid: body.callSid,
      from: body.from ?? "unknown",
      to: body.to,
      transcript: body.transcript ?? "",
    });
    return json(200, { ok: true, id });
  }),
});

export default http;
