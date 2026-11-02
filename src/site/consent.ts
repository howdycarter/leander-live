/**
 * Analytics consent for Leander Live (GDPR/CCPA basics).
 *
 * Posture: analytics storage starts DENIED. The inline script in
 * index.html sets Google Consent Mode defaults (analytics_storage and
 * all ad categories denied) before the GTM container loads, and applies
 * a stored "granted" choice on later visits. This module owns the
 * stored choice and every later change:
 *
 * - The choice lives in localStorage under STORAGE_KEY ("granted" |
 *   "denied"); no choice stored = the consent banner shows.
 * - Granting pushes a Consent Mode update (analytics_storage granted;
 *   ad categories stay denied — this site runs no ad tags) and lets
 *   PostHog initialize (analytics.ts listens for CONSENT_EVENT).
 * - Denying pushes analytics_storage denied; PostHog never initializes.
 * - Do Not Track is honored separately in posthog.ts and by the
 *   visitor's browser for GA4; a stored choice never overrides DNT
 *   inside the PostHog module.
 *
 * Essential storage (saved events, this consent choice) is not gated:
 * it never leaves the device and is disclosed in the Privacy Policy.
 */

export const CONSENT_STORAGE_KEY = "ll-analytics-consent";
export const CONSENT_EVENT = "ll:consent-changed";
export const OPEN_CONSENT_EVENT = "ll:open-consent";

export type AnalyticsConsent = "granted" | "denied";

/** The stored choice, or null when the visitor has not chosen yet. */
export function getAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return raw === "granted" || raw === "denied" ? raw : null;
  } catch {
    return null;
  }
}

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Push a Consent Mode update through gtag (defined inline in index.html). */
function pushConsentUpdate(choice: AnalyticsConsent): void {
  try {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: choice === "granted" ? "granted" : "denied",
      });
    } else {
      // Fallback: the raw command array is the same dataLayer contract.
      window.dataLayer.push([
        "consent",
        "update",
        { analytics_storage: choice === "granted" ? "granted" : "denied" },
      ] as unknown as Record<string, unknown>);
    }
  } catch {
    /* consent plumbing must never break the site */
  }
}

/** Store the visitor's choice, apply it, and notify analytics.ts. */
export function setAnalyticsConsent(choice: AnalyticsConsent): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    /* private mode etc. — the in-page state still applies this visit */
  }
  pushConsentUpdate(choice);
  try {
    window.dispatchEvent(
      new CustomEvent<AnalyticsConsent>(CONSENT_EVENT, { detail: choice }),
    );
  } catch {
    /* never break the site */
  }
}

/** Ask the banner (mounted in SiteLayout) to re-open, e.g. from the footer. */
export function openConsentBanner(): void {
  try {
    window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
  } catch {
    /* never break the site */
  }
}
