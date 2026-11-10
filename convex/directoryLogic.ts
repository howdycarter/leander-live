/**
 * Pure helpers for Leander directory chat.
 *
 * Used by the Convex HTTP action (this folder) and by the /businesses UI
 * fallback. Keep this module free of Convex, OpenAI, and DOM imports so
 * Node tests and the Vite bundle can share it.
 *
 * Grounding rule: answers may only name listings passed in as retrieved
 * rows, and only the fields this dataset actually has (name, category,
 * address, ZIP, permit dates). No hours, phones, websites, or invented
 * businesses.
 */

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type DirectoryListing = {
  id: string;
  name: string;
  category: string;
  naics: string;
  address: string;
  zip: string;
  permitIssuedAt?: number;
  firstSalesAt?: number;
  featured: boolean;
  source: string;
  sourceUrl?: string;
};

export type PublicMatch = {
  id: string;
  name: string;
  category: string;
  address: string;
  zip: string;
  featured: boolean;
  permitIssuedAt?: number;
  firstSalesAt?: number;
};

export type ChatMode = "llm" | "fallback" | "refused" | "rate_limited" | "too_long";

export function asChatMode(mode: string): ChatMode {
  switch (mode) {
    case "llm":
    case "fallback":
    case "refused":
    case "rate_limited":
    case "too_long":
      return mode;
    default:
      return "fallback";
  }
}

export type TopicDecision =
  | { kind: "allow" }
  | { kind: "refuse"; reply: string };

export type DirectoryChatResult = {
  reply: string;
  matches: PublicMatch[];
  mode: ChatMode;
  notice?: string;
};

export const MAX_QUERY_LENGTH = 400;
export const MAX_HISTORY_MESSAGES = 8;
export const MAX_MESSAGE_CHARS = 500;
export const MAX_MATCHES = 12;
export const RATE_LIMIT_MAX = 20;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const OPENAI_TIMEOUT_MS = 8000;
export const CLIENT_FETCH_TIMEOUT_MS = 10_000;
export const CACHE_TTL_MS = 60 * 60 * 1000;
export const DEFAULT_CHAT_MODEL = "gpt-4o-mini";
export const MAX_COMPLETION_TOKENS = 280;
export const DEFAULT_DAILY_USD = 1;
export const INPUT_USD_PER_MILLION = 0.15;
export const OUTPUT_USD_PER_MILLION = 0.6;
export const NEW_PERMIT_MS = 90 * 24 * 3600 * 1000;

export const COPY = {
  refusal:
    "I only help look up businesses in the Leander directory — names, categories, addresses, ZIP codes, and permit dates from Texas records. Try something like “coffee in 78641” or “who’s opening soon?”",
  otherCity:
    "I only search businesses in Leander, Texas, from this directory. Ask about a Leander category, name, or ZIP (78641 / 78646).",
  tooLong:
    "That question is too long for the directory search (400 characters max). Shorten it and try again.",
  rateLimited:
    "This directory search has a limit of about 20 questions per hour so we can keep it available for everyone. Please try again later, or browse the list below.",
  budget:
    "Today’s AI answers are paused to keep costs down. Here are directory matches from the permit records instead.",
  timeout:
    "The AI phrasing step timed out. Here are directory matches from the permit records instead.",
  noKey:
    "AI phrasing is not configured on the server. Here are directory matches from the permit records instead.",
  unavailable:
    "Could not reach the directory assistant. Here are local permit-record matches instead.",
  emptyIndex:
    "The live directory index is not seeded yet. Showing matches from the published permit records instead.",
  openaiError:
    "The AI phrasing step is unavailable right now. Here are directory matches from the permit records instead.",
  localOnly:
    "Answers here are matched directly against the published permit records. AI phrasing starts after the directory assistant is connected.",
  datasetLimit:
    "The directory only includes name, category, address, ZIP, and permit dates — not hours, phone numbers, or websites. Confirm details with the business before you go.",
} as const;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "around",
  "at",
  "best",
  "find",
  "for",
  "from",
  "in",
  "is",
  "looking",
  "me",
  "near",
  "nearby",
  "of",
  "or",
  "please",
  "show",
  "some",
  "the",
  "to",
  "want",
  "where",
  "who",
  "with",
]);

