/**
 * Proposed promotion packages, not active products.
 * Rates are unapproved. There is no checkout, automatic placement, or paid
 * fulfillment workflow. An inquiry is neither a reservation nor a purchase.
 * Keep links empty until pricing, terms, fulfillment, and checkout are verified.
 */
export interface AdPackage {
  id: string;
  name: string;
  price: number;
  cadence: string;
  tagline: string;
  features: string[];
  stripeUrl: string;
  cta: string;
  /** Source compatibility only; no exclusivity offer is active. */
  exclusivity?: { price: number; cadence: string; stripeUrl: string };
}

export const AD_PACKAGES: AdPackage[] = [
  {
    id: "sponsored-event", name: "Sponsored event", price: 29, cadence: "/event",
    tagline: "Bring more neighbors to your next event.",
    features: ["Proposed priority placement on the event board", "Clearly labeled sponsored listing", "Event details and a link to your official page"],
    stripeUrl: "", cta: "Ask about event promotion",
  },
  {
    id: "featured-job", name: "Featured job", price: 99, cadence: "/30 days",
    tagline: "Put your opening in front of local talent.",
    features: ["Proposed featured placement for 30 days", "Clearly labeled promoted opening", "Direct link to your application page"],
    stripeUrl: "", cta: "Ask about job promotion",
  },
  {
    id: "featured-listing", name: "Featured business", price: 49, cadence: "/month",
    tagline: "Help Leander discover what you do best.",
    features: ["Proposed featured directory placement", "Clearly labeled promoted business", "Business details and direct contact links"],
    stripeUrl: "", cta: "Ask about business promotion",
  },
];

/** Legacy export only. Service-lead fulfillment is not available. */
export const SERVICE_LEAD_STEPS: readonly { title: string; body: string }[] = [];
export function formatPrice(pkg: AdPackage | undefined): string {
  return pkg ? `$${pkg.price}${pkg.cadence}` : "Pricing on request";
}
