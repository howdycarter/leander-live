/**
 * Deterministic, grounded matching over the Leander Live business directory.
 *
 * This module is the answer engine behind the /businesses chat search. It is
 * pure (no network, no DOM, no LLM): given the real directory records it
 * parses a natural-language ask into category / zip / freshness / term
 * signals, scores the actual records, and composes an honest answer from the
 * rows it found. It can only ever name businesses that exist in the dataset
 * it is handed — the dataset carries name, category, street address, zip and
 * permit dates only, so answers never claim hours, phone numbers, menus,
 * ratings, or amenities.
 *
 * SINGLE SOURCE OF TRUTH: convex/lib/businessMatch.ts is a byte-identical
 * copy of this file (the Convex endpoint runs the same logic server-side).
 * scripts/lib/business-match.test.mjs fails if the two drift.
 */

export interface BizRecord {
  id: string;
  name: string;
  category: string;
  address: string;
  zip: string;
  permitIssuedAt?: number;
  firstSalesAt?: number;
  featured: boolean;
}

export interface ChatContext {
  category?: string;
  zip?: string;
  freshness?: "new" | "opening";
  terms: string[];
  offset: number;
}

export type Caveat =
  | "no-hours-phone"
  | "attributes-untracked"
  | "no-ratings"
  | "leander-only";

export interface MatchOutcome<T extends BizRecord = BizRecord> {
  status: "ok" | "none" | "offtopic";
  /** Total records matching the resolved filters. */
  total: number;
  /** The page of records to present (cards), at most PAGE_SIZE. */
  shown: T[];
  /** Resolved category filter, when one was detected. */
  category?: string;
  caveats: Caveat[];
  /** Context to carry into the next turn. */
  context: ChatContext;
  /** True when this turn paged further into the previous result set. */
  paged: boolean;
}

export const PAGE_SIZE = 6;
export const MAX_QUESTION_LENGTH = 300;

const NINETY_DAYS = 90 * 24 * 3600 * 1000;

/* ---------------- vocabulary ---------------- */

const STOPWORDS = new Set([
  "a", "an", "the", "in", "near", "me", "my", "for", "of", "to", "and", "or",
  "is", "are", "was", "there", "any", "find", "show", "get", "give", "looking",
  "look", "i", "we", "you", "want", "need", "please", "what", "where", "which",
  "can", "could", "do", "does", "did", "with", "on", "at", "by", "around",
  "some", "something", "somewhere", "place", "places", "business", "businesses",
  "shop", "shops", "store", "stores", "local", "leander", "tx", "texas",
  "that", "this", "it", "its", "have", "has", "who", "whom", "how", "about",
  "tell", "list", "know", "one", "ones", "good", "great", "top",
]);

/** Query phrases → directory category. Checked longest-first as substrings. */
const CATEGORY_PHRASES: Array<[string, string]> = [
  ["food truck", "Food Trucks"],
  ["dry clean", "Laundry & Dry Cleaning"],
  ["phone repair", "Electronics Repair"],
  ["computer repair", "Electronics Repair"],
  ["credit union", "Banks & Credit Unions"],
  ["oil change", "Auto Repair"],
  ["car wash", "Auto Repair"],
  ["date night", "Restaurants & Food"],
  ["ice cream", "Restaurants & Food"],
  ["fast food", "Restaurants & Food"],
];

