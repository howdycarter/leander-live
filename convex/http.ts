import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  DEFAULTS as CHAT_DEFAULTS,
  chicagoDay,
  composeAnswer,
  envInt,
  normalizeQuestion,
  phraseWithLlm,
  runMatch,
  sanitizeContext,
  sha256Hex,
  toResponseBody,
  type BizRecord,
} from "./businessChat";

const http = httpRouter();

const DATASETS = new Set([
  "events",
  "jobs",
  "civic",
  "news",
  "businesses",
  "source-status",
]);

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// POST /ingest — Dragon Automation pipeline write path.
// Header: x-ll-ingest-secret must match the LL_INGEST_SECRET env var.
// Body: { dataset, records: [...], runId, startedAt }
http.route({
  path: "/ingest",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.LL_INGEST_SECRET;
    if (!secret || req.headers.get("x-ll-ingest-secret") !== secret) {
      return new Response("unauthorized", { status: 401 });
    }
    let body: {
      dataset?: string;
      records?: unknown[];
      runId?: string;
      startedAt?: number;
    };
    try {
      body = await req.json();
    } catch {
      return new Response("invalid JSON body", { status: 400 });
    }
    if (!body.dataset || !DATASETS.has(body.dataset)) {
      return new Response("unknown dataset", { status: 400 });
    }
    if (!Array.isArray(body.records) || typeof body.runId !== "string") {
      return new Response("records[] and runId are required", { status: 400 });
    }
    const payload = JSON.stringify(body.records);
    const contentHash = await sha256Hex(payload);
    try {
      const result = await ctx.runMutation(internal.ingest.replaceDataset, {
        name: body.dataset,
        payload,
        count: body.records.length,
        contentHash,
        runId: body.runId,
        startedAt:
          typeof body.startedAt === "number" ? body.startedAt : Date.now(),
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ ok: false, error: String(e).slice(0, 500) }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }
  }),
});

// GET /dataset/<name> — public runtime read for the site.
// Returns the exact JSON array the baked src/data files carried, with cache
// headers so a CDN/browser can absorb repeat reads.
http.route({
  pathPrefix: "/dataset/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const name = new URL(req.url).pathname.replace("/dataset/", "");
    if (!DATASETS.has(name)) {
      return new Response("unknown dataset", { status: 404 });
    }
    const data = await ctx.runQuery(internal.content.getDatasetInternal, {
      name,
    });
    if (!data) return new Response("not published yet", { status: 404 });
    return new Response(data.payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
        "X-Dataset-Updated-At": String(data.updatedAt),
        "X-Dataset-Count": String(data.count),
        "X-Dataset-Hash": data.contentHash,
      },
    });
  }),
});

// POST /business-chat — public chat search over the businesses dataset
// (CHR-2355). Abuse controls, cache, deterministic retrieval and the optional
// LLM phrasing layer live in convex/businessChat.ts. The LLM key is a
// server-side env var only; with none set, answers are deterministic.
const CHAT_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function chatJson(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...CHAT_CORS,
    },
  });
}

http.route({
  path: "/business-chat",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CHAT_CORS });
  }),
});

