import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * On-site chat bot (public action).
 *
 * Converses with visitors, figures out intent (event reminders vs. business
 * services vs. resident needing a local pro), and captures leads
 * conversationally into the `subscribers` / `businessLeads` /
 * `serviceRequests` tables. The model emits a hidden <!--LEAD {...}--> block
 * when it has a complete lead; the action parses it, writes it via the
 * validated lead mutations, and strips the block before replying.
 *
 * Budget posture (Chris approved, $200 OpenAI budget):
 * - Cheap chat model only (CHAT_MODEL env, default gpt-4o-mini). Never
 *   full-size or reasoning models on this path.
 * - Tight system prompt + max_tokens cap on every call.
 * - Per-session rate limiting (see checkChatSession below).
 * - Approximate token usage logged per session for visibility.
 *
 * Needs: npx convex env set OPENAI_API_KEY <key>
 * Without a key it returns a graceful fallback pointing at the forms.
 */

const CHAT_MODEL = process.env.CHAT_MODEL ?? "gpt-4o-mini";
const MAX_TOKENS = 300;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const FALLBACK_REPLY =
  "Our chat assistant is taking a quick break — but you can still get event reminders or list your business using the forms below. We'd love to have you!";

const RATE_LIMIT_REPLY =
  "I'm getting a lot of love right now! Give me a few minutes and try again — or use the reminder and business forms below and we'll take it from there.";

const SYSTEM_PROMPT = `You are the friendly chat assistant for Leander Live, a community events board for Leander, Texas (warm, small-town, helpful — think neighbor, not salesperson).

GOALS
1. Help visitors find events and answer questions about Leander happenings.
2. Determine intent: (a) someone who wants EVENT REMINDERS, (b) a LOCAL BUSINESS interested in services, or (c) a RESIDENT WHO NEEDS A LOCAL PRO (plumber, HVAC, electrician, roofer, lawn care, cleaning, handyman…).
3. Capture the lead conversationally — never interrogate; one question at a time, natural flow.

FOR EVENT REMINDERS capture: name; email and/or phone (at least one); interests from: Families, Food & Drink, Home & Garden, Nightlife, Arts & Culture. If they give a phone number for TEXT reminders, you MUST get explicit agreement first with words close to: "Just to confirm — is it OK if we text you event reminders at this number? Message and data rates may apply, and you can reply STOP to opt out." Only treat smsOptIn as true if they clearly agree.

FOR BUSINESSES capture: business name; contact name; email and/or phone; vertical from: Home Services, Real Estate, Restaurant/Food, Health & Wellness, Events/Venues, Other; what they want from: Featured listing, Buy leads, Sponsored event.

FOR SERVICE REQUESTS (resident needs a pro) capture: service category from: Plumbing, HVAC, Electrical, Roofing, Lawn & Yard, Cleaning, Pest Control, Handyman, Other; what's going on (one short description in their words); their name; phone and/or email (at least one — phone preferred so the pro can reach them fast). Flow: acknowledge the problem warmly, ask what's going on, then ask for name + best number to reach them. Promise we'll connect them with a trusted local pro. Do NOT promise a specific business name or arrival time.

RULES
- Keep replies short (1-3 sentences). Ask one thing at a time.
- Never invent events — only mention events from the UPCOMING EVENTS list below. If unsure, say so.
- When you have a COMPLETE lead (all required fields for that type), end your reply with a hidden block on its own line:
  <!--LEAD {"type":"subscriber","name":"...","email":"...","phone":"...","interests":[...],"smsOptIn":true/false} -->
  or
  <!--LEAD {"type":"business","businessName":"...","contactName":"...","email":"...","phone":"...","vertical":"...","interests":[...]} -->
  or
  <!--LEAD {"type":"service","service":"Plumbing","description":"...","name":"...","phone":"...","email":"..."} -->
  Omit optional fields you don't have (don't send empty strings). interests arrays may be empty.
- Do NOT emit the LEAD block until every required field is captured. Required: subscriber → name + (email or phone); business → businessName + contactName + (email or phone) + vertical; service → service + name + (phone or email).
- After a lead is captured, thank them warmly and stop asking for details.

UPCOMING EVENTS (approved, soonest first):
`;

interface LeadBlock {
  type: "subscriber" | "business" | "service";
  name?: string;
  email?: string;
  phone?: string;
  interests?: string[];
  smsOptIn?: boolean;
  businessName?: string;
  contactName?: string;
  vertical?: string;
  service?: string;
  description?: string;
}

function extractLeadBlock(reply: string): { clean: string; lead: LeadBlock | null } {
  const match = reply.match(/<!--LEAD\s+(\{.*?\})\s*-->/s);
  if (!match) return { clean: reply.trim(), lead: null };
  let lead: LeadBlock | null = null;
  try {
    const parsed = JSON.parse(match[1]) as LeadBlock;
    if (parsed.type === "subscriber" || parsed.type === "business" || parsed.type === "service") {
      lead = parsed;
    }
  } catch {
    lead = null;
  }
  return { clean: reply.replace(match[0], "").trim(), lead };
}

