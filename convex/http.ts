import {
  httpActionGeneric,
  httpRouter,
  makeFunctionReference,
} from "convex/server";
import {
  COPY,
  DEFAULT_CHAT_MODEL,
  MAX_COMPLETION_TOKENS,
  MAX_QUERY_LENGTH,
  OPENAI_TIMEOUT_MS,
  asChatMode,
  buildSystemPrompt,
  clipHistory,
  estimateTokensFromChars,
  estimateUsd,
  groundReply,
  latestUserQuery,
  normalizeCacheNeedle,
  phraseDeterministic,
  retrievalQuery,
  toPublicMatch,
  topicDecision,
  type ChatMessage,
  type ChatRole,
  type DirectoryChatResult,
  type DirectoryListing,
  type PublicMatch,
} from "./directoryLogic";

const consumeQuota = makeFunctionReference<"mutation">("directory:consumeQuota");
const gateAndRetrieve = makeFunctionReference<"mutation">(
  "directory:gateAndRetrieve",
);
const rememberTurn = makeFunctionReference<"mutation">("directory:rememberTurn");

type GateResult =
  | { status: "too_long" }
  | { status: "rate_limited" }
  | {
      status: "cached";
      reply: string;
      matches: PublicMatch[];
      mode: string;
      notice?: string;
    }
  | { status: "empty_index"; budgetTripped: boolean }
  | {
      status: "ok";
      budgetTripped: boolean;
      matches: PublicMatch[];
      listings: DirectoryListing[];
    };

function json(status: number, body: unknown, extraHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (origin === "https://leanderlive.com" || origin === "https://www.leanderlive.com") {
    return true;
  }
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return true;
  if (/^https:\/\/leander-live[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return false;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = isAllowedOrigin(origin) ? origin : "https://leanderlive.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim().slice(0, 64);
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim().slice(0, 64);
  return "unknown";
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const messages: ChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    messages.push({ role: role as ChatRole, content });
  }
  return messages;
}

function resultPayload(result: DirectoryChatResult): DirectoryChatResult {
  return {
    reply: result.reply,
    matches: result.matches,
    mode: result.mode,
    notice: result.notice,
  };
}

async function phraseWithOpenAI(args: {
  matches: DirectoryListing[];
  history: ChatMessage[];
  now: number;
}): Promise<{ text: string | null; promptTokens: number; completionTokens: number; error?: "timeout" | "http" | "nokey" }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { text: null, promptTokens: 0, completionTokens: 0, error: "nokey" };
  const model = process.env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL;
  const system = buildSystemPrompt(args.matches, args.now);
  const body = JSON.stringify({
    model,
    messages: [{ role: "system", content: system }, ...args.history],
    max_tokens: MAX_COMPLETION_TOKENS,
    temperature: 0.2,
  });
  const promptTokens = estimateTokensFromChars(system.length + args.history.reduce((n, m) => n + m.content.length, 0));
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`directory chat OpenAI failed (${res.status})`);
      return { text: null, promptTokens, completionTokens: 0, error: "http" };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content ?? null;
    return {
      text,
      promptTokens: data.usage?.prompt_tokens ?? promptTokens,
      completionTokens:
        data.usage?.completion_tokens ?? estimateTokensFromChars(text?.length ?? 0),
    };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return { text: null, promptTokens, completionTokens: 0, error: "timeout" };
    }
    console.error("directory chat OpenAI error");
    return { text: null, promptTokens, completionTokens: 0, error: "http" };
  }
}

const http = httpRouter();

http.route({
  path: "/directory/chat",
  method: "OPTIONS",
  handler: httpActionGeneric(async (_ctx, req) => {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }),
});

http.route({
  path: "/directory/chat",
  method: "POST",
  handler: httpActionGeneric(async (ctx, req) => {
    const headers = corsHeaders(req);
    let payload: { messages?: unknown; sessionId?: unknown };
    try {
      payload = (await req.json()) as { messages?: unknown; sessionId?: unknown };
    } catch {
      return json(400, { ok: false, reason: "invalid json" }, headers);
    }
    const messages = parseMessages(payload.messages);
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId.slice(0, 64) : "";
    if (!messages || !sessionId) {
      return json(400, { ok: false, reason: "messages and sessionId required" }, headers);
    }

    const history = clipHistory(messages);
    const query = latestUserQuery(history);
    const now = Date.now();
    const ipHash = await sha256Hex(clientIp(req));
    const quota = (await ctx.runMutation(consumeQuota, {
      ipHash,
      sessionId,
      now,
    })) as { allowed: boolean };
    if (!quota.allowed) {
      return json(
        429,
        resultPayload({ reply: COPY.rateLimited, matches: [], mode: "rate_limited" }),
        headers,
      );
    }
    if (query.length > MAX_QUERY_LENGTH) {
      return json(
        200,
        resultPayload({ reply: COPY.tooLong, matches: [], mode: "too_long" }),
        headers,
      );
    }
    const topic = topicDecision(query);
    switch (topic.kind) {
      case "refuse":
        return json(
          200,
          resultPayload({ reply: topic.reply, matches: [], mode: "refused" }),
          headers,
        );
      case "allow":
        break;
      default: {
        const _never: never = topic;
        return _never;
      }
    }

    const search = retrievalQuery(history);
    const cacheKey = await sha256Hex(normalizeCacheNeedle(search, ["q"]));
    const gated = (await ctx.runMutation(gateAndRetrieve, {
      query: search,
      cacheKey,
      now,
    })) as GateResult;

    switch (gated.status) {
      case "too_long":
        return json(
          200,
          resultPayload({ reply: COPY.tooLong, matches: [], mode: "too_long" }),
          headers,
        );
      case "rate_limited":
        return json(
          429,
          resultPayload({ reply: COPY.rateLimited, matches: [], mode: "rate_limited" }),
          headers,
        );
      case "cached":
        return json(
          200,
          resultPayload({
            reply: gated.reply,
            matches: gated.matches,
            mode: asChatMode(gated.mode),
            notice: gated.notice,
          }),
          headers,
        );
      case "empty_index":
        return json(200, { ok: false, reason: "empty_index" }, headers);
      case "ok":
        break;
      default: {
        const _never: never = gated;
        return _never;
      }
    }

    const listings = gated.listings;
    const matches = listings.map(toPublicMatch);

    let notice: string | undefined;
    let mode: DirectoryChatResult["mode"] = "fallback";
    let reply = phraseDeterministic(query, listings, now);
    let promptTokens = 0;
    let completionTokens = 0;
    let estimated = 0;

    if (gated.budgetTripped) {
      notice = COPY.budget;
    } else {
      const llm = await phraseWithOpenAI({ matches: listings, history, now });
      promptTokens = llm.promptTokens;
      completionTokens = llm.completionTokens;
      estimated = estimateUsd(llm.promptTokens, llm.completionTokens);
      if (llm.error === "nokey") notice = COPY.noKey;
      else if (llm.error === "timeout") notice = COPY.timeout;
      else if (llm.error === "http") notice = COPY.openaiError;
      else if (llm.text) {
        const grounded = groundReply(llm.text, listings, query, now);
        reply = grounded.text;
        mode = grounded.grounded ? "llm" : "fallback";
      }
    }

    await ctx.runMutation(rememberTurn, {
      cacheKey,
      reply,
      matches,
      mode,
      notice,
      promptTokens,
      completionTokens,
      estimatedUsd: estimated,
      now,
    });

    return json(
      200,
      resultPayload({ reply, matches, mode, notice }),
      headers,
    );
  }),
});

export default http;
