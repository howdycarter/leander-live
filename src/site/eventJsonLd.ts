import type { LiveEvent } from "../data/types";

/**
 * schema.org Event structured data for event detail pages.
 *
 * The detail pages are client-rendered (SPA), so there is no static HTML
 * to embed this in — EventDetailPage injects the JSON-LD into
 * document.head via useEffect, the same head-management pattern as
 * Canonical/RouteMeta in chrome.tsx, and removes it on unmount.
 *
 * Fields come only from the event record itself. The data carries no
 * price and no organizer field, so `offers` and `organizer` are omitted
 * rather than inferred — never fabricate structured data.
 */

const SITE_ORIGIN = "https://leanderlive.com";

const chicagoFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** ISO 8601 with the America/Chicago UTC offset in effect at that instant
 *  (events are stored as epoch ms of Chicago wall-clock times). */
export function isoChicago(ms: number): string {
  try {
    const parts = Object.fromEntries(
      chicagoFmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
    );
    const hour = (+parts.hour) % 24; // ICU can emit "24" at midnight
    const wallAsUtc = Date.UTC(
      +parts.year, +parts.month - 1, +parts.day, hour, +parts.minute, +parts.second,
    );
    const offsetMs = wallAsUtc - Math.floor(ms / 1000) * 1000;
    const sign = offsetMs < 0 ? "-" : "+";
    const abs = Math.abs(offsetMs);
    const oh = String(Math.floor(abs / 3600000)).padStart(2, "0");
    const om = String(Math.floor((abs % 3600000) / 60000)).padStart(2, "0");
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${parts.year}-${parts.month}-${parts.day}` +
      `T${pad(hour)}:${parts.minute}:${parts.second}${sign}${oh}:${om}`
    );
  } catch {
    return new Date(ms).toISOString();
  }
}

/**
 * Best-effort PostalAddress from the free-form address string the sources
 * publish ("1011 S. Bagdad Rd., Leander TX, 78641"). Chamber strings bake
 * the venue name in as a prefix — strip it when it matches. Anything that
 * doesn't fit the "street, City ST ZIP" shape is passed through verbatim
 * (schema.org also accepts a plain-text address) rather than guessed at.
 */
function postalAddress(event: LiveEvent): Record<string, string> | string | undefined {
  const raw = event.address?.trim();
  if (!raw) return undefined;
  let s = raw;
  const venue = event.venue?.trim();
  if (venue) {
    // Strip the venue prefix, tolerating a corporate suffix the source
    // includes in the address but not the venue ("Facilities Resource"
    // vs "Facilities Resource, Inc. 1641 Scottsdale Dr.").
    const esc = venue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefix = new RegExp(
      `^${esc}(?:,?\\s+(?:inc|llc|ltd|corp|co|company)\\.?)?[\\s,]+`,
      "i",
    );
    if (prefix.test(s)) s = s.replace(prefix, "");
    else if (s.toLowerCase().startsWith(venue.toLowerCase())) {
      s = s.slice(venue.length).replace(/^[\s,]+/, "");
    }
  }
  const m = s.match(/^(.+?),\s*(.+?)\s+([A-Za-z]{2}),?\s+(\d{5})(?:-\d{4})?$/);
  // A "street" that doesn't start with a house number means the split
  // landed wrong (e.g. the street was part of the venue string and only
  // a suite remained) — pass the raw text through instead of asserting
  // a wrong street address.
  if (!m || !/^\d/.test(m[1])) return raw;
  return {
    "@type": "PostalAddress",
    streetAddress: m[1],
    addressLocality: m[2],
    addressRegion: m[3].toUpperCase(),
    postalCode: m[4],
    addressCountry: "US",
  };
}

export function buildEventJsonLd(event: LiveEvent): Record<string, unknown> {
  const address = postalAddress(event);
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: isoChicago(event.startsAt),
    ...(event.endsAt ? { endDate: isoChicago(event.endsAt) } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue,
      ...(address ? { address } : {}),
    },
    ...(event.image
      ? {
          image: [
            event.image.startsWith("http")
              ? event.image
              : `${SITE_ORIGIN}${event.image}`,
          ],
        }
      : {}),
    description: event.description,
    url: `${SITE_ORIGIN}/events/${event.id}`,
  };
}
