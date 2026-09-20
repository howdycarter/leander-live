/**
 * Google Analytics 4 wiring for Leander Live.
 *
 * Setup (Chris): create a GA4 property at analytics.google.com, copy the
 * Measurement ID (G-XXXXXXXXXX), then:
 *   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX npx vite build && npm run deploy
 * or set it as a Convex frontend env var before building.
 *
 * Everything is no-op until the ID is present — the site works fine without it.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function getMeasurementId(): string | null {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
  return id && id.startsWith("G-") ? id : null;
}

/** Inject gtag.js once. Safe to call repeatedly. */
export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;
  const id = getMeasurementId();
  if (!id) return;
  try {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
    window.gtag("js", new Date());
    window.gtag("config", id, { send_page_view: false });
  } catch {
    /* analytics must never break the site */
  }
}

/** Fire a GA4 event. No-op when analytics isn't configured. */
export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  try {
    if (!initialized || !getMeasurementId() || typeof window.gtag !== "function") return;
    window.gtag("event", name, params ?? {});
  } catch {
    /* never break the site */
  }
}

/** Manual page_view for SPA route changes. */
export function trackPageView(path: string): void {
  trackEvent("page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}
