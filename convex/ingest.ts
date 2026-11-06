import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Internal write path for the Dragon Automation pipeline. Called only by the
// /ingest HTTP action after it verifies the shared ingest secret.
//
// Semantics: whole-set replace per content type. The runner sends the full
// normalized record set (the scrapers already merge keep-on-failure per
// source, so a dead source never shrinks the set). Record ids must be unique
// within the set — a duplicate rejects the whole publish loudly instead of
// silently producing a corrupt dataset.
export const replaceDataset = internalMutation({
  args: {
    name: v.string(),
    payload: v.string(),
    count: v.number(),
    contentHash: v.string(),
    runId: v.string(),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let records: unknown;
    try {
      records = JSON.parse(args.payload);
    } catch {
      await ctx.db.insert("ll_ingest_runs", {
        runId: args.runId,
        dataset: args.name,
        status: "rejected",
        count: 0,
        contentHash: args.contentHash,
        startedAt: args.startedAt,
        finishedAt: now,
        error: "payload is not valid JSON",
      });
      throw new Error("ingest rejected: payload is not valid JSON");
    }
    if (!Array.isArray(records) || records.length !== args.count) {
      await ctx.db.insert("ll_ingest_runs", {
        runId: args.runId,
        dataset: args.name,
        status: "rejected",
        count: Array.isArray(records) ? records.length : 0,
        contentHash: args.contentHash,
        startedAt: args.startedAt,
        finishedAt: now,
        error: "count mismatch",
      });
      throw new Error("ingest rejected: count mismatch");
    }
    const ids = new Set<string>();
    for (const r of records as Array<{ id?: unknown }>) {
      if (typeof r?.id !== "string" || r.id === "") {
        throw new Error("ingest rejected: record without a string id");
      }
      if (ids.has(r.id)) {
        throw new Error(`ingest rejected: duplicate id ${r.id}`);
      }
      ids.add(r.id);
    }

    const existing = await ctx.db
      .query("ll_datasets")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    const doc = {
      name: args.name,
      payload: args.payload,
      count: args.count,
      contentHash: args.contentHash,
      updatedAt: now,
      runId: args.runId,
    };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
    } else {
      await ctx.db.insert("ll_datasets", doc);
    }
    await ctx.db.insert("ll_ingest_runs", {
      runId: args.runId,
      dataset: args.name,
      status: "ok",
      count: args.count,
      contentHash: args.contentHash,
      startedAt: args.startedAt,
      finishedAt: now,
    });
    return { ok: true, count: args.count, updatedAt: now };
  },
});
