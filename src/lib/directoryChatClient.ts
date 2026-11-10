import {
  CLIENT_FETCH_TIMEOUT_MS,
  COPY,
  answerLocally,
  asChatMode,
  clipHistory,
  type ChatMessage,
  type DirectoryChatResult,
  type DirectoryListing,
  type PublicMatch,
} from "./directoryChat";

const SESSION_KEY = "ll-directory-chat-session";

export function convexSiteUrl(): string {
  const raw = import.meta.env.VITE_CONVEX_SITE_URL;
  return typeof raw === "string" ? raw.replace(/\/$/, "").trim() : "";
}

export function getDirectorySessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && existing.length > 0 && existing.length <= 64) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "anon";
  }
}

function asMatches(value: unknown, fallback: PublicMatch[]): PublicMatch[] {
  if (!Array.isArray(value)) return fallback;
  const matches: PublicMatch[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as Partial<PublicMatch>;
    if (
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.category !== "string" ||
      typeof item.address !== "string" ||
      typeof item.zip !== "string" ||
      typeof item.featured !== "boolean"
    ) {
      continue;
    }
    const match: PublicMatch = {
      id: item.id,
      name: item.name,
      category: item.category,
      address: item.address,
      zip: item.zip,
      featured: item.featured,
    };
    if (typeof item.permitIssuedAt === "number") match.permitIssuedAt = item.permitIssuedAt;
    if (typeof item.firstSalesAt === "number") match.firstSalesAt = item.firstSalesAt;
    matches.push(match);
  }
  return matches.length > 0 ? matches : fallback;
}

export async function askDirectory(args: {
  listings: DirectoryListing[];
  messages: ChatMessage[];
  now?: number;
}): Promise<DirectoryChatResult> {
  const local = answerLocally({
    listings: args.listings,
    messages: args.messages,
    now: args.now,
  });
  if (local.mode === "refused" || local.mode === "too_long") return local;

  const site = convexSiteUrl();
  if (!site) {
    return { ...local, notice: COPY.localOnly };
  }

  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), CLIENT_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${site}/directory/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: clipHistory(args.messages),
        sessionId: getDirectorySessionId(),
      }),
      signal: controller.signal,
    });
    const data = (await res.json()) as {
      reply?: unknown;
      matches?: unknown;
      mode?: unknown;
      notice?: unknown;
      reason?: unknown;
    };
    if (data.reason === "empty_index") {
      return { ...local, notice: COPY.emptyIndex };
    }
    if (typeof data.reply !== "string" || data.reply.trim() === "") {
      return { ...local, notice: COPY.unavailable };
    }
    return {
      reply: data.reply,
      matches: asMatches(data.matches, local.matches),
      mode: asChatMode(typeof data.mode === "string" ? data.mode : "fallback"),
      notice: typeof data.notice === "string" ? data.notice : undefined,
    };
  } catch {
    return { ...local, notice: COPY.unavailable };
  } finally {
    globalThis.clearTimeout(timer);
  }
}