/** Single-token synonyms → directory category. */
const CATEGORY_WORDS: Record<string, string> = {
  restaurant: "Restaurants & Food", restaurants: "Restaurants & Food",
  food: "Restaurants & Food", eat: "Restaurants & Food", eating: "Restaurants & Food",
  dinner: "Restaurants & Food", lunch: "Restaurants & Food",
  breakfast: "Restaurants & Food", brunch: "Restaurants & Food",
  tacos: "Restaurants & Food", taco: "Restaurants & Food",
  pizza: "Restaurants & Food", burger: "Restaurants & Food", burgers: "Restaurants & Food",
  bbq: "Restaurants & Food", barbecue: "Restaurants & Food",
  sushi: "Restaurants & Food", mexican: "Restaurants & Food",
  italian: "Restaurants & Food", chinese: "Restaurants & Food",
  thai: "Restaurants & Food", indian: "Restaurants & Food",
  coffee: "Restaurants & Food", cafe: "Restaurants & Food",
  bakery: "Restaurants & Food", donut: "Restaurants & Food", donuts: "Restaurants & Food",
  catering: "Catering & Food Services", caterer: "Catering & Food Services",
  caterers: "Catering & Food Services",
  truck: "Food Trucks", trucks: "Food Trucks",
  plumber: "Repair Services", plumbing: "Repair Services",
  electrician: "Repair Services", hvac: "Repair Services",
  handyman: "Repair Services", repair: "Repair Services",
  salon: "Salons, Barbers & Nails", salons: "Salons, Barbers & Nails",
  barber: "Salons, Barbers & Nails", barbers: "Salons, Barbers & Nails",
  hair: "Salons, Barbers & Nails", haircut: "Salons, Barbers & Nails",
  nails: "Salons, Barbers & Nails", nail: "Salons, Barbers & Nails",
  manicure: "Salons, Barbers & Nails", pedicure: "Salons, Barbers & Nails",
  gym: "Fitness Centers", fitness: "Fitness Centers", yoga: "Fitness Centers",
  crossfit: "Fitness Centers", workout: "Fitness Centers",
  auto: "Auto Repair", mechanic: "Auto Repair", tires: "Auto Repair",
  tire: "Auto Repair", automotive: "Auto Repair",
  pharmacy: "Pharmacy", drugstore: "Pharmacy",
  grocery: "Grocery & Markets", groceries: "Grocery & Markets",
  supermarket: "Grocery & Markets", market: "Grocery & Markets",
  hotel: "Hotels & Lodging", motel: "Hotels & Lodging", lodging: "Hotels & Lodging",
  inn: "Hotels & Lodging", stay: "Hotels & Lodging",
  bar: "Bars & Nightlife", bars: "Bars & Nightlife",
  brewery: "Bars & Nightlife", pub: "Bars & Nightlife", nightlife: "Bars & Nightlife",
  liquor: "Liquor Stores", wine: "Liquor Stores", spirits: "Liquor Stores",
  pet: "Pet Care", pets: "Pet Care", dog: "Pet Care", dogs: "Pet Care",
  vet: "Pet Care", veterinary: "Pet Care", groomer: "Pet Care", grooming: "Pet Care",
  florist: "Florists", florists: "Florists", flowers: "Florists",
  clinic: "Clinics & Health Care", clinics: "Clinics & Health Care",
  doctor: "Clinics & Health Care", dentist: "Clinics & Health Care",
  dental: "Clinics & Health Care", medical: "Clinics & Health Care",
  healthcare: "Clinics & Health Care",
  thrift: "Thrift & Resale", resale: "Thrift & Resale", consignment: "Thrift & Resale",
  laundry: "Laundry & Dry Cleaning",
  childcare: "Child Care", daycare: "Child Care", preschool: "Child Care",
  bank: "Banks & Credit Unions", banks: "Banks & Credit Unions",
  jewelry: "Jewelry & Accessories", jeweler: "Jewelry & Accessories",
  clothing: "Clothing & Accessories", clothes: "Clothing & Accessories",
  boutique: "Clothing & Accessories", apparel: "Clothing & Accessories",
  gifts: "Gifts & Novelties", gift: "Gifts & Novelties",
  electronics: "Electronics Repair",
  arcade: "Fun & Recreation", recreation: "Fun & Recreation",
  entertainment: "Fun & Recreation", fun: "Fun & Recreation",
  tutor: "Lessons & Tutoring", tutoring: "Lessons & Tutoring",
  lessons: "Lessons & Tutoring",
  spa: "Health & Beauty", massage: "Health & Beauty", beauty: "Health & Beauty",
  butcher: "Specialty Food", deli: "Specialty Food",
  venue: "Event Venues & Promoters", venues: "Event Venues & Promoters",
  theater: "Performing Arts", theatre: "Performing Arts",
  gallery: "Art Galleries", galleries: "Art Galleries",
  funeral: "Funeral Services",
  printing: "Printing & Signs", signs: "Printing & Signs", print: "Printing & Signs",
  gas: "Gas & Convenience", convenience: "Gas & Convenience",
  merchandise: "General Merchandise", dollar: "General Merchandise",
  supplies: "Pet Supplies",
};

