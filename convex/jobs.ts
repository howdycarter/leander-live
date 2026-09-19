import { internalMutation, mutation, query } from "./_generated/server";
import { v, type GenericId } from "convex/values";
import { jobTypeValidator, statusValidator } from "./schema";

/**
 * Jobs board.
 *
 * Gating mirrors convex/crm.ts: every admin function requires `adminKey`,
 * compared against the Convex ADMIN_KEY env var (fail-closed when unset).
 */

function requireAdmin(adminKey: string) {
  const expected = process.env.ADMIN_KEY;
  if (!expected || adminKey !== expected) {
    throw new Error("Not authorized.");
  }
}

/** Community jobs live 60 days unless an explicit expiry is set. */
const JOB_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function isLive(job: { expiresAt?: number }, now: number): boolean {
  return !job.expiresAt || job.expiresAt > now;
}

/** Public feed: approved, unexpired jobs — featured first, then newest. */
export const listJobs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .take(args.limit ?? 100);
    return rows
      .filter((j) => isLive(j, now))
      .sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return b.submittedAt - a.submittedAt;
      });
  },
});

/** Community submission from the web form. Lands as pending for review. */
export const submitJob = mutation({
  args: {
    title: v.string(),
    company: v.string(),
    location: v.string(),
    type: jobTypeValidator,
    payRange: v.optional(v.string()),
    description: v.string(),
    applyUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim();
    const company = args.company.trim();
    const location = args.location.trim();
    const description = args.description.trim();
    const applyUrl = args.applyUrl.trim();
    if (title.length === 0) throw new Error("Job title is required.");
    if (company.length === 0) throw new Error("Company is required.");
    if (location.length === 0) throw new Error("Location is required.");
    if (description.length === 0) throw new Error("Description is required.");
    if (!/^https?:\/\//i.test(applyUrl)) {
      throw new Error("Apply link must be a valid http(s) URL.");
    }
    return await ctx.db.insert("jobs", {
      title: title.slice(0, 120),
      company: company.slice(0, 120),
      location: location.slice(0, 160),
      type: args.type,
      payRange: args.payRange?.trim().slice(0, 80) || undefined,
      description: description.slice(0, 4000),
      applyUrl,
      source: "community",
      featured: false,
      status: "pending",
      submittedAt: Date.now(),
      expiresAt: Date.now() + JOB_TTL_MS,
    });
  },
});

/** Admin moderation queue: pending community submissions. */
export const listPendingJobs = query({
  args: { adminKey: v.string() },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const rows = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(100);
    return rows;
  },
});

/** Moderation: approve/reject a job, optionally toggle featured placement. */
export const approveJob = mutation({
  args: {
    id: v.id("jobs"),
    status: statusValidator,
    featured: v.optional(v.boolean()),
    adminKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    await ctx.db.patch(args.id, {
      status: args.status,
      ...(args.featured !== undefined ? { featured: args.featured } : {}),
    });
  },
});

/**
 * Insert from the Firecrawl ingestion action.
 * Dedupes on (title, company) so re-crawls don't duplicate.
 * Crawled rows go live as "approved" — they come from employer postings.
 */
export const upsertCrawledJob = internalMutation({
  args: {
    title: v.string(),
    company: v.string(),
    location: v.string(),
    type: jobTypeValidator,
    payRange: v.optional(v.string()),
    description: v.string(),
    applyUrl: v.string(),
    featured: v.optional(v.boolean()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ jobId: GenericId<"jobs"> | null }> => {
    const title = args.title.trim().slice(0, 120);
    const company = args.company.trim().slice(0, 120);
    if (!title || !company || !/^https?:\/\//i.test(args.applyUrl.trim())) {
      return { jobId: null };
    }
    const approved = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .take(200);
    const dupe = approved.find(
      (j) =>
        j.title.trim().toLowerCase() === title.toLowerCase() &&
        j.company.trim().toLowerCase() === company.toLowerCase(),
    );
    if (dupe) return { jobId: dupe._id };
    const jobId = await ctx.db.insert("jobs", {
      title,
      company,
      location: args.location.trim().slice(0, 160) || "Leander, TX",
      type: args.type,
      payRange: args.payRange?.trim().slice(0, 80) || undefined,
      description: args.description.trim().slice(0, 4000),
      applyUrl: args.applyUrl.trim(),
      source: "crawl",
      featured: args.featured ?? false,
      status: "approved",
      submittedAt: Date.now(),
      expiresAt: args.expiresAt,
    });
    return { jobId };
  },
});
