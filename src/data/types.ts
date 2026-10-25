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
  /** Where the record came from: "anchor" | "city-calendar" | "chamber" ... */
  source: string;
  sourceUrl?: string;
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

export interface NewsItem {
  id: string;
  title: string;
  /** Epoch ms. */
  publishedAt: number;
  summary?: string;
  url: string;
}
