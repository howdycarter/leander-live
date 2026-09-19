import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * OpenAI generates a one-line "why go" blurb per event, shown in the feed
 * as the "why go" line under the event title.
 *
 * Get a key at https://platform.openai.com, then:
 *   npx convex env set OPENAI_API_KEY <key>
 *
 * Note: Convex AI Gateway is the keyless alternative (managed model access
 * from actions, no keys to rotate), but it requires a paid Convex team, so
 * this uses a plain OpenAI key instead.
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

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You write one-sentence event blurbs for a local events board. Under 140 characters, warm and specific to a Leander, Texas local. No hashtags, no emojis.",
          },
          {
            role: "user",
            content: `In one sentence, tell a local why they should go: "${event.title}" — ${event.description} at ${event.venue}.`,
          },
        ],
        max_tokens: 80,
        temperature: 0.7,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`OpenAI failed (${res.status}): ${text}`);
      return { ok: false, reason: `openai ${res.status}` };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const blurb = data.choices?.[0]?.message?.content?.trim();
    if (!blurb) return { ok: false, reason: "empty completion" };

    await ctx.runMutation(internal.events.setBlurb, {
      id: args.eventId,
      blurb,
    });
    return { ok: true };
  },
});
