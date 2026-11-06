import {
  internalMutationGeneric,
  mutationGeneric,
  type GenericMutationCtx,
} from "convex/server";
import { v } from "convex/values";
import {
  CACHE_TTL_MS,
  DEFAULT_DAILY_USD,
  MAX_QUERY_LENGTH,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  retrieveListings,
  toPublicMatch,
  utcDayKey,
  type DirectoryListing,
} from "./directoryLogic";

const listingValidator = v.object({
  id: v.string(),
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
});

const publicMatchValidator = v.object({
  id: v.string(),
  name: v.string(),
  category: v.string(),
  address: v.string(),
  zip: v.string(),
  featured: v.boolean(),
  permitIssuedAt: v.optional(v.number()),
  firstSalesAt: v.optional(v.number()),
});

function dailyCapUsd(): number {
  const raw = process.env.DIRECTORY_CHAT_DAILY_USD;
  const parsed = raw ? Number(raw) : DEFAULT_DAILY_USD;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_USD;
}

function toListing(doc: {
  listingId: string;
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
}): DirectoryListing {
  return {
    id: doc.listingId,
    name: doc.name,
    category: doc.category,
    naics: doc.naics,
    address: doc.address,
    zip: doc.zip,
    permitIssuedAt: doc.permitIssuedAt,
    firstSalesAt: doc.firstSalesAt,
    featured: doc.featured,
    source: doc.source,
    sourceUrl: doc.sourceUrl,
  };
}

/**
 * Operator-only upsert of permit-directory rows. Requires Convex env
 * DIRECTORY_SEED_KEY; refuses when that env is unset.
 */
export const seedBatch = mutationGeneric({
  args: {
    adminKey: v.string(),
    listings: v.array(listingValidator),
  },
  handler: async (ctx, args) => {
    const expected = process.env.DIRECTORY_SEED_KEY;
    if (!expected || args.adminKey !== expected) {
      throw new Error("seed disabled");
    }
    let upserted = 0;
    for (const listing of args.listings) {
      const existing = await ctx.db
        .query("directoryBusinesses")
        .withIndex("by_listingId", (q) => q.eq("listingId", listing.id))
        .unique();
      const fields = {
        listingId: listing.id,
        name: listing.name,
        category: listing.category,
        naics: listing.naics,
        address: listing.address,
        zip: listing.zip,
        permitIssuedAt: listing.permitIssuedAt,
        firstSalesAt: listing.firstSalesAt,
        featured: listing.featured,
        source: listing.source,
        sourceUrl: listing.sourceUrl,
      };
      if (existing) {
        await ctx.db.replace(existing._id, fields);
      } else {
        await ctx.db.insert("directoryBusinesses", fields);
      }
      upserted += 1;
    }
    return { upserted };
  },
});

async function bumpWindow(
  ctx: GenericMutationCtx<any>,
  key: string,
  now: number,
): Promise<boolean> {
  const existing = await ctx.db
    .query("directoryChatWindows")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!existing) {
    await ctx.db.insert("directoryChatWindows", {
      key,
      windowStart: now,
      count: 1,
    });
    return true;
  }
  const expired = now - existing.windowStart > RATE_LIMIT_WINDOW_MS;
  if (expired) {
    await ctx.db.patch(existing._id, { windowStart: now, count: 1 });
    return true;
  }
  if (existing.count >= RATE_LIMIT_MAX) return false;
  await ctx.db.patch(existing._id, { count: existing.count + 1 });
  return true;
}

export const consumeQuota = internalMutationGeneric({
  args: {
    ipHash: v.string(),
    sessionId: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const ipAllowed = await bumpWindow(ctx, `ip:${args.ipHash}`, args.now);
    const sessionAllowed = await bumpWindow(
      ctx,
      `session:${args.sessionId.slice(0, 64)}`,
      args.now,
    );
    return { allowed: ipAllowed && sessionAllowed };
  },
});

export const gateAndRetrieve = internalMutationGeneric({
  args: {
    query: v.string(),
    cacheKey: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.query.length > MAX_QUERY_LENGTH) {
      return { status: "too_long" as const };
    }

    const cached = await ctx.db
      .query("directoryChatCache")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    if (cached && args.now - cached.createdAt < CACHE_TTL_MS) {
      return {
        status: "cached" as const,
        reply: cached.reply,
        matches: cached.matches,
        mode: cached.mode,
        notice: cached.notice,
      };
    }

    const day = utcDayKey(args.now);
    const budget = await ctx.db
      .query("directoryChatBudget")
      .withIndex("by_day", (q) => q.eq("day", day))
      .unique();
    const spent = budget?.estimatedUsd ?? 0;
    const budgetTripped = spent >= dailyCapUsd();

    const docs = await ctx.db.query("directoryBusinesses").collect();
    if (docs.length === 0) {
      return { status: "empty_index" as const, budgetTripped };
    }
    const listings = docs.map(toListing);
    const matches = retrieveListings(listings, args.query, args.now);
    return {
      status: "ok" as const,
      budgetTripped,
      listings: matches,
      matches: matches.map(toPublicMatch),
    };
  },
});

export const rememberTurn = internalMutationGeneric({
  args: {
    cacheKey: v.string(),
    reply: v.string(),
    matches: v.array(publicMatchValidator),
    mode: v.string(),
    notice: v.optional(v.string()),
    promptTokens: v.number(),
    completionTokens: v.number(),
    estimatedUsd: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("directoryChatCache")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    const cacheFields = {
      cacheKey: args.cacheKey,
      reply: args.reply,
      matches: args.matches,
      mode: args.mode,
      notice: args.notice,
      createdAt: args.now,
    };
    if (existing) await ctx.db.replace(existing._id, cacheFields);
    else await ctx.db.insert("directoryChatCache", cacheFields);

    if (args.estimatedUsd <= 0 && args.promptTokens <= 0) return;
    const day = utcDayKey(args.now);
    const budget = await ctx.db
      .query("directoryChatBudget")
      .withIndex("by_day", (q) => q.eq("day", day))
      .unique();
    if (budget) {
      await ctx.db.patch(budget._id, {
        estimatedUsd: budget.estimatedUsd + args.estimatedUsd,
        promptTokens: budget.promptTokens + args.promptTokens,
        completionTokens: budget.completionTokens + args.completionTokens,
      });
    } else {
      await ctx.db.insert("directoryChatBudget", {
        day,
        estimatedUsd: args.estimatedUsd,
        promptTokens: args.promptTokens,
        completionTokens: args.completionTokens,
      });
    }
  },
});
