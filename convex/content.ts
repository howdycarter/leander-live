import { internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

// Raw document for the HTTP routes (payload stays a JSON string there).
export const getDatasetInternal = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("ll_datasets")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    if (!doc) return null;
    return {
      payload: doc.payload,
      count: doc.count,
      contentHash: doc.contentHash,
      updatedAt: doc.updatedAt,
      runId: doc.runId,
    };
  },
});

// Public read path for Leander Live content. The site (once wired per
// hidden_files/runtime-data-wiring-spec-2026-11-06.md) and any other client
// can subscribe to a dataset or fetch it through the /dataset HTTP route.
export const getDataset = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("ll_datasets")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    if (!doc) return null;
    return {
      name: doc.name,
      records: JSON.parse(doc.payload) as unknown[],
      count: doc.count,
      contentHash: doc.contentHash,
      updatedAt: doc.updatedAt,
      runId: doc.runId,
    };
  },
});

export const getMeta = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("ll_datasets")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    if (!doc) return null;
    return {
      name: doc.name,
      count: doc.count,
      contentHash: doc.contentHash,
      updatedAt: doc.updatedAt,
      runId: doc.runId,
    };
  },
});
