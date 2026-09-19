import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components, internal } from "./_generated/api";

const http = httpRouter();

/**
 * AgentMail inbound webhook: organizers email event submissions to the
 * AgentMail inbox, and they land in `events` with source "email",
 * status "pending" for review.
 *
 * In the AgentMail dashboard, point the inbox webhook at:
 *   https://<your-deployment>.convex.site/agentmail/inbound
 * and set the shared secret with:
 *   npx convex env set AGENTMAIL_WEBHOOK_SECRET <secret>
 */
http.route({
  path: "/agentmail/inbound",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
    if (!secret) {
      return new Response(JSON.stringify({ ok: false, reason: "webhook not configured" }), {
        status: 503,
      });
    }
    // TODO: verify the request signature against AGENTMAIL_WEBHOOK_SECRET.
    const body = (await req.json()) as { from?: string; subject?: string; text?: string };
    await ctx.runMutation(internal.events.insertFromEmail, {
      from: body.from ?? "unknown",
      subject: body.subject ?? "(no subject)",
      body: body.text ?? "",
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }),
});

// Serve the Vite SPA from Convex static hosting (root, SPA fallback).
registerStaticRoutes(http, components.staticHosting, {
  pathPrefix: "/",
  spaFallback: true,
});

export default http;
