/**
 * Static data layer for Leander Live (Vercel-only rebuild).
 *
 * All content is imported at build time from JSON files in this directory.
 * The JSON is produced by the scrapers in scripts/ (plus the hand-curated
 * anchor events), so there is no backend at runtime.
 */

export type EventCategory =
  | "Music"
  | "Food & Drink"
  | "Family"
  | "Outdoors"
  | "Learn"
  | "Community";

export interface LiveEvent {
  /** Stable string id (e.g. "anchor-artfest", "citycal-1234"). */
  id: string;
  title: string;
  description: string;
  /** Short hook line shown on cards / detail banner. */
  blurb?: string;
  /** Epoch ms. */
  startsAt: number;
  /** Epoch ms. Optional. */
  endsAt?: number;
  venue: string;
  address?: string;
  /** Official event page. */
  url?: string;
  category: EventCategory;
  /** Path under /public, e.g. "/images/real/artfest.jpg". */
  image?: string;
  /** Paid sponsored placement: epoch ms until it stays pinned. */
  featuredUntil?: number;
  /** Where the record came from: "anchor" | "city-calendar" | "chamber" | "lisd-district" | "lisd-campus". */
  source: string;
  sourceUrl?: string;
  /** LISD calendar only: true for all-day events. endsAt is then exclusive midnight. */
  allDay?: boolean;
  /** LISD calendar only: UID plus RECURRENCE-ID, the occurrence identity. */
  occurrenceKey?: string;
  /** LISD calendar only: cancelled occurrences are never published. */
  cancelled?: boolean;
}

export type JobType = "full-time" | "part-time" | "contract" | "temporary";

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: JobType;
  payRange?: string;
  description: string;
  /** Employer application URL. */
  applyUrl: string;
  /** Epoch ms when the posting was published, when the source reports it. */
  postedAt?: number;
  /** Epoch ms when the posting closes. Optional. */
  closesAt?: number;
  /**
   * Epoch ms when the Leander Live scraper first saw this posting. This is
   * the board's own first-seen date (backfilled with the first tracked run
   * for older postings), NOT the employer's original post date — postedAt
   * is that, when the source reports it.
   */
  firstSeenAt?: number;
  featured?: boolean;
  source: string;
  sourceUrl?: string;
}

export interface CivicMeeting {
  id: string;
  /** "City Council" | "Planning & Zoning Commission" | ... */
  body: string;
  title: string;
  /** Epoch ms. */
  startsAt: number;
  location?: string;
  /** Direct PDF link to the agenda packet. */
  agendaUrl?: string;
  minutesUrl?: string;
  sourceUrl?: string;
}

/**
 * A local business listing in the directory. Built by
 * scripts/scrape-businesses.mjs from the Texas sales-tax permit dataset
 * (data.texas.gov) — the same source the openings radar watches — gated to
 * storefront/service NAICS categories a resident would actually look up.
 */
export interface Business {
  /** Stable string id (e.g. "biz-32012345678-1"). */
  id: string;
  /** Display name (DBA name when the permit carries one). */
  name: string;
  /** Human category label derived from the NAICS code. */
  category: string;
  /** NAICS code from the permit record. */
  naics: string;
  /** Street address (no city/state — everything here is Leander, TX). */
  address: string;
  zip: string;
  /** Epoch ms when the sales-tax permit was issued. */
  permitIssuedAt?: number;
  /** Epoch ms of the outlet's first sales date, when reported. */
  firstSalesAt?: number;
  /** Paid featured placement (set by hand; default false). */
  featured: boolean;
  source: string;
  sourceUrl?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  /** Epoch ms. */
  publishedAt: number;
  summary?: string;
  url: string;
}