/** Towns that are NOT Leander — the directory covers Leander only. */
const OTHER_TOWNS = [
  "cedar park", "austin", "round rock", "liberty hill", "georgetown",
  "jonestown", "lago vista", "pflugerville", "volente", "brushy creek",
];

const HOURS_PHONE_RE =
  /\b(hours?|open|opens|opening hours|close|closes|phone|call|number|website|menu|prices?|cost|much)\b/;
const ATTRIBUTE_RE =
  /\b(gluten|vegan|vegetarian|dairy|wifi|wi-fi|patio|outdoor seating|dog.friendly|kid.friendly|family.friendly|wheelchair|quiet|study|work from|romantic|cheap|budget|fancy|upscale)\b/;
const RATINGS_RE = /\b(best|top.rated|highest.rated|review|reviews|rated|rating|ratings|recommend|recommended|popular)\b/;
const MORE_RE = /^(more|others?|what else|show more|and more|next)\b|\b(more|others)\b/;

/** General-knowledge / general-chat question shapes. When one of these
    matches and no business category was detected, the question is off-topic
    even if a stray word happens to appear in a business name ("who won the
    world series" must not become a listing for World Foods). */
const OFFTOPIC_SHAPE_RE =
  /\b(who won|who is|who was|who are|what is the|what was|what are the|how do i|how to|why is|why do|why did|when did|when is|weather|news|score|scores|president|capital of|meaning of|translate|write me|write a|tell me a joke|joke|poem|essay|lyrics|stock price|exchange rate)\b/;

/* ---------------- helpers ---------------- */

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function contentTokens(text: string): string[] {
  return tokenize(text).filter((t) => !STOPWORDS.has(t) && t.length > 1);
}

function detectCategory(rawLower: string, tokens: string[]): string | undefined {
  for (const [phrase, cat] of CATEGORY_PHRASES) {
    if (rawLower.includes(phrase)) return cat;
  }
  for (const t of tokens) {
    const cat = CATEGORY_WORDS[t];
    if (cat) return cat;
  }
  return undefined;
}

function freshnessOf(b: BizRecord, now: number): "opening" | "new" | null {
  if (b.firstSalesAt && b.firstSalesAt > now) return "opening";
  if (b.permitIssuedAt && now - b.permitIssuedAt < NINETY_DAYS && b.permitIssuedAt <= now)
    return "new";
  return null;
}

/** Light singular/plural fold so "salons" matches a name token "salon". */
function fold(t: string): string {
  return t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t;
}

interface Scored<T extends BizRecord> {
  b: T;
  score: number;
}

function scoreRecord(
  b: BizRecord,
  terms: string[],
  category: string | undefined,
): number {
  let score = 0;
  const nameTokens = new Set(tokenize(b.name).map(fold));
  const catTokens = new Set(tokenize(b.category).map(fold));
  const addrTokens = new Set(tokenize(b.address).map(fold));
  if (category && b.category === category) score += 6;
  for (const raw of terms) {
    const t = fold(raw);
    if (nameTokens.has(t)) score += 4;
    else if (catTokens.has(t)) score += 2;
    else if (addrTokens.has(t)) score += 2;
  }
  if (b.featured) score += 1;
  return score;
}

/* ---------------- main entry ---------------- */

export function emptyContext(): ChatContext {
  return { terms: [], offset: 0 };
}

