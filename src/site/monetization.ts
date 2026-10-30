/**
 * Proposed advertising options only. These rates have not been approved.
 * No payment links, reserved placements, or lead-delivery service are active.
 * Keep payment URLs empty until separately approved and verified.
 */
export interface AdPackage {
  id: string;
  name: string;
  price: number;
  cadence: string;
  tagline: string;
  features: string[];
  /** Empty while this is an inquiry-only proposal. */
  stripeUrl: string;
  cta: string;
  unavailable?: boolean;
}

export const AD_PACKAGES: AdPackage[] = [
  {
    id: "featured-listing",
    name: "Featured Listing",
    price: 49,
    cadence: "/month",
    tagline: "A proposed way to help your business get noticed.",
    features: [
      "Proposed placement in the business directory",
      "Featured badge under consideration",
      "Share your photo, hours, and contact links",
      "Scope and availability confirmed by email",
    ],
    stripeUrl: "",
    cta: "Ask about a listing",
  },
  {
    id: "sponsored-event",
    name: "Sponsored Event",
    price: 29,
    cadence: "/event",
    tagline: "Explore a proposed promotion for your local event.",
    features: [
      "Proposed placement on Events + homepage",
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
    price: 99,
    cadence: "/30 days",
    tagline: "Explore a proposed way to highlight a local opening.",
    features: [
      "Proposed placement on the Jobs board",
      "Proposed 30-day featured period",
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
    body: "Ask about availability, final pricing, and terms before committing. An inquiry reserves nothing.",
  },
] as const;

export function formatPrice(pkg: AdPackage): string {
  return pkg.unavailable ? "Unavailable" : `Proposed $${pkg.price}${pkg.cadence}`;
}