http.route({
  path: "/business-chat",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const rawBody = await req.text();
      if (rawBody.length > 16384) {
        return chatJson({ error: "too_large" }, 413);
      }
      let body: {
        question?: unknown;
        sessionId?: unknown;
        context?: unknown;
      };
      try {
        body = JSON.parse(rawBody) as typeof body;
      } catch {
        return chatJson({ error: "invalid_json" }, 400);
      }
      const question =
        typeof body.question === "string" ? body.question.trim() : "";
      if (!question || question.length > 300) {
        return chatJson(
          {
            error: "bad_question",
            message:
              "Ask a question of up to 300 characters about finding a Leander business.",
          },
          400,
        );
      }
      const sessionId =
        typeof body.sessionId === "string" &&
        /^[A-Za-z0-9-]{8,64}$/.test(body.sessionId)
          ? body.sessionId
          : undefined;
      const context = sanitizeContext(body.context);

      // Rate limits (per-IP and per-session hourly buckets). IPs are hashed
      // before storage; raw addresses are never persisted.
      const forwarded = req.headers.get("x-forwarded-for") ?? "";
      const ip = forwarded.split(",")[0]?.trim() || "unknown";
      const ipHash = await sha256Hex(`ip:${ip}`);
      const hourBucket = Math.floor(Date.now() / 3600000);
      const counts = await ctx.runMutation(
        internal.businessChat.hitRateLimits,
        {
          ipKey: `ip:${ipHash}:${hourBucket}`,
          sessKey: sessionId ? `sess:${sessionId}:${hourBucket}` : undefined,
        },
      );
      const ipLimit = envInt(
        "LL_CHAT_IP_HOURLY_LIMIT",
        CHAT_DEFAULTS.ipHourlyLimit,
      );
      const sessLimit = envInt(
        "LL_CHAT_SESSION_HOURLY_LIMIT",
        CHAT_DEFAULTS.sessionHourlyLimit,
      );
      if (counts.ipCount > ipLimit || counts.sessCount > sessLimit) {
        return chatJson(
          {
            error: "rate_limited",
            message:
              "You've asked a lot of questions in the last hour — please take a short break. The full directory below is always available.",
          },
          429,
        );
      }

      // Dataset (the same document the public /dataset route serves).
      const dataset = await ctx.runQuery(
        internal.content.getDatasetInternal,
        { name: "businesses" },
      );
      if (!dataset) {
        return chatJson(
          {
            error: "dataset_unavailable",
            message:
              "The directory data isn't available right now — please browse the directory below or try again shortly.",
          },
          503,
        );
      }
      let records: BizRecord[];
      try {
        records = JSON.parse(dataset.payload) as BizRecord[];
      } catch {
        return chatJson({ error: "dataset_unavailable" }, 503);
      }

      // Response cache, keyed on the dataset hash so a data publish
      // invalidates yesterday's answers.
      const cacheKey = await sha256Hex(
        [
          "v1",
          dataset.contentHash,
          normalizeQuestion(question),
          JSON.stringify(context ?? null),
        ].join("|"),
      );
      const cached = await ctx.runQuery(internal.businessChat.getCache, {
        key: cacheKey,
      });
      if (cached && Date.now() - cached.createdAt < CHAT_DEFAULTS.cacheTtlMs) {
        try {
          const parsed = JSON.parse(cached.response) as Record<string, unknown>;
          parsed.cached = true;
          return chatJson(parsed, 200);
        } catch {
          // Corrupt cache entry — fall through and recompute.
        }
      }

      // Deterministic grounded retrieval — the answer of record.
      const outcome = runMatch(records, question, context);
      let answer = composeAnswer(outcome);
      let mode: "ai" | "directory" = "directory";
      let llmNotice: string | null = null;

      // Optional LLM phrasing, behind the spend circuit-breaker. Off-topic
      // refusals never spend a model call.
      if (process.env.LL_LLM_API_KEY && outcome.status !== "offtopic") {
        const day = chicagoDay(new Date());
        const used = await ctx.runQuery(
          internal.businessChat.getDailyLlmCalls,
          { day },
        );
        const cap = envInt(
          "LL_CHAT_DAILY_LLM_CAP",
          CHAT_DEFAULTS.dailyLlmCap,
        );
        if (used >= cap) {
          llmNotice =
            "AI phrasing is paused for today (daily limit reached) — this answer comes straight from the directory matcher.";
        } else {
          const phrased = await phraseWithLlm({ question, outcome, records });
          if (phrased) {
            answer = phrased;
            mode = "ai";
            await ctx.runMutation(internal.businessChat.bumpDailyLlmCalls, {
              day,
            });
          }
        }
      }

      const responseBody = toResponseBody({
        outcome,
        answer,
        mode,
        llmNotice,
      });
      await ctx.runMutation(internal.businessChat.putCache, {
        key: cacheKey,
        response: JSON.stringify(responseBody),
      });
      return chatJson(responseBody, 200);
    } catch (e) {
      console.error("business-chat failed", e);
      return chatJson(
        {
          error: "internal",
          message:
            "Something went wrong answering that — the directory below still works.",
        },
        500,
      );
    }
  }),
});

// Preserve the historical behavior of the .convex.site domain: it redirected
// to the canonical site when the pre-static architecture used it.
http.route({
  path: "/",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 302,
      headers: { Location: "https://leanderlive.com" },
    });
  }),
});

export default http;
