/**
 * Launch-phase service-lead pipeline (CHR-1869).
 *
 * Production remains static: the neighbor form prepares an email draft and
 * does not send it. Qualification, routing, and invoicing are pure helpers
 * for a human reviewer. Paid routing stays off until privacy language
 * (CHR-1754) is approved and a category buyer is signed.
 */

export const LEAD_EMAIL = "chris@newtonandcarter.com";
export const LEAD_PRICE_USD = 35;
export const LEANDER_ZIPS = ["78641", "78645", "78646"] as const;
export const PRIVACY_LANGUAGE_APPROVED = false;
export const GIFT_CARD_DRAWING_OPEN = false;

export const LAUNCH_CATEGORIES = [
  { id: "plumbing", label: "Plumbing", buyerSigned: false },
  { id: "hvac", label: "HVAC", buyerSigned: false },
  { id: "lawn", label: "Lawn / landscaping", buyerSigned: false },
  { id: "cleaning", label: "House cleaning", buyerSigned: false },
  { id: "electrical", label: "Electrical", buyerSigned: false },
] as const;

export type LaunchCategoryId = (typeof LAUNCH_CATEGORIES)[number]["id"];

export const LEAD_STAGES = [
  "captured",
  "review",
  "qualified",
  "routed",
  "delivered",
  "invoiced",
  "closed",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^(\d{5})(?:-\d{4})?$/;

export interface ServiceRequestInput {
  name: string;
  email: string;
  phone: string;
  zip: string;
  category: string;
  details: string;
  weeklyEmail: boolean;
}

export interface WeeklySignupInput {
  name: string;
  email: string;
  zip: string;
}

export interface EmailDraft {
  subject: string;
  body: string;
}

export function normalizeZip(value: string): string | null {
  const match = String(value ?? "").trim().match(ZIP_RE);
  return match ? match[1] : null;
}

export function isLeanderZip(zip: string): boolean {
  return (LEANDER_ZIPS as readonly string[]).includes(zip);
}

export function categoryById(id: string) {
  return LAUNCH_CATEGORIES.find((c) => c.id === id);
}

export function validateServiceRequest(input: ServiceRequestInput): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push("name");
  if (!input.details.trim()) errors.push("details");
  const email = input.email.trim();
  const phone = input.phone.trim();
  if (!email && !phone) errors.push("contact");
  if (email && !EMAIL_RE.test(email)) errors.push("email");
  const zip = normalizeZip(input.zip);
  if (!zip) errors.push("zip");
  else if (!isLeanderZip(zip)) errors.push("leander-zip");
  if (!categoryById(input.category)) errors.push("category");
  return errors;
}

export function validateWeeklySignup(input: WeeklySignupInput): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push("name");
  if (!EMAIL_RE.test(input.email.trim())) errors.push("email");
  const zip = normalizeZip(input.zip);
  if (!zip) errors.push("zip");
  else if (!isLeanderZip(zip)) errors.push("leander-zip");
  return errors;
}

export function serviceRequestDraft(input: ServiceRequestInput): EmailDraft {
  const zip = normalizeZip(input.zip) ?? input.zip.trim();
  const category = categoryById(input.category);
  return {
    subject: `Service request: ${category?.label ?? input.category} (${zip})`,
    body: [
      `Neighbor: ${input.name.trim()}`,
      input.email.trim() ? `Email: ${input.email.trim()}` : null,
      input.phone.trim() ? `Phone: ${input.phone.trim()}` : null,
      `ZIP: ${zip}`,
      `Category: ${category?.label ?? input.category}`,
      `Buyer signed for this category: ${category?.buyerSigned ? "yes" : "no"}`,
      input.weeklyEmail ? "Weekly email: yes" : "Weekly email: no",
      GIFT_CARD_DRAWING_OPEN
        ? "Gift-card drawing: open (not used in this launch)."
        : "Gift-card drawing: not open. ZIP is stored on the draft only so a later drawing can reuse it.",
      "",
      "Need:",
      input.details.trim(),
      "",
      "This is a human-review capture. Preparing this draft does not send it.",
      "Leander Live does not route this to a business until paid lead routing and its privacy language are approved.",
      "The neighbor does not pay. No data-broker sale. No marketing list is created by this draft.",
      `Manual invoice if a signed buyer is later delivered: $${LEAD_PRICE_USD} (Stripe invoice sent by hand; no payment link).`,
    ]
      .filter((line) => line !== null)
      .join("\n"),
  };
}

