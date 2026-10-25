/**
 * Monetization config for Leander Live.
 *
 * PRICES ARE DRAFT SUGGESTIONS FROM MUSE (not Chris, not approved):
 * Chris must confirm or change every number before any Stripe product
 * is created or any price is shown as final — the page reads these
 * values, so updating here updates the whole site.
 *
 * STRIPE STATUS (2026-10-24): no payment links exist yet. The Stripe MCP
 * connector is not connected, so no products/links could be created —
 * Chris connects it (OAuth) and the links get created + pasted below.
 * Billing model per package:
 *   featured-listing  $49/mo  — subscription Payment Link -> stripeUrl
 *   sponsored-event   $29     — one-time Payment Link -> stripeUrl
 *   featured-job      $99     — one-time Payment Link (30 days) -> stripeUrl
 *   service-leads     $35/lead — NO payment link by design: leads are
 *                     invoiced manually after delivery (a business can't
 *                     pre-buy an unknown number of leads through a static
 *                     link, and "no lead, no charge" requires billing
 *                     after the fact). stripeUrl stays "" so the CTA
 *                     keeps falling back to the interest form.
 *   service-leads exclusivity $299/mo — subscription Payment Link ->
 *                     exclusivity.stripeUrl
 * Until a link is set, that package's button falls back to the
 * advertiser-interest form so no visitor ever hits a dead checkout.
 */

export interface AdPackage {
  id: string;
  name: string;
  price: number;
  cadence: string;
  tagline: string;
  features: string[];
  /** Stripe Payment Link URL. Empty = fall back to interest form. */
  stripeUrl: string;
  cta: string;
  /** Optional category-exclusivity subscription (service-leads only). */
  exclusivity?: {
    price: number;
    cadence: string;
    /** Stripe Payment Link URL. Empty = option shown as a feature only. */
    stripeUrl: string;
  };
}

export const AD_PACKAGES: AdPackage[] = [
  {
    id: "featured-listing",
    name: "Featured Listing",
    price: 49,
    cadence: "/month",
    tagline: "Your business, pinned where Leander looks first.",
    features: [
      "Pinned placement on the business directory",
      "Featured badge on your listing",
      "Photo, hours, and direct contact links",
      "Monthly performance snapshot",
    ],
    stripeUrl: "",
    cta: "Feature my business",
  },
  {
    id: "sponsored-event",
    name: "Sponsored Event",
    price: 29,
    cadence: "/event",
    tagline: "Put your event at the top of the town board.",
    features: [
      "Pinned to the top of Events + homepage",
      "Sponsored badge and priority placement",
      "Runs until your event date",
      "Included in the weekly reminders email",
    ],
    stripeUrl: "",
    cta: "Sponsor my event",
  },
  {
    id: "featured-job",
    name: "Featured Job",
    price: 99,
    cadence: "/30 days",
    tagline: "Hire Leander, first. Your opening, impossible to miss.",
    features: [
      "Pinned to the top of the Jobs board",
      "Featured badge for 30 days",
      "Highlighted in job-seeker reminders",
      "Repost discount while you're hiring",
    ],
    stripeUrl: "",
    cta: "Feature my job",
  },
  {
    id: "service-leads",
    name: "Service Leads",
    price: 35,
    cadence: "/qualified lead",
    tagline: "Pay only when a real neighbor needs your trade.",
    features: [
      "We qualify every request for you",
      "Name, number, and job details delivered",
      "Exclusive category option: $299/mo",
      "No lead, no charge — ever",
    ],
    stripeUrl: "",
    cta: "Start getting leads",
    exclusivity: {
      price: 299,
      cadence: "/month",
      stripeUrl: "",
    },
  },
];

/** How the service-leads product works (3 steps on the Advertise page). */
export const SERVICE_LEAD_STEPS = [
  {
    title: "A neighbor needs help",
    body: "Someone in Leander needs a plumber, an HVAC tech, or a lawn crew — and asks the town board.",
  },
  {
    title: "We qualify it",
    body: "We capture the trade, the job details, and their name and number. No tire-kickers, no spam.",
  },
  {
    title: "You get the lead",
    body: "The qualified request lands with you directly. You pay per lead, or own the whole category.",
  },
] as const;

export function formatPrice(pkg: AdPackage): string {
  return `$${pkg.price}${pkg.cadence}`;
}
