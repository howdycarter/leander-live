import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import {
  CAVEAT_LINES,
  composeAnswer,
  normalizeQuestion,
  runMatch,
  type BizRecord,
  type ChatContext,
  type MatchOutcome,
} from "./lib/businessMatch";

// Businesses chat search — server side of POST /business-chat (CHR-2355).
//
// Pipeline: rate-limit → cache → deterministic retrieval over the REAL
// businesses dataset (convex/lib/businessMatch.ts, shared with the client)
// → optional LLM phrasing layer → output validation → cache store.
//
// Grounding contract: the LLM only ever rephrases; it receives the exact
// rows the matcher retrieved and its answer is rejected (deterministic text
// is served instead) if it names a business outside those rows, prints a
// phone number or a time of day, or links anywhere.
//
// LLM activation (all server-side env on this deployment; no code change):
//   npx convex env set LL_LLM_API_KEY <key>            # required to enable
//   npx convex env set LL_LLM_BASE_URL <url>           # default https://api.openai.com/v1
//   npx convex env set LL_LLM_MODEL <model>            # default gpt-4o-mini
// Any OpenAI-compatible chat-completions endpoint works (OpenAI, Anthropic's
// compatibility endpoint, Gemini's compatibility endpoint). With no key set
// the endpoint serves the deterministic matcher — that is the live default.
//
// Abuse controls (env-tunable, defaults in parentheses):
//   LL_CHAT_IP_HOURLY_LIMIT (20)      questions per IP per hour
//   LL_CHAT_SESSION_HOURLY_LIMIT (30) questions per browser session per hour
//   LL_CHAT_DAILY_LLM_CAP (500)       LLM calls per Chicago day; past the cap
//                                     the endpoint serves deterministic
//                                     answers with an honest notice instead
//   question length cap 300 chars, body cap 16 KB, LLM timeout 8s,
//   response cache 7 days (keyed on dataset hash), topic containment in the
//   matcher + system prompt + output validation, no tool access for the model.

export const DEFAULTS = {
  ipHourlyLimit: 20,
  sessionHourlyLimit: 30,
  dailyLlmCap: 500,
  llmBaseUrl: "https://api.openai.com/v1",
  llmModel: "gpt-4o-mini",
  llmTimeoutMs: 8000,
  cacheTtlMs: 7 * 24 * 3600 * 1000,
};

export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ---------------- rate limits / cache / daily counters ---------------- */

export const hitRateLimits = internalMutation({
  args: { ipKey: v.string(), sessKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    async function bump(key: string): Promise<number> {
      const doc = await ctx.db
        .query("ll_chat_rate")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (doc) {
        await ctx.db.patch(doc._id, {
          count: doc.count + 1,
          updatedAt: Date.now(),
        });
        return doc.count + 1;
      }
      await ctx.db.insert("ll_chat_rate", {
        key,
        count: 1,
        updatedAt: Date.now(),
      });
      return 1;
    }
    const ipCount = await bump(args.ipKey);
    const sessCount = args.sessKey ? await bump(args.sessKey) : 0;
    return { ipCount, sessCount };
  },
});

export const getCache = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("ll_chat_cache")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (!doc) return null;
    return { response: doc.response, createdAt: doc.createdAt };
  },
});

export const putCache = internalMutation({
  args: { key: v.string(), response: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("ll_chat_cache")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (doc) {
      await ctx.db.patch(doc._id, {
        response: args.response,
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.insert("ll_chat_cache", {
        key: args.key,
        response: args.response,
        createdAt: Date.now(),
      });
    }
    return null;
  },
});

export const getDailyLlmCalls = internalQuery({
  args: { day: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("ll_chat_daily")
      .withIndex("by_day", (q) => q.eq("day", args.day))
      .unique();
    return doc ? doc.llmCalls : 0;
  },
});

export const bumpDailyLlmCalls = internalMutation({
  args: { day: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("ll_chat_daily")
      .withIndex("by_day", (q) => q.eq("day", args.day))
      .unique();
    if (doc) {
      await ctx.db.patch(doc._id, { llmCalls: doc.llmCalls + 1 });
      return doc.llmCalls + 1;
    }
    await ctx.db.insert("ll_chat_daily", { day: args.day, llmCalls: 1 });
    return 1;
  },
});

/* ---------------- context sanitizing ---------------- */

export function sanitizeContext(raw: unknown): ChatContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const ctx: ChatContext = { terms: [], offset: 0 };
  if (typeof r.category === "string" && r.category.length <= 40) {
    ctx.category = r.category;
  }
  if (typeof r.zip === "string" && /^\d{5}$/.test(r.zip)) ctx.zip = r.zip;
  if (r.freshness === "new" || r.freshness === "opening") {
    ctx.freshness = r.freshness;
  }
  if (Array.isArray(r.terms)) {
    ctx.terms = r.terms
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.toLowerCase().replace(/[^a-z0-9\s]/g, "").slice(0, 24))
      .filter(Boolean)
      .slice(0, 8);
  }
  if (typeof r.offset === "number" && Number.isFinite(r.offset)) {
    ctx.offset = Math.max(0, Math.min(600, Math.floor(r.offset)));
  }
  return ctx;
}