export function weeklyEmailDraft(input: WeeklySignupInput): EmailDraft {
  const zip = normalizeZip(input.zip) ?? input.zip.trim();
  return {
    subject: `Weekly email list: ${input.name.trim()} (${zip})`,
    body: [
      `Name: ${input.name.trim()}`,
      `Email: ${input.email.trim()}`,
      `ZIP: ${zip}`,
      "",
      'Request to join the "This week in Leander" email list.',
      "Preparing this draft does not subscribe anyone by itself — it is sent only if the visitor sends the email.",
      GIFT_CARD_DRAWING_OPEN
        ? "Gift-card drawing: open."
        : "Gift-card drawing: not open. ZIP is on the draft so a later free-entry drawing can reuse it.",
    ].join("\n"),
  };
}

export interface LeadRecord {
  id: string;
  stage: LeadStage;
  category: LaunchCategoryId;
  zip: string;
  createdAt: number;
  buyerId: string | null;
  deliveredAt: number | null;
  invoice: {
    amount: number;
    status: "not_invoiced" | "drafted" | "sent";
    text: string | null;
  };
  reason?: string;
}

function stageName(stage: LeadStage): LeadStage {
  switch (stage) {
    case "captured":
    case "review":
    case "qualified":
    case "routed":
    case "delivered":
    case "invoiced":
    case "closed":
      return stage;
    default: {
      const _never: never = stage;
      throw new Error(`Unknown lead stage: ${_never}`);
    }
  }
}

export function captureLead(
  input: ServiceRequestInput,
  now = Date.now(),
): LeadRecord {
  const errors = validateServiceRequest(input);
  if (errors.length) throw new Error(`Invalid request: ${errors.join(",")}`);
  const category = categoryById(input.category);
  if (!category) throw new Error("Unknown category");
  return {
    id: `lead-${now}`,
    stage: stageName("captured"),
    category: category.id,
    zip: normalizeZip(input.zip) as string,
    createdAt: now,
    buyerId: null,
    deliveredAt: null,
    invoice: { amount: LEAD_PRICE_USD, status: "not_invoiced", text: null },
  };
}

export function qualifyLead(
  lead: LeadRecord,
  { accepted }: { accepted: boolean },
): LeadRecord {
  if (lead.stage !== "captured" && lead.stage !== "review") {
    throw new Error("Only captured/review leads can be qualified.");
  }
  return {
    ...lead,
    stage: accepted ? "qualified" : "closed",
    reason: accepted ? undefined : "human-rejected",
  };
}

export function routeLead(
  lead: LeadRecord,
  buyer: { id: string; category: LaunchCategoryId; signed: boolean } | null,
): LeadRecord {
  if (lead.stage !== "qualified") {
    throw new Error("Only qualified leads can be routed.");
  }
  if (!PRIVACY_LANGUAGE_APPROVED) {
    return {
      ...lead,
      stage: "qualified",
      reason: "privacy-unapproved",
    };
  }
  if (!buyer || !buyer.signed || buyer.category !== lead.category) {
    return {
      ...lead,
      stage: "qualified",
      reason: "no-category-buyer",
    };
  }
  return {
    ...lead,
    stage: "routed",
    buyerId: buyer.id,
    reason: undefined,
  };
}

export function deliverLead(lead: LeadRecord, now = Date.now()): LeadRecord {
  if (lead.stage !== "routed" || !lead.buyerId) {
    throw new Error("Only routed leads with a buyer can be delivered.");
  }
  return {
    ...lead,
    stage: "delivered",
    deliveredAt: now,
  };
}

export function manualInvoiceText(lead: LeadRecord): string {
  return [
    "Leander Live — manual Stripe invoice (not sent)",
    `Amount: $${LEAD_PRICE_USD}.00`,
    `Lead: ${lead.id}`,
    `Category: ${lead.category}`,
    `Buyer: ${lead.buyerId ?? "(none)"}`,
    `Delivered: ${lead.deliveredAt ? new Date(lead.deliveredAt).toISOString() : "no"}`,
    "Create this invoice by hand in Stripe. This helper does not call Stripe or collect a card.",
  ].join("\n");
}

export function draftInvoice(lead: LeadRecord): LeadRecord {
  if (lead.stage !== "delivered") {
    throw new Error("Invoice drafts are only for delivered leads.");
  }
  return {
    ...lead,
    stage: "invoiced",
    invoice: {
      amount: LEAD_PRICE_USD,
      status: "drafted",
      text: manualInvoiceText(lead),
    },
  };
}

export function serviceRequestDisclosure(): string {
  return [
    "Preparing this draft does not send it. If you send the email, Newton & Carter LLC (Leander Live) receives your name, contact details, ZIP, and job description for human review.",
    "We do not send those details to a local business unless and until paid lead routing and its privacy language are approved.",
    "You never pay Leander Live for a referral. We do not sell this information to data brokers.",
    GIFT_CARD_DRAWING_OPEN
      ? "The monthly gift-card drawing is open."
      : "The monthly gift-card drawing is not open. Your ZIP is on the draft so a later free-entry drawing can reuse it.",
  ].join(" ");
}