const SYNONYMS: Record<string, string[]> = {
  auto: ["auto repair"],
  bakery: ["restaurants & food", "specialty food"],
  bar: ["bars & nightlife"],
  barber: ["salons, barbers & nails"],
  beer: ["bars & nightlife", "liquor stores"],
  burger: ["restaurants & food", "food trucks"],
  cafe: ["restaurants & food", "specialty food"],
  car: ["auto repair"],
  childcare: ["child care"],
  clinic: ["clinics & health care"],
  coffee: ["restaurants & food", "specialty food", "gas & convenience"],
  daycare: ["child care"],
  dentist: ["clinics & health care"],
  doctor: ["clinics & health care"],
  espresso: ["restaurants & food", "specialty food"],
  fitness: ["fitness centers"],
  florist: ["florists"],
  flower: ["florists"],
  flowers: ["florists"],
  gas: ["gas & convenience"],
  grocery: ["grocery & markets"],
  gym: ["fitness centers"],
  hair: ["salons, barbers & nails"],
  haircut: ["salons, barbers & nails"],
  heb: ["grocery & markets"],
  hotel: ["hotels & lodging"],
  manicure: ["salons, barbers & nails"],
  mechanic: ["auto repair"],
  mexican: ["restaurants & food", "food trucks"],
  nail: ["salons, barbers & nails"],
  nails: ["salons, barbers & nails"],
  pharmacy: ["pharmacy"],
  pizza: ["restaurants & food", "food trucks"],
  restaurant: ["restaurants & food"],
  restaurants: ["restaurants & food"],
  salon: ["salons, barbers & nails"],
  taco: ["restaurants & food", "food trucks"],
  tacos: ["restaurants & food", "food trucks"],
  thrift: ["thrift & resale"],
  vet: ["pet care"],
  yoga: ["fitness centers"],
};

const OFF_TOPIC: RegExp[] = [
  /ignore (all )?(previous|prior) (instructions|prompts)/i,
  /you are (now )?(a |an )?(unrestricted|jailbreak|dan)\b/i,
  /\b(write|debug|fix) (me )?(a |some )?(python|javascript|typescript|code|sql)\b/i,
  /\bwho should i vote\b/i,
  /\bmake a bomb\b/i,
  /\bhow to hack\b/i,
  /\bcapital of\b/i,
  /\bweather in\b/i,
  /\btranslate this\b/i,
  /\bwrite (me )?a poem\b/i,
  /\btell me a joke\b/i,
];

const OTHER_CITY =
  /\b(in|near|around)\s+(austin|cedar park|round rock|georgetown|pflugerville|dallas|houston|san antonio|new york|paris|london)\b/i;

const LOCAL_HINT =
  /\b(leander|78641|78646|local|nearby|in town|directory|permit|crystal falls|old town)\b/i;

const CATEGORY_HINT =
  /\b(restaurant|taco|tacos|coffee|cafe|salon|barber|nail|nails|gym|fitness|vet|pet|grocery|repair|clinic|daycare|hotel|bar|thrift|florist|pharmacy|store|shop|food truck|mechanic|dentist|yoga|pizza|burger|bakery|opening soon|new in town)\b/i;

const PHONE_RE = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const FORBIDDEN_ATTR =
  /\b(open until|closes at|opening hours|business hours|hours of operation|phone number|call them at|their website|currently open|rated \d|stars out of)\b/i;

const REFINEMENT =
  /^(those|these|what about|how about|and |in |near |also|only |just |the .+ ones)\b/i;

export function clipHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    role: message.role,
    content: message.content.slice(0, MAX_MESSAGE_CHARS),
  }));
}

export function latestUserQuery(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message && message.role === "user") return message.content.trim();
  }
  return "";
}

export function retrievalQuery(messages: ChatMessage[]): string {
  const users = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean);
  if (users.length === 0) return "";
  const latest = users[users.length - 1] ?? "";
  if (users.length === 1) return latest;
  if (isRefinement(latest)) {
    const prior = users.slice(-3, -1).join(" ");
    return `${prior} ${latest}`.trim();
  }
  return latest;
}

function isRefinement(text: string): boolean {
  return text.length < 48 || REFINEMENT.test(text);
}

export function topicDecision(text: string): TopicDecision {
  const query = text.trim();
  if (!query) return { kind: "refuse", reply: COPY.refusal };
  for (const pattern of OFF_TOPIC) {
    if (pattern.test(query)) return { kind: "refuse", reply: COPY.refusal };
  }
  if (OTHER_CITY.test(query) && !LOCAL_HINT.test(query)) {
    return { kind: "refuse", reply: COPY.otherCity };
  }
  const tokens = tokenize(query);
  if (LOCAL_HINT.test(query) || CATEGORY_HINT.test(query) || tokens.length <= 8) {
    return { kind: "allow" };
  }
  return { kind: "refuse", reply: COPY.refusal };
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));
}

