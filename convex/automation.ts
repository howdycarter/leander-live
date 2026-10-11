import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** A deployment-wide call ceiling; disabled unless the owner enables it. */
export const reserve = internalMutation({
  args: { scope: v.union(v.literal("chat"), v.literal("crawl"), v.literal("summary")) },
  handler: async (ctx, { scope }) => {
    if (process.env.AUTOMATION_ENABLED !== "true") return false;
    const configured = Number(process.env.AUTOMATION_DAILY_CALL_LIMIT ?? "0");
    if (!Number.isSafeInteger(configured) || configured <= 0) return false;
    const limit = Math.min(configured, 100);
    const day = new Date().toISOString().slice(0, 10);
    // All paid automation shares this single counter, so rotating session IDs
    // cannot bypass the deployment-wide ceiling.
    const usage = await ctx.db.query("automationUsage").withIndex("by_scope_day", q => q.eq("scope", "all").eq("day", day)).first();
    if ((usage?.count ?? 0) >= limit) return false;
    if (usage) await ctx.db.patch(usage._id, { count: usage.count + 1 });
    else await ctx.db.insert("automationUsage", { scope: "all", day, count: 1 });
    // Scope is deliberately validated, even though the cap is shared.
    return ["chat", "crawl", "summary"].includes(scope);
  },
});
