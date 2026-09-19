import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { statusValidator } from "./schema";

/** Real-time feed: approved, upcoming events, soonest first. */
export const listUpcoming = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db
      .query("events")
      .withIndex("by_status_startsAt", (q) =>
        q.eq("status", "approved").gte("startsAt", now),
      )
      .order("asc")
      .take(args.limit ?? 50);
  },
});

/** Community submission from the web form. Lands as pending for review. */
export const submit = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    startsAt: v.number(),
    venue: v.string(),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim();
    const description = args.description.trim();
    const venue = args.venue.trim();
    if (title.length === 0) throw new Error("Title is required.");
    if (description.length === 0) throw new Error("Description is required.");
    if (venue.length === 0) throw new Error("Venue is required.");
    if (!(args.startsAt > Date.now() - 24 * 60 * 60 * 1000)) {
      throw new Error("Event date must be in the future.");
    }
    return await ctx.db.insert("events", {
      title: title.slice(0, 120),
      description: description.slice(0, 2000),
      startsAt: args.startsAt,
      venue: venue.slice(0, 160),
      source: "community",
      url: args.url?.trim() || undefined,
      status: "pending",
    });
  },
});

/** Moderation: flip an event's status (used by crawled/emailed submissions too). */
export const setStatus = mutation({
  args: { id: v.id("events"), status: statusValidator },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
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
    await ctx.db.patch(args.id, { blurb: args.blurb.slice(0, 280) });
  },
});

/** Insert from the Firecrawl ingestion action. Approved only if it parses cleanly. */
export const upsertCrawled = internalMutation({
  args: {
    title: v.string(),
    description: v.string(),
    startsAt: v.number(),
    venue: v.string(),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("events", {
      title: args.title.slice(0, 120),
      description: args.description.slice(0, 2000),
      startsAt: args.startsAt,
      venue: args.venue.slice(0, 160),
      source: "crawl",
      url: args.url,
      status: "approved",
    });
  },
});

/** Insert from the AgentMail inbound webhook. Always pending until reviewed. */
export const insertFromEmail = internalMutation({
  args: { from: v.string(), subject: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    // TODO: parse date/venue from the email body (or route through summarize).
    return await ctx.db.insert("events", {
      title: args.subject.slice(0, 120) || `Submission from ${args.from}`,
      description: args.body.slice(0, 2000),
      startsAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // placeholder until parsing lands
      venue: "TBD — parsed from email",
      source: "email",
      status: "pending",
    });
  },
});
