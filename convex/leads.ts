import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Lead capture — the two-sided model:
 *  - subscribers: the audience engine (event reminders by interest + channel)
 *  - businessLeads: the vendor side (local businesses buying reach)
 */

export const SUBSCRIBER_INTERESTS = [
  "Families",
  "Food & Drink",
  "Home & Garden",
  "Nightlife",
  "Arts & Culture",
] as const;

export const BUSINESS_VERTICALS = [
  "Home Services",
  "Real Estate",
  "Restaurant/Food",
  "Health & Wellness",
  "Events/Venues",
  "Other",
] as const;

export const BUSINESS_INTERESTS = [
  "Featured listing",
  "Buy leads",
  "Sponsored event",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Event reminders signup: name + email and/or phone, interests, SMS opt-in. */
export const subscribe = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    interests: v.array(v.string()),
    smsOptIn: v.boolean(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (name.length === 0) throw new Error("Name is required.");
    const email = args.email?.trim() || undefined;
    const phone = args.phone?.trim() || undefined;
    if (!email && !phone)
      throw new Error("Please provide an email address or phone number.");
    if (email && !EMAIL_RE.test(email))
      throw new Error("Please enter a valid email address.");
    if (args.smsOptIn && !phone)
      throw new Error("A phone number is required for text reminders.");
    const interests = args.interests
      .map((s) => s.trim())
      .filter((s) =>
        (SUBSCRIBER_INTERESTS as readonly string[]).includes(s),
      )
      .slice(0, SUBSCRIBER_INTERESTS.length);
    return await ctx.db.insert("subscribers", {
      name: name.slice(0, 120),
      email,
      phone: phone?.slice(0, 40),
      interests,
      emailOptIn: !!email,
      smsOptIn: args.smsOptIn,
      createdAt: Date.now(),
    });
  },
});

/** "For local businesses" lead form. */
export const submitBusinessLead = mutation({
  args: {
    businessName: v.string(),
    contactName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    vertical: v.string(),
    interests: v.array(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const businessName = args.businessName.trim();
    const contactName = args.contactName.trim();
    if (businessName.length === 0)
      throw new Error("Business name is required.");
    if (contactName.length === 0) throw new Error("Contact name is required.");
    const email = args.email?.trim() || undefined;
    const phone = args.phone?.trim() || undefined;
    if (!email && !phone)
      throw new Error("Please provide an email address or phone number.");
    if (email && !EMAIL_RE.test(email))
      throw new Error("Please enter a valid email address.");
    if (
      !(BUSINESS_VERTICALS as readonly string[]).includes(args.vertical.trim())
    )
      throw new Error("Please choose a business vertical.");
    const interests = args.interests
      .map((s) => s.trim())
      .filter((s) => (BUSINESS_INTERESTS as readonly string[]).includes(s))
      .slice(0, BUSINESS_INTERESTS.length);
    if (interests.length === 0)
      throw new Error("Please choose at least one thing you're interested in.");
    const now = Date.now();
    return await ctx.db.insert("businessLeads", {
      businessName: businessName.slice(0, 160),
      contactName: contactName.slice(0, 120),
      email,
      phone: phone?.slice(0, 40),
      vertical: args.vertical.trim(),
      interests,
      source: args.source?.trim() || "form",
      status: "new",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Phone bot: persist an inbound call transcript. Called by the voice bridge
 * (see voice-bridge/) via POST /twilio/call-log with the shared secret.
 */
export const logCall = internalMutation({
  args: {
    callSid: v.string(),
    from: v.string(),
    to: v.optional(v.string()),
    transcript: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("callLogs")
      .withIndex("by_callSid", (q) => q.eq("callSid", args.callSid))
      .first();
    const transcript = args.transcript.slice(0, 20000);
    if (existing) {
      await ctx.db.patch(existing._id, { transcript });
      return existing._id;
    }
    return await ctx.db.insert("callLogs", {
      callSid: args.callSid,
      from: args.from.slice(0, 40),
      to: args.to?.slice(0, 40),
      transcript,
      createdAt: Date.now(),
    });
  },
});

/**
 * Phone bot: save a lead extracted from a call, linked to its call log.
 * The caller's phone comes from Twilio; vertical is mapped to the closest
 * known vertical (defaults to "Other").
 */
export const insertCallLead = internalMutation({
  args: {
    callSid: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    need: v.string(),
    vertical: v.string(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 120);
    if (!name) throw new Error("Lead name is required.");
    const vertical = (BUSINESS_VERTICALS as readonly string[]).includes(
      args.vertical.trim(),
    )
      ? args.vertical.trim()
      : "Other";
    const now = Date.now();
    const leadId = await ctx.db.insert("businessLeads", {
      businessName: name,
      contactName: name,
      phone: args.phone?.trim().slice(0, 40),
      vertical,
      interests: [`Phone inquiry: ${args.need.trim().slice(0, 120)}`],
      source: "phone",
      status: "new",
      createdAt: now,
      updatedAt: now,
    });
    const log = await ctx.db
      .query("callLogs")
      .withIndex("by_callSid", (q) => q.eq("callSid", args.callSid))
      .first();
    if (log) await ctx.db.patch(log._id, { leadId });
    return leadId;
  },
});