export type Freshness = "opening" | "new" | null;

export function freshness(listing: DirectoryListing, now: number): Freshness {
  if (listing.firstSalesAt && listing.firstSalesAt > now) return "opening";
  if (listing.permitIssuedAt && now - listing.permitIssuedAt < NEW_PERMIT_MS) {
    return "new";
  }
  return null;
}

export function freshnessLabel(listing: DirectoryListing, now: number): string | null {
  const kind = freshness(listing, now);
  switch (kind) {
    case "opening":
      return listing.firstSalesAt
        ? `Opening soon — first sales ${formatPermitDate(listing.firstSalesAt)}`
        : "Opening soon";
    case "new":
      return "New in town";
    case null:
      return null;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function formatPermitDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });
}

export function retrieveListings(
  listings: DirectoryListing[],
  query: string,
  now: number,
  limit = MAX_MATCHES,
): DirectoryListing[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const tokens = tokenize(trimmed);
  const wantsOpening = /opening soon|coming soon|not (yet )?open|first sales/.test(
    trimmed.toLowerCase(),
  );
  const wantsNew = /\bnew in town\b|\bnewly opened\b|\bnew permit\b|\bjust opened\b/.test(
    trimmed.toLowerCase(),
  );

  if (wantsOpening && tokens.every((token) => /opening|coming|soon|first|sales|open/.test(token))) {
    return listings
      .filter((listing) => freshness(listing, now) === "opening")
      .slice(0, limit);
  }
  if (wantsNew && tokens.every((token) => /new|town|newly|opened|permit|just/.test(token))) {
    return listings.filter((listing) => freshness(listing, now) === "new").slice(0, limit);
  }

  const zipToken = tokens.find((token) => /^\d{5}$/.test(token));
  const pool = zipToken
    ? listings.filter((listing) => listing.zip === zipToken)
    : listings;

  const scored = pool
    .map((listing) => ({
      listing,
      score: scoreListing(listing, tokens, trimmed.toLowerCase(), now, wantsOpening, wantsNew),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.listing.name.localeCompare(b.listing.name));
  if (scored.length === 0) return [];
  const top = scored[0]!.score;
  const floor = top >= 24 ? Math.max(24, top * 0.45) : 1;
  return scored
    .filter((row) => row.score >= floor)
    .slice(0, limit)
    .map((row) => row.listing);
}

function scoreListing(
  listing: DirectoryListing,
  tokens: string[],
  raw: string,
  now: number,
  wantsOpening: boolean,
  wantsNew: boolean,
): number {
  const name = listing.name.toLowerCase();
  const category = listing.category.toLowerCase();
  const address = listing.address.toLowerCase();
  let score = 0;
  if (raw.length >= 3 && name.includes(raw)) score += 60;
  if (name.length >= 4 && raw.includes(name)) score += 50;
  for (const token of tokens) {
    if (name === token || name.split(/\s+/).includes(token)) score += 14;
    else if (name.includes(token)) score += token.length > 3 ? 10 : 5;
    if (category.includes(token)) score += 10;
    if (listing.zip === token) score += 18;
    if (address.includes(token)) score += 5;
    const synonyms = SYNONYMS[token];
    if (synonyms?.some((label) => category === label)) score += 16;
  }
  const kind = freshness(listing, now);
  if (wantsOpening && kind === "opening") score += 28;
  if (wantsNew && kind === "new") score += 22;
  if (listing.featured) score += 2;
  return score;
}

export function toPublicMatch(listing: DirectoryListing): PublicMatch {
  const match: PublicMatch = {
    id: listing.id,
    name: listing.name,
    category: listing.category,
    address: listing.address,
    zip: listing.zip,
    featured: listing.featured,
  };
  if (listing.permitIssuedAt !== undefined) match.permitIssuedAt = listing.permitIssuedAt;
  if (listing.firstSalesAt !== undefined) match.firstSalesAt = listing.firstSalesAt;
  return match;
}

export function allowedFields(listing: DirectoryListing, now: number): Record<string, string> {
  const fields: Record<string, string> = {
    id: listing.id,
    name: listing.name,
    category: listing.category,
    address: listing.address,
    zip: listing.zip,
    featured: listing.featured ? "yes" : "no",
  };
  if (listing.permitIssuedAt !== undefined) {
    fields.permitIssued = formatPermitDate(listing.permitIssuedAt);
  }
  if (listing.firstSalesAt !== undefined) {
    fields.firstSales = formatPermitDate(listing.firstSalesAt);
  }
  const label = freshnessLabel(listing, now);
  if (label) fields.freshness = label;
  return fields;
}

export function phraseDeterministic(
  query: string,
  matches: DirectoryListing[],
  now: number,
): string {
  if (matches.length === 0) {
    return `I looked through the Leander directory for “${query}” and did not find a matching name, category, or address. ${COPY.datasetLimit} You can browse the full list below.`;
  }
  const lines = matches.map((listing, index) => {
    const extra = freshnessLabel(listing, now);
    return `${index + 1}. ${listing.name} — ${listing.category} — ${listing.address}, ${listing.zip}${extra ? ` (${extra})` : ""}`;
  });
  return [
    `Here are Leander directory matches for “${query}”:`,
    ...lines,
    COPY.datasetLimit,
  ].join("\n");
}

export function groundReply(
  reply: string,
  matches: DirectoryListing[],
  query: string,
  now: number,
): { text: string; grounded: boolean } {
  const trimmed = reply.trim();
  if (!trimmed) {
    return { text: phraseDeterministic(query, matches, now), grounded: false };
  }
  if (PHONE_RE.test(trimmed) || FORBIDDEN_ATTR.test(trimmed)) {
    return { text: phraseDeterministic(query, matches, now), grounded: false };
  }
  if (matches.length > 0) {
    const named = matches.filter((listing) =>
      trimmed.toLowerCase().includes(listing.name.toLowerCase()),
    );
    if (named.length === 0) {
      return { text: phraseDeterministic(query, matches, now), grounded: false };
    }
  }
  return { text: trimmed, grounded: true };
}

export function buildSystemPrompt(matches: DirectoryListing[], now: number): string {
  const rows =
    matches.length === 0
      ? "(no matching listings)"
      : JSON.stringify(matches.map((listing) => allowedFields(listing, now)));
  return `You are the Leander Live directory assistant for Leander, Texas.
You answer ONLY from RETRIEVED BUSINESSES below. Those rows are Texas sales-tax permit records.
Allowed fields: name, category, address, zip, permitIssued, firstSales, featured, freshness.
NEVER invent businesses. NEVER invent hours, phone numbers, websites, menus, ratings, or any field not listed.
If the visitor asks for hours or a phone number, say the directory does not include them and they should confirm with the business.
If RETRIEVED BUSINESSES is empty, say you did not find a match in the Leander directory and suggest browsing the list on the page.
Name businesses exactly as written. Keep the tone neighborly and short (1-3 short paragraphs or a short list).
Do not use tools. You have no tool access.

RETRIEVED BUSINESSES:
${rows}`;
}

export function normalizeCacheNeedle(query: string, matchIds: string[]): string {
  return `${query.trim().toLowerCase().replace(/\s+/g, " ")}|${matchIds.slice().sort().join(",")}`;
}

export function estimateUsd(promptTokens: number, completionTokens: number): number {
  return (
    (promptTokens / 1_000_000) * INPUT_USD_PER_MILLION +
    (completionTokens / 1_000_000) * OUTPUT_USD_PER_MILLION
  );
}

export function estimateTokensFromChars(chars: number): number {
  return Math.max(1, Math.ceil(chars / 4));
}

export function utcDayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function answerLocally(args: {
  listings: DirectoryListing[];
  messages: ChatMessage[];
  now?: number;
  notice?: string;
}): DirectoryChatResult {
  const now = args.now ?? Date.now();
  const history = clipHistory(args.messages);
  const query = latestUserQuery(history);
  if (query.length > MAX_QUERY_LENGTH) {
    return { reply: COPY.tooLong, matches: [], mode: "too_long" };
  }
  const topic = topicDecision(query);
  switch (topic.kind) {
    case "refuse":
      return { reply: topic.reply, matches: [], mode: "refused" };
    case "allow":
      break;
    default: {
      const _never: never = topic;
      return _never;
    }
  }
  const matches = retrieveListings(args.listings, retrievalQuery(history), now);
  return {
    reply: phraseDeterministic(query, matches, now),
    matches: matches.map(toPublicMatch),
    mode: "fallback",
    notice: args.notice,
  };
}
