import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { categoryValidator } from "./schema";

/**
 * TEMPORARY — one-off manual ingestion helper (2026-09-19).
 * Wraps the real `internal.events.upsertCrawled` (same dedup, same
 * source="crawl", same approved status) plus the summarize kickoff.
 * DELETE THIS FILE after the manual fill-up; the weekly cron
 * (`internal.ingestion.crawlLeander`) is the durable path.
 */
export const adminUpsertCrawled = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    startsAt: v.number(),
    venue: v.string(),
    category: v.optional(categoryValidator),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ eventId: Id<"events"> | null }> => {
    const { eventId } = await ctx.runMutation(internal.events.upsertCrawled, {
      title: args.title,
      description: args.description,
      startsAt: args.startsAt,
      venue: args.venue,
      category: args.category,
      url: args.url,
    });
    if (eventId) {
      await ctx.scheduler.runAfter(0, internal.summarize.summarizeEvent, {
        eventId,
      });
    }
    return { eventId };
  },
});
