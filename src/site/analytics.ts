/**
 * Analytics for Leander Live — Google Tag Manager owns all tags (GA4 incl.).
 *
 * The app never loads gtag.js directly. Code reports behavior by pushing
 * events onto window.dataLayer; the GTM container (GTM-T5HS9CSJ, account
 * Newton & Carter) decides which tags fire. The GA4 configuration tag and
 * event tags live in the GTM workspace — add new vendor tags there, not here.
 *
 * The container snippet is in index.html (head script + noscript iframe).
 * This module only guarantees the dataLayer exists and provides typed
 * push helpers.
 *
 * Container ID resolution — ONE rule, applied in both places:
 * vite.config.ts resolves the ID into index.html and this module reads
 * import.meta.env.VITE_GTM_ID, both with the identical rule, so the HTML
 * loader and the TS helper can never disagree: trim the configured value;
 * a value that is absent, empty, whitespace-only, or not a GTM- container
 * id counts as UNSET and falls back to the production container. In
 * particular an explicitly empty VITE_GTM_ID (build env or an overriding
 * env file) must never emit a broken `gtm.js?id=` loader (Codex P2, PR #7).
 *   VITE_GTM_ID=GTM-XXXXXXX npm run build
 *
 * PostHog (project 700301, org "Newton & Carter"; privacy text approved
 * by Chris Carter Nov 2, 2026 and live in the Privacy Policy) is wired
 * alongside GTM, not through it: initAnalytics() also initializes
 * PostHog (src/site/posthog.ts) and every trackEvent/trackPageView call
 * is mirrored there. PostHog is a complete no-op unless VITE_POSTHOG_KEY
 * is set at build time AND the visitor has granted analytics consent
 * (src/site/consent.ts), sends anonymous events only (no autocapture,
 * no session recording, no identified profiles), and sanitizes
 * properties before capture. See docs/POSTHOG-PRIVACY-NOTE-DRAFT.md.
 */

import {
  capturePostHogEvent,
  capturePostHogPageView,
  initPostHog,
  toPathOnly,
} from "./posthog";
import { CONSENT_EVENT, getAnalyticsConsent } from "./consent";

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

const FALLBACK_GTM_ID = "GTM-T5HS9CSJ";

/** Container ID for this build (env override, else the production container). */
export function getGtmId(): string {
  const raw = import.meta.env.VITE_GTM_ID as string | undefined;
  const id = typeof raw === "string" ? raw.trim() : "";
  return id.startsWith("GTM-") ? id : FALLBACK_GTM_ID;
}

function ensureDataLayer(): void {
  window.dataLayer = window.dataLayer || [];
}

let initialized = false;

/**
 * Prepare analytics. The GTM snippet in index.html loads the container;
 * this is a safety net (e.g. alternate HTML shells) that injects gtm.js
 * only when the snippet is absent. Safe to call repeatedly.
 */
/** PostHog starts only with a configured key AND granted consent. */
function maybeInitPostHog(): void {
  try {
    if (getAnalyticsConsent() === "granted") initPostHog();
  } catch {
    /* analytics must never break the site */
  }
}

export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;
  // PostHog initializes independently of GTM; consent-gated (consent.ts).
  // If the visitor accepts after page load, the consent event starts it.
  maybeInitPostHog();
  try {
    window.addEventListener(CONSENT_EVENT, maybeInitPostHog);
  } catch {
    /* never break the site */
  }
  try {
    ensureDataLayer();
    if (!document.querySelector('script[src*="googletagmanager.com/gtm.js"]')) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(getGtmId())}`;
      document.head.appendChild(script);
      window.dataLayer.push({
        "gtm.start": new Date().getTime(),
        event: "gtm.js",
      });
    }
  } catch {
    /* analytics must never break the site */
  }
}

/**
 * Report an event to GTM via the dataLayer. Tags in the GTM workspace
 * (GA4 events etc.) subscribe with Custom Event triggers on `name`.
 * Fire-and-forget: pushes are queued even before the container loads.
 */
function pushToDataLayer(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  try {
    ensureDataLayer();
    window.dataLayer.push({ event: name, ...(params ?? {}) });
  } catch {
    /* never break the site */
  }
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  pushToDataLayer(name, params);
  // Mirror explicit events to PostHog (sanitized there; no-op w/o a key).
  capturePostHogEvent(name, params);
}

/**
 * Manual page_view for SPA route changes (GTM forwards it to GA4).
 * Both vendors receive the pathname ONLY: the raw path arrives as
 * pathname + search from App.tsx, and query strings can carry visitor
 * input (e.g. the Events search ?q=), which must never leave the
 * browser as analytics data. page_location is rebuilt as
 * origin + pathname so GA4 gets a valid URL without the query.
 */
export function trackPageView(path: string): void {
  const cleanPath = toPathOnly(path);
  pushToDataLayer("page_view", {
    page_path: cleanPath,
    page_location: `${window.location.origin}${cleanPath}`,
    page_title: document.title,
  });
  // PostHog gets a single $pageview with the pathname only.
  capturePostHogPageView(cleanPath);
}
