import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v, type GenericId } from "convex/values";
import { categoryValidator, statusValidator, type Category } from "./schema";
import { requireAdmin, safeSourceUrl, assertReviewedEvent } from "./lib/policy";

/** Real-time feed: approved, upcoming events, soonest first. */
export const listUpcoming = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = Math.min(50, Math.max(1, Math.floor(args.limit ?? 50)));
    const candidates = await ctx.db.query("events")
      .withIndex("by_status_startsAt", q => q.eq("status", "approved").gte("startsAt", now - 86400000))
      .order("asc").take(200);
    return candidates.filter(event => {
      try { assertReviewedEvent(event, now); return true; } catch { return false; }
    }).slice(0, limit);
  },
});

/** Community submission from the web form. Lands as pending for review. */
export const submit = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    startsAt: v.number(),
    venue: v.string(),
    category: v.optional(categoryValidator),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim();
    const description = args.description.trim();
    const venue = args.venue.trim();
    if (title.length === 0) throw new Error("Title is required.");
    if (description.length === 0) throw new Error("Description is required.");
    if (venue.length === 0) throw new Error("Venue is required.");
    if (!Number.isFinite(args.startsAt) || args.startsAt <= Date.now()) {
      throw new Error("Event date must be in the future.");
    }
    return await ctx.db.insert("events", {
      title: title.slice(0, 120),
      description: description.slice(0, 2000),
      startsAt: args.startsAt,
      venue: venue.slice(0, 160),
      category: args.category,
      source: "community",
      url: safeSourceUrl(args.url),
      status: "pending",
    });
  },
});

/** Existing ADMIN_KEY protects moderation; no key means no access. */
export const listForReview = query({
  args: { adminKey: v.string() },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    return ctx.db.query("events").order("desc").take(100);
  },
});

export const setStatus = mutation({
  args: { adminKey: v.string(), id: v.id("events"), status: statusValidator },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const event = await ctx.db.get(args.id);
    if (!event) throw new Error("Event not found.");
    if (args.status === "approved") assertReviewedEvent(event, Date.now());
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const review = mutation({
  args: { adminKey: v.string(), id: v.id("events"), startsAt: v.number(), endsAt: v.number(), venue: v.string(), url: v.string(), sourceChecked: v.boolean() },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    if (!args.sourceChecked) throw new Error("Check the original source before approving.");
    if (!await ctx.db.get(args.id)) throw new Error("Event not found.");
    const reviewed = { startsAt: args.startsAt, endsAt: args.endsAt, venue: args.venue.trim().slice(0, 160), url: safeSourceUrl(args.url), checkedAt: Date.now(), detailsIncomplete: false };
    assertReviewedEvent(reviewed, Date.now());
    await ctx.db.patch(args.id, { ...reviewed, status: "approved" });
  },
});

export const getById = internalQuery({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const setBlurb = internalMutation({
  args: { id: v.id("events"), blurb: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { blurbDraft: args.blurb.slice(0, 280) });
  },
});

/**
 * Insert from the Firecrawl ingestion action.
 * Dedupes by original source URL; changed facts return to the review queue.
 * Crawled records always need human source verification before publication.
 */
export const upsertCrawled = internalMutation({
  args: {
    title: v.string(),
    description: v.string(),
    startsAt: v.number(),
    venue: v.string(),
    category: v.optional(categoryValidator),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ eventId: GenericId<"events"> | null }> => {
    const title = args.title.trim().slice(0, 120);
    const url = safeSourceUrl(args.url);
    if (!title || !url || !args.venue.trim() || !Number.isFinite(args.startsAt)) throw new Error("Incomplete source event.");
    const hostname = new URL(url).hostname;
    if (!["www.leandertx.gov", "leandertx.gov", "visitleandertx.com", "www.visitleandertx.com"].includes(hostname)) throw new Error("Unapproved crawl source.");
    const existing = await ctx.db.query("events").withIndex("by_url", q => q.eq("url", url)).first();
    if (existing) {
      const description = args.description.trim().slice(0, 2000), venue = args.venue.trim().slice(0, 160);
      if (existing.title === title && existing.startsAt === args.startsAt && existing.venue === venue && existing.description === description && existing.category === args.category) return { eventId: null };
      await ctx.db.patch(existing._id, {title, description, startsAt:args.startsAt, venue, category:args.category, status:"pending", checkedAt:undefined, endsAt:undefined, blurbDraft:undefined});
      return { eventId: existing._id };
    }
    const eventId = await ctx.db.insert("events", {
      title,
      description: args.description.trim().slice(0, 2000),
      startsAt: args.startsAt,
      venue: args.venue.trim().slice(0, 160),
      category: args.category,
      source: "crawl",
      url: safeSourceUrl(args.url),
      status: "pending",
    });
    return { eventId };
  },
});

// ---------------------------------------------------------------------------
// AgentMail inbound email parsing
// ---------------------------------------------------------------------------

const MONTHS =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

function cleanSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd?)\s*:\s*/gi, "")
    .replace(/\[leander live\]\s*/gi, "")
    .trim();
}

