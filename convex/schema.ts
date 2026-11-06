import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Leander Live runtime content store (added 2026-11-06).
// One document per content type holding the full normalized record set as a
// JSON string. The Dragon Automation pipeline replaces a type's document
// atomically on each publish, so readers never see a half-written set and a
// data publish never requires a site rebuild.
export default defineSchema({
  ll_datasets: defineTable({
    name: v.string(), // events | jobs | civic | news | businesses | source-status
    payload: v.string(), // JSON array of records, each with a stable `id`
    count: v.number(),
    contentHash: v.string(), // sha256 of payload
    updatedAt: v.number(), // epoch ms of the publish
    runId: v.string(),
  }).index("by_name", ["name"]),

  ll_ingest_runs: defineTable({
    runId: v.string(),
    dataset: v.string(),
    status: v.string(), // "ok" | "rejected"
    count: v.number(),
    contentHash: v.string(),
    startedAt: v.number(),
    finishedAt: v.number(),
    error: v.optional(v.string()),
  }).index("by_run", ["runId"]),

  // Businesses chat search (added 2026-11-06, CHR-2355). Abuse-control and
  // cache state for the public POST /business-chat endpoint — see
  // convex/businessChat.ts. Keys are opaque: `ip:<sha256>:<hourBucket>`,
  // `sess:<sessionId>:<hourBucket>`; cache keys hash the normalized question
  // + context + dataset content hash, so a data publish invalidates answers.
  ll_chat_rate: defineTable({
    key: v.string(),
    count: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  ll_chat_cache: defineTable({
    key: v.string(),
    response: v.string(), // full JSON response body for /business-chat
    createdAt: v.number(),
  }).index("by_key", ["key"]),

  ll_chat_daily: defineTable({
    day: v.string(), // America/Chicago calendar day, YYYY-MM-DD
    llmCalls: v.number(),
  }).index("by_day", ["day"]),
});
