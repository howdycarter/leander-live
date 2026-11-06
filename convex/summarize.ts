import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requestBlurb } from "./summarizeParse";

/**
 * OpenAI generates a one-line "why go" blurb per event, shown in the feed
 * as the "why go" line under the event title.
 *
 * Prompt construction and completion parsing live in summarizeParse.ts so
 * they can be tested with a mock fetch. This action still no-ops when
 * OPENAI_API_KEY is unset; this PR never calls OpenAI.
 *
 *   npx convex env set OPENAI_API_KEY <key>
 */
export const summarizeEvent = internalAction({
  args: { eventId: v.id("events") },
  handler: async (ctx, args): Promise<{ ok: boolean; reason?: string }> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log("OPENAI_API_KEY not set — skipping summarization.");
      return { ok: false, reason: "missing OPENAI_API_KEY" };
    }
    const event = await ctx.runQuery(internal.events.getById, {
      id: args.eventId,
    });
    if (!event) return { ok: false, reason: "event not found" };
    if (event.blurb) return { ok: true, reason: "already has blurb" };

    const result = await requestBlurb(
      apiKey,
      {
        title: event.title,
        description: event.description,
        venue: event.venue,
      },
      (input, init) => fetch(input, init),
    );
    if (!result.ok) {
      if (result.reason.startsWith("openai ")) {
        console.error(`OpenAI failed (${result.reason})`);
      }
      return { ok: false, reason: result.reason };
    }

    await ctx.runMutation(internal.events.setBlurb, {
      id: args.eventId,
      blurb: result.blurb,
    });
    return { ok: true };
  },
});
