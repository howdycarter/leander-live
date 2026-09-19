import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Mini-CRM: lead pipeline + businesses.
 *
 * Hackathon slice of the lead-marketplace vision: every captured lead
 * (form / chat / phone) lands in `businessLeads` with a source + pipeline
 * status, and can be worked through new → contacted → qualified → sold →
 * closed, assigned to the right business by vertical match.
 *
 * Gating: every function requires `adminKey`, compared against the Convex
 * ADMIN_KEY env var (fail-closed when unset). This is a simple shared-secret
 * gate for the hackathon demo — proper per-user auth (Convex Auth) is the
 * documented follow-up in hackathon.md.
 */

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "sold",
  "closed",
] as const;

export const BUSINESS_STATUSES = ["prospect", "active", "paused"] as const;

function requireAdmin(adminKey: string) {
  const expected = process.env.ADMIN_KEY;
  if (!expected || adminKey !== expected) {
    throw new Error("Not authorized.");
  }
}

function checkStatus(status: string) {
  if (!(LEAD_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Unknown status: ${status}`);
  }
}

async function withBusinessName(ctx: any, lead: any) {
  let assignedBusiness = null;
  if (lead.assignedBusinessId) {
    assignedBusiness = await ctx.db.get(lead.assignedBusinessId);
  }
  return { ...lead, assignedBusinessName: assignedBusiness?.name ?? null };
}

export const listLeads = query({
  args: { adminKey: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const q = args.status
      ? ctx.db
          .query("businessLeads")
          .withIndex("by_status", (idx) => idx.eq("status", args.status!))
      : ctx.db.query("businessLeads");
    const leads = await q.order("desc").take(200);
    return Promise.all(leads.map((l) => withBusinessName(ctx, l)));
  },
});

export const getLead = query({
  args: { adminKey: v.string(), leadId: v.id("businessLeads") },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found.");
    // "Sell to the right business": candidates sharing the lead's vertical.
    const matches = await ctx.db
      .query("businesses")
      .withIndex("by_vertical", (q) => q.eq("vertical", lead.vertical))
      .take(50);
    const others = await ctx.db.query("businesses").take(50);
    const seen = new Set(matches.map((b) => b._id.toString()));
    const candidates = [
      ...matches,
      ...others.filter((b) => !seen.has(b._id.toString())),
    ].slice(0, 50);
    return { ...(await withBusinessName(ctx, lead)), candidates };
  },
});

export const moveLeadStage = mutation({
  args: {
    adminKey: v.string(),
    leadId: v.id("businessLeads"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    checkStatus(args.status);
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found.");
    await ctx.db.patch(args.leadId, { status: args.status, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const assignLead = mutation({
  args: {
    adminKey: v.string(),
    leadId: v.id("businessLeads"),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const [lead, business] = await Promise.all([
      ctx.db.get(args.leadId),
      ctx.db.get(args.businessId),
    ]);
    if (!lead) throw new Error("Lead not found.");
    if (!business) throw new Error("Business not found.");
    await ctx.db.patch(args.leadId, {
      assignedBusinessId: args.businessId,
      updatedAt: Date.now(),
    });
    return { ok: true, businessName: business.name };
  },
});

export const markSold = mutation({
  args: {
    adminKey: v.string(),
    leadId: v.id("businessLeads"),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found.");
    if (!Number.isFinite(args.price) || args.price < 0) {
      throw new Error("Enter a valid sale price.");
    }
    await ctx.db.patch(args.leadId, {
      status: "sold",
      salePrice: Math.round(args.price * 100) / 100,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const addLeadNote = mutation({
  args: {
    adminKey: v.string(),
    leadId: v.id("businessLeads"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found.");
    const note = args.note.trim().slice(0, 1000);
    if (!note) throw new Error("Note is empty.");
    const stamp = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const notes = lead.notes ? `${lead.notes}\n[${stamp}] ${note}` : `[${stamp}] ${note}`;
    await ctx.db.patch(args.leadId, { notes, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const listBusinesses = query({
  args: { adminKey: v.string() },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    return await ctx.db.query("businesses").order("desc").take(200);
  },
});

export const createBusiness = mutation({
  args: {
    adminKey: v.string(),
    name: v.string(),
    vertical: v.string(),
    contactName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    const name = args.name.trim();
    const contactName = args.contactName.trim();
    if (!name) throw new Error("Business name is required.");
    if (!contactName) throw new Error("Contact name is required.");
    return await ctx.db.insert("businesses", {
      name: name.slice(0, 160),
      vertical: args.vertical.trim().slice(0, 60) || "Other",
      contactName: contactName.slice(0, 120),
      email: args.email?.trim().toLowerCase() || undefined,
      phone: args.phone?.trim().slice(0, 40) || undefined,
      status: "prospect",
      createdAt: Date.now(),
    });
  },
});

export const setBusinessStatus = mutation({
  args: {
    adminKey: v.string(),
    businessId: v.id("businesses"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminKey);
    if (!(BUSINESS_STATUSES as readonly string[]).includes(args.status)) {
      throw new Error(`Unknown business status: ${args.status}`);
    }
    const business = await ctx.db.get(args.businessId);
    if (!business) throw new Error("Business not found.");
    await ctx.db.patch(args.businessId, { status: args.status });
    return { ok: true };
  },
});