export function runMatch<T extends BizRecord>(
  records: T[],
  question: string,
  prior: ChatContext | undefined,
  now: number = Date.now(),
): MatchOutcome<T> {
  const rawLower = question.toLowerCase();
  const tokens = contentTokens(question);
  const ctx: ChatContext = prior
    ? { ...prior, terms: [...prior.terms] }
    : emptyContext();

  const caveats: Caveat[] = [];
  if (OTHER_TOWNS.some((t) => rawLower.includes(t))) caveats.push("leander-only");
  if (HOURS_PHONE_RE.test(rawLower)) caveats.push("no-hours-phone");
  if (ATTRIBUTE_RE.test(rawLower)) caveats.push("attributes-untracked");
  if (RATINGS_RE.test(rawLower)) caveats.push("no-ratings");

  const zipMatch = rawLower.match(/\b(786\d{2})\b/);
  const wantsNew = /\b(new|newest|recent|just opened|latest)\b/.test(rawLower);
  const wantsOpening = /\b(opening soon|opening|coming soon|not open yet)\b/.test(rawLower);
  const detectedCategory = detectCategory(rawLower, tokens);
  const isMore = MORE_RE.test(rawLower.trim()) && prior !== undefined;

  let paged = false;
  if (isMore && !detectedCategory && !zipMatch) {
    ctx.offset += PAGE_SIZE;
    paged = true;
  } else {
    if (detectedCategory) {
      if (detectedCategory !== ctx.category) ctx.offset = 0;
      ctx.category = detectedCategory;
    }
    if (zipMatch) {
      if (zipMatch[1] !== ctx.zip) ctx.offset = 0;
      ctx.zip = zipMatch[1];
    }
    if (wantsOpening) ctx.freshness = "opening";
    else if (wantsNew) ctx.freshness = "new";
    // Carry forward unmatched content terms (e.g. "tacos" after a category
    // was set) so follow-ups refine instead of restart. A question carrying
    // genuinely new terms restarts paging at the top of the refined set.
    const known = new Set<string>([
      ...Object.keys(CATEGORY_WORDS),
      ...CATEGORY_PHRASES.map(([p]) => p),
    ]);
    let hasNewTerm = false;
    for (const t of tokens) {
      if (/^\d+$/.test(t)) continue; // zip digits are a filter, not a term
      if (!known.has(t) && !ctx.terms.includes(t)) {
        ctx.terms.push(t);
        hasNewTerm = true;
      }
    }
    ctx.terms = ctx.terms.slice(-8);
    if (hasNewTerm) ctx.offset = 0;
  }

  const terms = [...new Set([...tokens, ...ctx.terms])];

  const pool = records.filter((b) => {
    if (ctx.zip && b.zip !== ctx.zip) return false;
    if (ctx.freshness && freshnessOf(b, now) !== ctx.freshness) return false;
    return true;
  });

  // A record that passed a hard filter (freshness / zip) is already a real
  // match for the ask — give it a base score so "new businesses in town"
  // doesn't depend on the word "new" appearing in a business name.
  const baseScore = ctx.freshness || ctx.zip ? 3 : 0;
  let scored: Scored<T>[] = pool
    .map((b) => ({ b, score: baseScore + scoreRecord(b, terms, ctx.category) }))
    .filter((s) => s.score > 0);

  // When a category was detected, keep the set honest: category members and
  // strong name matches only, so a stray address hit can't pollute it.
  if (ctx.category) {
    scored = scored.filter(
      (s) => s.b.category === ctx.category || s.score >= baseScore + 4,
    );
  }

  scored.sort((a, b2) => {
    if (ctx.freshness) {
      // Freshness asks read best newest-permit first.
      const pa = a.b.permitIssuedAt ?? 0;
      const pb = b2.b.permitIssuedAt ?? 0;
      if (pb !== pa) return pb - pa;
    }
    return (
      b2.score - a.score ||
      Number(b2.b.featured) - Number(a.b.featured) ||
      a.b.name.localeCompare(b2.b.name)
    );
  });

  const total = scored.length;
  const shown = scored.slice(ctx.offset, ctx.offset + PAGE_SIZE).map((s) => s.b);

  // Topic containment: a general-knowledge question shape with no detected
  // business category is refused outright, even if a word in it happens to
  // match a business name.
  if (!ctx.category && OFFTOPIC_SHAPE_RE.test(rawLower)) {
    return {
      status: "offtopic",
      total: 0,
      shown: [],
      category: undefined,
      caveats,
      context: ctx,
      paged,
    };
  }
  // With no category, no zip, no freshness and zero scored records, the
  // question carried no business signal at all.
  const hasSignal =
    Boolean(ctx.category || ctx.zip || ctx.freshness) || total > 0;
  if (!hasSignal) {
    const anyDomainWord =
      tokens.some((t) => CATEGORY_WORDS[t] !== undefined) ||
      /\b(is there|are there|find|where|near me|looking for|show me|any)\b/.test(
        rawLower,
      );
    return {
      status: anyDomainWord ? "none" : "offtopic",
      total: 0,
      shown: [],
      category: ctx.category,
      caveats,
      context: ctx,
      paged,
    };
  }
  if (total === 0 || shown.length === 0) {
    return {
      status: "none",
      total,
      shown: [],
      category: ctx.category,
      caveats,
      context: ctx,
      paged,
    };
  }
  return {
    status: "ok",
    total,
    shown,
    category: ctx.category,
    caveats,
    context: ctx,
    paged,
  };
}

