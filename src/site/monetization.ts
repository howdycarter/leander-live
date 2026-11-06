/**
 * Posting pricing — set by Chris Carter on 2026-11-06, replacing the
 * 2026-10-31 charter tiers (Featured Listing $29/mo, Sponsored Event $19,
 * Featured Job $59). The model is now flat: EVERY posting costs $5/month
 * (Standard) or $10/month (Sponsored), whatever the posting type, and a
 * posting is published only after payment is confirmed. There is no
 * free-publish path.
 *
 * Stripe is not connected yet (CHR-1752 — the connect is Chris's own
 * step). Keep every stripeUrl empty until Stripe is connected and the
 * payment links are created and verified; while a tier's stripeUrl is
 * empty, paymentsEnabled() is false and its payment step must fail
 * closed with the "payments not yet enabled" state.
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
    id: "standard-posting",
    name: "Standard Posting",
    price: 5,
    cadence: "/month",
    tagline: "Any posting — business, event, or job — on the board for a month.",
    features: [
      "Any posting type: business, event, or job",
      "Live for one month from publication",
      "Standard placement in the listings",
      "Reviewed before it appears",
      "Published only after payment is confirmed",
    ],
    stripeUrl: "",
    cta: "Start a standard posting",
  },
  {
    id: "sponsored-posting",
    name: "Sponsored Posting",
    price: 10,
    cadence: "/month",
    tagline: "The same posting, promoted — featured placement with a Sponsored label.",
    features: [
      "Everything in Standard Posting",
      "Featured placement on the board and homepage",
      "Sponsored label on your posting",
      "Reviewed before it appears",
      "Published only after payment is confirmed",
    ],
    stripeUrl: "",
    cta: "Start a sponsored posting",
  },
];

/** The tier a new posting starts with. */
export const DEFAULT_TIER_ID = "standard-posting";

export function tierById(id: string): AdPackage {
  return AD_PACKAGES.find((p) => p.id === id) ?? AD_PACKAGES[0];
}

export function tierByName(name?: string): AdPackage | undefined {
  return name ? AD_PACKAGES.find((p) => p.name === name) : undefined;
}

/**
 * A tier can collect payment only when its verified Stripe payment link
 * exists. Stripe is not connected yet, so this is false for every tier
 * today and every payment step must fail closed.
 */
export function paymentsEnabled(pkg: AdPackage): boolean {
  return pkg.stripeUrl.trim().length > 0;
}

/** One-line price for a tier, e.g. "$5/month". */
export function tierPriceLabel(pkg: AdPackage): string {
  return `$${pkg.price}${pkg.cadence}`;
}

/** Steps for the Advertise page's questions section (service leads stay unavailable). */
export const SERVICE_LEAD_STEPS = [
  {
    title: "Tell us about your business",
    body: "Prepare an email with your business details and what you would like to ask about.",
  },
  {
    title: "Send your question",
    body: "Send the draft from your email app, or copy it into an email. This site does not send it for you.",
  },
  {
    title: "Postings are paid",
    body: "Questions are free; postings are not. Every posting is $5/mo (sponsored $10/mo) and goes live only after payment is confirmed — an inquiry publishes nothing.",
  },
] as const;

export function formatPrice(pkg: AdPackage): string {
  return pkg.unavailable ? "Unavailable" : `$${pkg.price}${pkg.cadence}`;
}
