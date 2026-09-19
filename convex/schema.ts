import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const sourceValidator = v.union(
  v.literal("community"), // submitted via the web form
  v.literal("crawl"), // ingested by the Firecrawl scheduled action
  v.literal("email"), // submitted via the AgentMail inbox
);

export const statusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

export default defineSchema({
  events: defineTable({
    title: v.string(),
    description: v.string(),
    // Optional AI-generated one-liner ("why go"), written by the OpenAI action.
    blurb: v.optional(v.string()),
    startsAt: v.number(), // unix ms
    venue: v.string(),
    source: sourceValidator,
    url: v.optional(v.string()),
    status: statusValidator,
  })
    .index("by_status_startsAt", ["status", "startsAt"])
    .index("by_startsAt", ["startsAt"]),
});
