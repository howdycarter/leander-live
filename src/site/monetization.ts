/**
 * Advertising options at the charter rates approved by Chris Carter on
 * 2026-10-31 (Featured Listing $29/mo, Sponsored Event $19, Featured Job $59).
 * No payment links or lead-delivery service are active yet: Stripe is not
 * connected. Keep payment URLs empty until Stripe is connected and the
 * links are created and verified.
 */
export interface AdPackage {
  id: string;
  name: string;
  price: number;
  cadence: string;
  tagline: string;
  features: string[];
  /** Empty until Stripe is connected and the payment link is verified. */
  stripeUrl: string;
  cta: string;
  unavailable?: boolean;
}

export const AD_PACKAGES: AdPackage[] = [
  {
    id: "featured-listing",
    name: "Featured Listing",
    price: 29,
    cadence: "/month",
    tagline: "Help your business get noticed across Leander.",
    features: [
      "Featured placement in the business directory",
      "Featured badge on your listing",
      "Share your photo, hours, and contact links",
      "Scope and availability confirmed by email",
    ],
    stripeUrl: "",
    cta: "Ask about a listing",
  },
  {
    id: "sponsored-event",
    name: "Sponsored Event",
    price: 19,
    cadence: "/event",
    tagline: "Promote your local event to the whole town.",
    features: [
      "Featured placement on Events + homepage",
      "Sponsored label for paid placement",
      "Dates and placement agreed before payment",
      "Subject to review and availability",
    ],
    stripeUrl: "",
    cta: "Ask about an event",
  },
  {
    id: "featured-job",
    name: "Featured Job",
    price: 59,
    cadence: "/30 days",
    tagline: "Highlight a local opening for 30 days.",
    features: [
      "Featured placement on the Jobs board",
      "30-day featured period",
      "Link to your own application page",
      "Scope and availability confirmed by email",
    ],
    stripeUrl: "",
    cta: "Ask about a job",
  },
  {
    id: "service-leads",
    name: "Service Leads",
    price: 0,
    cadence: "",
    unavailable: true,
    tagline: "Not available. No lead-delivery service is operating.",
    features: [
      "No requests are qualified or routed",
      "No customer details are delivered",
      "No exclusive categories are offered",
      "No lead payments are accepted",
    ],
    stripeUrl: "",
    cta: "Ask a question",
  },
];

/** Existing three-step layout explains the actual email-only inquiry process. */
export const SERVICE_LEAD_STEPS = [
  {
    title: "Tell us about your business",
    body: "Prepare an email with your business details and the placement you would like to discuss.",
  },
  {
    title: "Send your inquiry",
    body: "Send the draft from your email app, or copy it into an email. This site does not send it for you.",
  },
  {
    title: "Confirm the details first",
    body: "Confirm the placement details and terms by email before committing. An inquiry reserves nothing.",
  },
] as const;

export function formatPrice(pkg: AdPackage): string {
  return pkg.unavailable ? "Unavailable" : `$${pkg.price}${pkg.cadence}`;
}
