import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Directory chat backend for /businesses.
 *
 * `directoryBusinesses` is the 821-row Texas sales-tax permit directory
 * (name / category / address / zip / permit dates only). Rate-limit,
 * cache, and spend tables support the HTTP action in http.ts.
 */
export default defineSchema({
  directoryBusinesses: defineTable({
    listingId: v.string(),
    name: v.string(),
    category: v.string(),
    naics: v.string(),
    address: v.string(),
    zip: v.string(),
    permitIssuedAt: v.optional(v.number()),
    firstSalesAt: v.optional(v.number()),
    featured: v.boolean(),
    source: v.string(),
    sourceUrl: v.optional(v.string()),
  }).index("by_listingId", ["listingId"]),

  directoryChatWindows: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),

  directoryChatCache: defineTable({
    cacheKey: v.string(),
    reply: v.string(),
    matches: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        category: v.string(),
        address: v.string(),
        zip: v.string(),
        featured: v.boolean(),
        permitIssuedAt: v.optional(v.number()),
        firstSalesAt: v.optional(v.number()),
      }),
    ),
    mode: v.string(),
    notice: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_cacheKey", ["cacheKey"]),

  directoryChatBudget: defineTable({
    day: v.string(),
    estimatedUsd: v.number(),
    promptTokens: v.number(),
    completionTokens: v.number(),
  }).index("by_day", ["day"]),
});
