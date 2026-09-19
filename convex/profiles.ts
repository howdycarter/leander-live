import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

/** The currently signed-in user, or null for guests. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { _id: user._id, name: user.name ?? null, email: user.email ?? null, image: user.image ?? null };
  },
});

/** Saved event ids for the signed-in user (empty for guests). */
export const getSaved = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return profile?.savedEventIds ?? [];
  },
});

async function getOrCreateProfile(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("profiles", {
    userId,
    savedEventIds: [],
    updatedAt: Date.now(),
  });
  return (await ctx.db.get(id))!;
}

/** Toggle one saved event for the signed-in user. */
export const toggleSaved = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to save events across devices.");
    const profile = await getOrCreateProfile(ctx, userId);
    const has = profile.savedEventIds.some((id) => id === args.eventId);
    const savedEventIds = has
      ? profile.savedEventIds.filter((id) => id !== args.eventId)
      : [...profile.savedEventIds, args.eventId];
    await ctx.db.patch(profile._id, { savedEventIds, updatedAt: Date.now() });
    return { saved: !has };
  },
});

/**
 * Merge guest (localStorage) saves into the server profile on sign-in.
 * Idempotent — union of both sets.
 */
export const mergeSaved = mutation({
  args: { eventIds: v.array(v.id("events")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { merged: 0 };
    const profile = await getOrCreateProfile(ctx, userId);
    const union = [...profile.savedEventIds];
    for (const id of args.eventIds) {
      if (!union.some((x) => x === id)) union.push(id);
    }
    await ctx.db.patch(profile._id, { savedEventIds: union, updatedAt: Date.now() });
    return { merged: union.length };
  },
});
