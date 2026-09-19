import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * OpenAI generates a one-line "why go" blurb per event.
 * Set the key with:  npx convex env set OPENAI_API_KEY <key>
 *
 * Note: Convex AI Gateway is the keyless alternative (managed model access
 * from actions, no keys to rotate), but it requires a paid Convex team, so
 * this scaffold uses a plain OpenAI key instead.
 */
export const summarizeEvent = internalAction({
  args: { eventId: v.id("events") },
  handler: async (ctx, args): Promise<{ ok: boolean; reason?: string }> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log("OPENAI_API_KEY not set — skipping summarization.");
      return { ok: false, reason: "missing OPENAI_API_KEY" };
    }
    const event = await ctx.runQuery(internal.events.getById, { id: args.eventId });
    if (!event) return { ok: false, reason: "event not found" };

    // TODO: POST https://api.openai.com/v1/chat/completions with a prompt like:
    //   "In one sentence (<140 chars), tell a Leander local why they should go: {title} — {description} at {venue}."
    // then:
    //   await ctx.runMutation(internal.events.setBlurb, { id: args.eventId, blurb });

    return { ok: true, reason: "stub — wire OpenAI chat completion" };
  },
});