function cleanBody(body: string): string {
  return body
    .split("\n")
    .filter((line) => !/^\s*(--|__|sent from|on .+ wrote:)\s*$/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2000);
}

/** Hunt the body for a date; returns unix ms, or null if nothing parseable. */
function extractDate(text: string, now: number): number | null {
  const patterns: RegExp[] = [
    new RegExp(
      `${MONTHS}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*\\d{4})?(?:\\s*(?:at\\s*)?\\d{1,2}(?::\\d{2})?\\s*(?:am|pm))?`,
      "i",
    ),
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/,
    /\b\d{4}-\d{2}-\d{2}\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const t = new Date(match[0]).getTime();
    if (!Number.isNaN(t) && t > now - 24 * 60 * 60 * 1000) return t;
  }
  return null;
}

/** Look for an explicit "Venue: X" / "Where: X" line. */
function extractVenue(text: string): string | null {
  const match = text.match(
    /(?:venue|where|location|place)\s*[:\-–]\s*([^\n]{2,80})/i,
  );
  return match ? match[1].trim() : null;
}

function guessCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/\b(music|concert|band|\bdj\b|bluegrass|choir|symphony)\b/.test(t))
    return "Music";
  if (
    /\b(food|bbq|barbecue|taco|food truck|brew|beer|wine|dinner|lunch|brunch|restaurant|coffee)\b/.test(
      t,
    )
  )
    return "Food & Drink";
  if (
    /\b(kid|family|families|children|toddler|story ?time|easter|santa|trick.or.treat)\b/.test(
      t,
    )
  )
    return "Family";
  if (
    /\b(park|trail|hike|hiking|outdoor|lake|pool|kite|yoga|run\b|5k|10k|camp|fishing|disc golf)\b/.test(
      t,
    )
  )
    return "Outdoors";
  if (
    /\b(workshop|class|learn|course|seminar|book|library|resume|school|training)\b/.test(
      t,
    )
  )
    return "Learn";
  return "Community";
}

/**
 * Insert from the AgentMail inbound webhook. Always pending until reviewed.
 * Missing facts remain incomplete and cannot pass publication review.
 */
export const insertFromEmail = internalMutation({
  args: {
    from: v.string(),
    subject: v.string(),
    body: v.string(),
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const description = cleanBody(args.body);
    let title = cleanSubject(args.subject);
    if (!title) {
      title =
        description.split("\n").find((l) => l.trim().length > 0)?.trim() ??
        `Submission from ${args.from}`;
    }
    const startsAt = extractDate(`${args.subject}\n${description}`, now) ??
      0;
    const venue = extractVenue(description) ?? "";
    return await ctx.db.insert("events", {
      title: title.slice(0, 120),
      description: description || "(no description provided)",
      startsAt,
      venue: venue.slice(0, 160),
      category: guessCategory(`${title}\n${description}`),
      source: "email",
      detailsIncomplete: true,
      status: "pending",
    });
  },
});

// ---------------------------------------------------------------------------
// Webhook idempotency
// ---------------------------------------------------------------------------

/** Record a processed Svix delivery id. Returns false if already seen. */
export const recordWebhookEvent = internalMutation({
  args: {
    svixId: v.string(),
    eventType: v.string(),
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ isNew: boolean }> => {
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_svixId", (q) => q.eq("svixId", args.svixId))
      .first();
    if (existing) return { isNew: false };
    await ctx.db.insert("webhookEvents", {
      svixId: args.svixId,
      eventType: args.eventType,
      messageId: args.messageId,
      receivedAt: Date.now(),
    });
    return { isNew: true };
  },
});