export const chatReply = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      }),
    ),
    sessionId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ reply: string; leadSaved?: boolean; unavailable?: boolean }> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { reply: FALLBACK_REPLY, unavailable: true };
    }

    // Per-session rate limit (abuse + cost guardrail).
    const allowed = await ctx.runMutation(internal.chat.checkChatSession, {
      sessionId: args.sessionId.slice(0, 64),
    });
    if (!allowed) {
      return { reply: RATE_LIMIT_REPLY };
    }

    const history = args.messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content.slice(0, 2000),
    }));

    // Ground the bot in real upcoming events.
    let eventContext = "(none scheduled right now)";
    try {
      const upcoming = await ctx.runQuery(api.events.listUpcoming, { limit: 8 });
      if (upcoming.length > 0) {
        eventContext = upcoming
          .map(
            (e) =>
              `- ${e.title} (${new Date(e.startsAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}) at ${e.venue}${e.category ? ` [${e.category}]` : ""}`,
          )
          .join("\n");
      }
    } catch {
      // non-fatal: chat works without event context
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT + eventContext },
          ...history,
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
      }),
    });
    if (!res.ok) {
      console.error(`chat OpenAI failed (${res.status})`);
      return { reply: FALLBACK_REPLY, unavailable: true };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? FALLBACK_REPLY;
    const { clean, lead } = extractLeadBlock(raw);

    // Log approximate token usage for this session (chars/4 estimate).
    const promptChars =
      SYSTEM_PROMPT.length +
      eventContext.length +
      history.reduce((n, m) => n + m.content.length, 0);
    await ctx.runMutation(internal.chat.logChatUsage, {
      sessionId: args.sessionId.slice(0, 64),
      promptTokens: Math.ceil(promptChars / 4),
      completionTokens: Math.ceil(raw.length / 4),
    });

    let leadSaved = false;
    if (lead) {
      try {
        if (lead.type === "subscriber") {
          await ctx.runMutation(api.leads.subscribe, {
            name: lead.name ?? "",
            email: lead.email,
            phone: lead.phone,
            interests: lead.interests ?? [],
            smsOptIn: lead.smsOptIn ?? false,
          });
        } else if (lead.type === "service") {
          await ctx.runMutation(api.serviceRequests.submit, {
            service: lead.service ?? "Other",
            description: lead.description,
            name: lead.name ?? "",
            email: lead.email,
            phone: lead.phone,
            source: "chat",
          });
        } else {
          await ctx.runMutation(api.leads.submitBusinessLead, {
            businessName: lead.businessName ?? "",
            contactName: lead.contactName ?? "",
            email: lead.email,
            phone: lead.phone,
            vertical: lead.vertical ?? "Other",
            interests: lead.interests ?? [],
            source: "chat",
          });
        }
        leadSaved = true;
        await ctx.runMutation(internal.chat.logChatUsage, {
          sessionId: args.sessionId.slice(0, 64),
          promptTokens: 0,
          completionTokens: 0,
          leadSaved: true,
        });
      } catch (err) {
        // Validation failed (e.g. model hallucinated a bad email) — keep
        // chatting; don't surface internals to the visitor.
        console.error("chat lead save failed:", err);
      }
    }

    return { reply: clean || FALLBACK_REPLY, leadSaved };
  },
});

/**
 * Rate-limit gate: max RATE_LIMIT_MAX_REQUESTS chat calls per
 * RATE_LIMIT_WINDOW_MS per session id. Returns true when allowed.
 */
export const checkChatSession = internalMutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("chatSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (!existing) {
      await ctx.db.insert("chatSessions", {
        sessionId: args.sessionId,
        requestCount: 1,
        windowStart: now,
        promptTokens: 0,
        completionTokens: 0,
        leadsCaptured: 0,
        createdAt: now,
        updatedAt: now,
      });
      return true;
    }
    const windowExpired = now - existing.windowStart > RATE_LIMIT_WINDOW_MS;
    const requestCount = windowExpired ? 1 : existing.requestCount + 1;
    if (!windowExpired && existing.requestCount >= RATE_LIMIT_MAX_REQUESTS) {
      return false;
    }
    await ctx.db.patch(existing._id, {
      requestCount,
      windowStart: windowExpired ? now : existing.windowStart,
      updatedAt: now,
    });
    return true;
  },
});

/** Log approximate token usage (and captured leads) per chat session. */
export const logChatUsage = internalMutation({
  args: {
    sessionId: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    leadSaved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chatSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (!existing) return;
    await ctx.db.patch(existing._id, {
      promptTokens: existing.promptTokens + args.promptTokens,
      completionTokens: existing.completionTokens + args.completionTokens,
      leadsCaptured: existing.leadsCaptured + (args.leadSaved ? 1 : 0),
      updatedAt: Date.now(),
    });
  },
});