/* ---------------- deterministic answer composition ---------------- */

export const CAVEAT_LINES: Record<Caveat, string> = {
  "no-hours-phone":
    "Heads up: the directory doesn't list hours or phone numbers — tap a listing for a map link and confirm current details with the business.",
  "attributes-untracked":
    "The directory comes from permit records, so it doesn't track menus, dietary options, or amenities — I matched on category and name; please confirm the specifics with the business.",
  "no-ratings":
    "There are no ratings or reviews in the directory, so I can't rank by quality — these are the matching listings, featured and then A–Z within the best matches.",
  "leander-only":
    "This directory covers Leander only, so everything below is in Leander.",
};

export function composeAnswer(outcome: MatchOutcome): string {
  if (outcome.status === "offtopic") {
    return (
      "I can only help with finding businesses in the Leander directory — " +
      "restaurants, services, shops, and other local listings. Try asking for a " +
      "kind of business (\"a plumber\", \"somewhere for dinner\") or a business name."
    );
  }
  if (outcome.status === "none") {
    const parts = [
      "I couldn't find a listing in the Leander directory that matches that.",
    ];
    if (outcome.category) {
      parts.push(
        `There are no ${outcome.category} listings that fit — the full directory below has every category to browse.`,
      );
    } else {
      parts.push(
        "Try a type of business (coffee, auto repair, salon), a business name, or a street — or browse the full directory below.",
      );
    }
    for (const c of outcome.caveats) parts.push(CAVEAT_LINES[c]);
    return parts.join(" ");
  }
  const { total, shown, category, context } = outcome;
  const from = context.offset + 1;
  const to = context.offset + shown.length;
  const label = category ? ` ${category}` : "";
  const freshLabel =
    context.freshness === "new"
      ? " newly listed"
      : context.freshness === "opening"
        ? " opening-soon"
        : "";
  const parts = [
    total === 1
      ? `Found 1${freshLabel}${label} listing in the Leander directory:`
      : `Found ${total}${freshLabel}${label} listings in the Leander directory` +
        (total > shown.length || context.offset > 0
          ? ` — showing ${from}–${to}:`
          : ":"),
  ];
  if (total > to) {
    parts.push(
      `Ask for "more" to see the next ${Math.min(PAGE_SIZE, total - to)}.`,
    );
  }
  for (const c of outcome.caveats) parts.push(CAVEAT_LINES[c]);
  return parts.join(" ");
}

/** Normalize a question for cache keys: case/space/punctuation-insensitive. */
export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