/* ---------------- LLM phrasing layer ---------------- */

const SYSTEM_PROMPT = [
  "You are the Leander Live business directory assistant. You answer ONLY questions about finding businesses in Leander, Texas, using the directory rows provided in the user message.",
  "Rules:",
  "- Mention ONLY businesses from the provided rows. Never invent a business, and never add facts that are not in the rows.",
  "- The directory has NO hours, phone numbers, websites, menus, prices, ratings, or reviews. If the visitor asks for any of those, say plainly that the directory doesn't list them and suggest confirming with the business.",
  "- Keep it short and friendly: 2-4 sentences. The matching listings are also shown as cards under your answer, so name the top matches without repeating every address.",
  "- If the directory result says there are no matches, say so honestly and suggest a category or a business name to try. Never substitute businesses from outside the rows.",
  "- If the visitor asks about anything other than finding a Leander-area business, politely decline in one sentence and steer back to business search.",
  "- Caveat lines, when provided, are facts from the directory system: include each one, verbatim or in your own words, and never contradict them.",
].join("\n");

export function buildLlmUserMessage(
  question: string,
  outcome: MatchOutcome,
): string {
  const rows = outcome.shown.map((b) => ({
    name: b.name,
    category: b.category,
    address: b.address,
    zip: b.zip,
  }));
  const caveatLines = outcome.caveats.map((c) => CAVEAT_LINES[c]);
  return JSON.stringify(
    {
      visitorQuestion: question,
      directoryResult: {
        status: outcome.status,
        totalMatches: outcome.total,
        category: outcome.category ?? null,
        deterministicSummary: composeAnswer(outcome),
        caveatsThatApply: caveatLines,
        rows,
      },
    },
    null,
    2,
  );
}

/**
 * Grounding check for LLM output. Rejects anything that names a dataset
 * business outside the retrieved rows, prints something shaped like a phone
 * number or a time of day, includes a URL, or (when there are matches)
 * fails to name at least one retrieved business.
 */
export function validateLlmAnswer(
  answer: string,
  outcome: MatchOutcome,
  allNames: string[],
): boolean {
  if (!answer || answer.length > 1500) return false;
  if (/https?:\/\//i.test(answer)) return false;
  if (/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.test(answer)) return false;
  if (/\b\d{1,2}(:\d{2})?\s?[ap]\.?m\.?\b/i.test(answer)) return false;
  const lower = answer.toLowerCase();
  if (outcome.shown.length > 0) {
    const namesShown = outcome.shown.some((b) =>
      lower.includes(b.name.toLowerCase()),
    );
    if (!namesShown) return false;
  }
  const shownNames = new Set(outcome.shown.map((b) => b.name.toLowerCase()));
  for (const name of allNames) {
    const n = name.toLowerCase();
    if (n.length >= 4 && lower.includes(n) && !shownNames.has(n)) return false;
  }
  return true;
}

export async function phraseWithLlm(args: {
  question: string;
  outcome: MatchOutcome;
  records: BizRecord[];
}): Promise<string | null> {
  const apiKey = process.env.LL_LLM_API_KEY;
  if (!apiKey) return null;
  const base = (process.env.LL_LLM_BASE_URL || DEFAULTS.llmBaseUrl).replace(
    /\/$/,
    "",
  );
  const model = process.env.LL_LLM_MODEL || DEFAULTS.llmModel;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEFAULTS.llmTimeoutMs);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildLlmUserMessage(args.question, args.outcome) },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const answer = content.trim();
    const allNames = args.records.map((r) => r.name);
    return validateLlmAnswer(answer, args.outcome, allNames) ? answer : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- response assembly ---------------- */

export interface ChatResponseBody {
  answer: string;
  businesses: BizRecord[];
  total: number;
  category: string | null;
  caveats: string[];
  mode: "ai" | "directory";
  llmNotice: string | null;
  context: ChatContext;
  cached: boolean;
}

export function toResponseBody(args: {
  outcome: MatchOutcome;
  answer: string;
  mode: "ai" | "directory";
  llmNotice: string | null;
}): ChatResponseBody {
  return {
    answer: args.answer,
    businesses: args.outcome.shown,
    total: args.outcome.total,
    category: args.outcome.category ?? null,
    caveats: args.outcome.caveats,
    mode: args.mode,
    llmNotice: args.llmNotice,
    context: args.outcome.context,
    cached: false,
  };
}

export function chicagoDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export { composeAnswer, normalizeQuestion, runMatch };
export type { BizRecord, ChatContext, MatchOutcome };
