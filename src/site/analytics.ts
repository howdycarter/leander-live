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
 */

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
export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;
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
export function trackEvent(
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

/** Manual page_view for SPA route changes (GTM forwards it to GA4). */
export function trackPageView(path: string): void {
  trackEvent("page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}
