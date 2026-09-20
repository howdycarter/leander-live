import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Service-request pipeline: residents who need a local pro.
 *
 * Mirrors the businessLeads CRM pattern: capture (chat / form / phone) →
 * new → contacted → assigned → sold → closed. A request is "sold" when a
 * partner business pays for the qualified lead.
 */

export const SERVICE_CATEGORIES = [
  "Plumbing",
  "HVAC",
  "Electrical",
  "Roofing",
  "Lawn & Yard",
  "Cleaning",
  "Pest Control",
  "Handyman",
  "Other",
] as const;

export const SERVICE_STATUSES = [
  "new",
  "contacted",
  "assigned",
  "sold",
  "closed",
] as const;

function requireAdmin(adminKey: string) {
  const expected = process.env.ADMIN_KEY;
  if (!expected || adminKey !== expected) {
    throw new Error("Not authorized.");
  }
}

function checkStatus(status: string) {
  if (!(SERVICE_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Unknown status: ${status}`);
  }
}

/** Public: submit a service request (chat qualifier or form). */
export const submit = mutation({
  args: {
    service: v.string(),
    description: v.optional(v.string()),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const service = args.service.trim().slice(0, 60) || "Other";
    if (!name) throw new Error("Name is required.");
    const email = args.email?.trim().toLowerCase() || undefined;
    const phone = args.phone?.trim().slice(0, 40) || undefined;
    if (!email && !phone) {
      throw new Error("An email or phone number is required.");
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("That email doesn't look right.");
    }
    const now = Date.now();
    return await ctx.db.insert("serviceRequests", {
      service,
      description: args.description?.trim().slice(0, 1000) || undefined,
      name: name.slice(0, 120),
      email,
      phone,
      source: args.source?.trim().slice(0, 20) || "chat",
      status: "new",
      createdAt: now,
      updatedAt: now,
    });
  },
});

async function withBusinessName(ctx: any, req: any) {
  let assignedBusiness = null;
  if (req.assignedBusinessId) {
    assignedBusiness = await ctx.db.get(req.assignedBusinessId);
  }
  return { ...req, assignedBusinessName: assignedBusiness?.name ?? null };
}

export const list = query({
  args: { adminKey: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const q = args.status
      ? ctx.db
          .query("serviceRequests")
          .withIndex("by_status", (idx) => idx.eq("status", args.status!))
      : ctx.db.query("serviceRequests");
    const reqs = await q.order("desc").take(200);
    return Promise.all(reqs.map((r) => withBusinessName(ctx, r)));
  },
});

export const moveStage = mutation({
  args: {
    adminKey: v.string(),
    requestId: v.id("serviceRequests"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    checkStatus(args.status);
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found.");
    await ctx.db.patch(args.requestId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const assign = mutation({
  args: {
    adminKey: v.string(),
    requestId: v.id("serviceRequests"),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const [req, business] = await Promise.all([
      ctx.db.get(args.requestId),
      ctx.db.get(args.businessId),
    ]);
    if (!req) throw new Error("Request not found.");
    if (!business) throw new Error("Business not found.");
    await ctx.db.patch(args.requestId, {
      assignedBusinessId: args.businessId,
      status: "assigned",
      updatedAt: Date.now(),
    });
    return { ok: true, businessName: business.name };
  },
});

export const markSold = mutation({
  args: {
    adminKey: v.string(),
    requestId: v.id("serviceRequests"),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found.");
    if (!Number.isFinite(args.price) || args.price < 0) {
      throw new Error("Enter a valid sale price.");
    }
    await ctx.db.patch(args.requestId, {
      status: "sold",
      salePrice: Math.round(args.price * 100) / 100,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const addNote = mutation({
  args: {
    adminKey: v.string(),
    requestId: v.id("serviceRequests"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found.");
    const note = args.note.trim().slice(0, 1000);
    if (!note) throw new Error("Note is empty.");
    const stamp = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const notes = req.notes
      ? `${req.notes}\n[${stamp}] ${note}`
      : `[${stamp}] ${note}`;
    await ctx.db.patch(args.requestId, { notes, updatedAt: Date.now() });
    return { ok: true };
  },
});
