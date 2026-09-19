import { defineSchema, defineTable } from "convex/server";
import { v, type Infer } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export const sourceValidator = v.union(
  v.literal("community"), // submitted via the web form
  v.literal("crawl"), // ingested by the Firecrawl scheduled action
  v.literal("email"), // submitted via the AgentMail inbox
);

export const statusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

/** Event categories shown as filter chips in the UI. */
export const categoryValidator = v.union(
  v.literal("Music"),
  v.literal("Food & Drink"),
  v.literal("Family"),
  v.literal("Outdoors"),
  v.literal("Learn"),
  v.literal("Community"),
);

export type Category = Infer<typeof categoryValidator>;

export default defineSchema({
  events: defineTable({
    title: v.string(),
    description: v.string(),
    // Optional AI-generated one-liner ("why go"), written by the OpenAI action.
    blurb: v.optional(v.string()),
    startsAt: v.number(), // unix ms
    venue: v.string(),
    category: v.optional(categoryValidator),
    // Optional photo path (e.g. "/images/event-music-park.jpg") shown on the event card.
    image: v.optional(v.string()),
    source: sourceValidator,
    url: v.optional(v.string()),
    status: statusValidator,
  })
    .index("by_status_startsAt", ["status", "startsAt"])
    .index("by_startsAt", ["startsAt"]),

  // Idempotency log for AgentMail (Svix) webhook deliveries.
  webhookEvents: defineTable({
    svixId: v.string(),
    eventType: v.string(),
    messageId: v.optional(v.string()),
    receivedAt: v.number(),
  }).index("by_svixId", ["svixId"]),

  // Lead capture: event-reminder subscribers (audience engine side).
  subscribers: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    interests: v.array(v.string()),
    emailOptIn: v.boolean(),
    smsOptIn: v.boolean(),
    createdAt: v.number(),
  }),

  // Lead pipeline: unified capture (form / chat / phone) with sales stages.
  // This is the hackathon slice of the bigger lead-marketplace vision.
  businessLeads: defineTable({
    businessName: v.string(),
    contactName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    vertical: v.string(), // auto-tagged from capture data
    interests: v.array(v.string()),
    source: v.string(), // "form" | "chat" | "phone" | "reminder"
    status: v.string(), // "new" | "contacted" | "qualified" | "sold" | "closed"
    assignedBusinessId: v.optional(v.id("businesses")),
    salePrice: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_vertical", ["vertical"]),

  // Businesses that can buy / receive leads, routed by vertical match.
  businesses: defineTable({
    name: v.string(),
    vertical: v.string(),
    contactName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    status: v.string(), // "prospect" | "active" | "paused"
    createdAt: v.number(),
  }).index("by_vertical", ["vertical"]),

  // Phone bot: inbound call transcripts + extracted leads.
  callLogs: defineTable({
    callSid: v.string(),
    from: v.string(),
    to: v.optional(v.string()),
    transcript: v.string(),
    leadId: v.optional(v.id("businessLeads")),
    createdAt: v.number(),
  }).index("by_callSid", ["callSid"]),

  // Chat bot: per-session rate limiting + token usage visibility.
  chatSessions: defineTable({
    sessionId: v.string(),
    requestCount: v.number(),
    windowStart: v.number(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    leadsCaptured: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_sessionId", ["sessionId"]),

  // Convex Auth tables (users, sessions, accounts, …).
  ...authTables,

  // Per-user profile: saved events sync across devices once signed in.
  // Guests keep using localStorage; on sign-in we merge guest saves here.
  profiles: defineTable({
    userId: v.id("users"),
    savedEventIds: v.array(v.id("events")),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
});
