/**
 * PostHog analytics for Leander Live — DRAFT wiring (not yet approved to ship).
 *
 * Org: "Newton & Carter" · Project: 700301.
 *
 * Privacy posture (deliberately restrictive — see
 * docs/POSTHOG-PRIVACY-NOTE-DRAFT.md):
 * - No key, no tracking: if VITE_POSTHOG_KEY is unset/blank at build time
 *   this module is a complete no-op. The key is a public project key that
 *   ships in the client bundle (same class as the GA4/GTM IDs), but it is
 *   NOT committed to this repo — Chris supplies it via the environment
 *   (Vercel project env / .env.local). Never invent or hard-code a key.
 * - Anonymous only: `person_profiles: "never"` — no identified profiles,
 *   no identify() calls anywhere in the app.
 * - No autocapture: clicks/inputs are NOT auto-collected. Only the events
 *   the app explicitly sends through analytics.ts are captured.
 * - No session recording, no heatmaps, no feature-flag bootstrapping.
 * - No PII in properties: event properties are sanitized before capture —
 *   keys that look like email/name/phone/address are dropped, string
 *   values that look like email addresses are dropped, and URLs are
 *   reduced to their pathname (query strings — e.g. ?q= search terms —
 *   are never sent).
 * - Respects Do Not Track: when the browser sends DNT, PostHog is not
 *   initialized at all.
 *
 * Host: defaults to PostHog US Cloud ingestion (https://us.i.posthog.com);
 * override with VITE_POSTHOG_HOST if the project lives elsewhere.
 */

import type { PostHog } from "posthog-js";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

/** Project key for this build, or "" when PostHog is not configured. */
export function getPostHogKey(): string {
  const raw = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Ingestion host for this build (env override, else US Cloud). */
export function getPostHogHost(): string {
  const raw = import.meta.env.VITE_POSTHOG_HOST as string | undefined;
  const host = typeof raw === "string" ? raw.trim() : "";
  return host.startsWith("https://") ? host : DEFAULT_POSTHOG_HOST;
}

/** True when a key is configured AND the browser has not sent DNT. */
export function isPostHogEnabled(): boolean {
  if (!getPostHogKey()) return false;
  try {
    const dnt =
      typeof navigator !== "undefined"
        ? (navigator as Navigator & { doNotTrack?: string }).doNotTrack
        : undefined;
    if (dnt === "1" || dnt === "yes") return false;
  } catch {
    /* if DNT cannot be read, fall through and allow */
  }
  return true;
}

const BLOCKED_KEY_PATTERN =
  /email|e-mail|name|phone|address|password|token|secret|ssn|user.?id/i;
const EMAIL_VALUE_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** Reduce a URL or path to its pathname only — query/hash are never sent. */
export function toPathOnly(value: string): string {
  try {
    return new URL(value, "https://leanderlive.com").pathname;
  } catch {
    return value.split(/[?#]/)[0] || "/";
  }
}

/**
 * Sanitize event properties before capture. Only string/number/boolean
 * values survive; blocked keys and email-looking values are dropped;
 * URL-looking values are reduced to pathnames.
 */
export function sanitizeProps(
  params?: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!params) return out;
  for (const [key, value] of Object.entries(params)) {
    if (BLOCKED_KEY_PATTERN.test(key)) continue;
    if (typeof value === "string") {
      if (EMAIL_VALUE_PATTERN.test(value)) continue;
      out[key] =
        key.includes("url") || key.includes("location") || key === "page_path"
          ? toPathOnly(value)
          : value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

let client: PostHog | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Lazily load posthog-js and initialize it — only when enabled, so sites
 * built without a key ship zero PostHog code to visitors. Safe to call
 * repeatedly; initialization happens at most once.
 */
export function initPostHog(): void {
  if (client || initPromise || !isPostHogEnabled()) return;
  initPromise = import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(getPostHogKey(), {
        api_host: getPostHogHost(),
        // SPA pageviews are sent manually from analytics.ts on route change.
        capture_pageview: false,
        capture_pageleave: false,
        // Privacy posture: nothing automatic, nobody identified.
        autocapture: false,
        disable_session_recording: true,
        person_profiles: "never",
        // Do not persist anything identifying across visits beyond the
        // anonymous distinct id PostHog itself manages in localStorage;
        // no cross-subdomain or cross-domain linking.
        cross_subdomain_cookie: false,
        persistence: "localStorage",
        // Never let PostHog decide to record or snapshot the DOM.
        disable_surveys: true,
      });
      client = posthog;
    })
    .catch(() => {
      /* analytics must never break the site */
    });
}

/** Capture an explicit event (sanitized). No-op until/unless initialized. */
export function capturePostHogEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  try {
    client?.capture(name, sanitizeProps(params));
  } catch {
    /* never break the site */
  }
}

/** Capture an SPA pageview: pathname only — no query string, no title PII. */
export function capturePostHogPageView(path: string): void {
  capturePostHogEvent("$pageview", {
    $current_url: toPathOnly(path),
    page_path: toPathOnly(path),
  });
}
