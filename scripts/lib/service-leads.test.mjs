import test from "node:test";
import assert from "node:assert/strict";
import { AD_PACKAGES } from "../../src/site/monetization.ts";
import {
  GIFT_CARD_DRAWING_OPEN,
  LAUNCH_CATEGORIES,
  LEAD_PRICE_USD,
  PRIVACY_LANGUAGE_APPROVED,
  captureLead,
  deliverLead,
  draftInvoice,
  qualifyLead,
  routeLead,
  serviceRequestDisclosure,
  serviceRequestDraft,
  validateServiceRequest,
  validateWeeklySignup,
  weeklyEmailDraft,
} from "../../src/site/serviceLeads.ts";

const request = {
  name: "  Alex Rivera  ",
  email: "alex@example.test",
  phone: "",
  zip: "78641-1234",
  category: "plumbing",
  details: "  Outdoor faucet leak.  ",
  weeklyEmail: true,
};

test("launch categories stay waitlisted and privacy/drawing gates stay off", () => {
  assert.equal(PRIVACY_LANGUAGE_APPROVED, false);
  assert.equal(GIFT_CARD_DRAWING_OPEN, false);
  assert.deepEqual(LAUNCH_CATEGORIES.map((c) => [c.id, c.buyerSigned]), [
    ["plumbing", false],
    ["hvac", false],
    ["lawn", false],
    ["cleaning", false],
    ["electrical", false],
  ]);
  assert.equal(AD_PACKAGES.find((p) => p.id === "service-leads").unavailable, true);
  assert.equal(AD_PACKAGES.find((p) => p.id === "service-leads").stripeUrl, "");
});

test("service request validation requires a Leander ZIP and a real category", () => {
  assert.deepEqual(validateServiceRequest(request), []);
  assert.ok(validateServiceRequest({ ...request, zip: "78701" }).includes("leander-zip"));
  assert.ok(validateServiceRequest({ ...request, category: "roofing" }).includes("category"));
  assert.ok(validateServiceRequest({ ...request, email: "", phone: "" }).includes("contact"));
  assert.deepEqual(validateWeeklySignup({ name: "Alex", email: "alex@example.test", zip: "78645" }), []);
  assert.ok(validateWeeklySignup({ name: "Alex", email: "nope", zip: "78645" }).includes("email"));
});

test("drafts do not send, do not claim routing, and keep the drawing closed", () => {
  const draft = serviceRequestDraft(request);
  assert.match(draft.subject, /Plumbing \(78641\)/);
  assert.match(draft.body, /Buyer signed for this category: no/);
  assert.match(draft.body, /does not send it/);
  assert.match(draft.body, /does not route this to a business/);
  assert.match(draft.body, /Gift-card drawing: not open/);
  assert.match(draft.body, new RegExp(`\\$${LEAD_PRICE_USD}`));
  assert.doesNotMatch(draft.body, /you have been matched|we sold your lead/i);
  const weekly = weeklyEmailDraft({ name: "Alex", email: "a@example.test", zip: "78646" });
  assert.match(weekly.body, /does not subscribe anyone/);
  assert.match(serviceRequestDisclosure(), /do not send those details to a local business/i);
});

test("pipeline: capture → qualify → routing blocked without privacy + signed buyer", () => {
  const lead = captureLead(request, 1);
  assert.equal(lead.stage, "captured");
  assert.equal(lead.zip, "78641");
  const qualified = qualifyLead(lead, { accepted: true });
  assert.equal(qualified.stage, "qualified");
  const blockedPrivacy = routeLead(qualified, {
    id: "buyer-1",
    category: "plumbing",
    signed: true,
  });
  assert.equal(blockedPrivacy.stage, "qualified");
  assert.equal(blockedPrivacy.reason, "privacy-unapproved");
  assert.throws(() => deliverLead(qualified), /routed/);
});

test("rejected leads close; invoices are drafted only after delivery", () => {
  const closed = qualifyLead(captureLead(request, 2), { accepted: false });
  assert.equal(closed.stage, "closed");
  assert.throws(() => draftInvoice(closed), /delivered/);
});
