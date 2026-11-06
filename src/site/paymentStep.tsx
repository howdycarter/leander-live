import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CreditCard, Lock } from "lucide-react";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import {
  AD_PACKAGES,
  paymentsEnabled,
  tierById,
  tierPriceLabel,
  type AdPackage,
} from "./monetization";

/**
 * Paid-posting gate shared by every submit flow (event, job, business).
 *
 * Model (Chris Carter, 2026-11-06): every posting is paid — Standard
 * $5/mo, Sponsored $10/mo — and is published only after payment is
 * confirmed. There is no free-publish path.
 *
 * Stripe is not connected yet (CHR-1752), so paymentsEnabled() is false
 * and this step FAILS CLOSED: it shows the "payments not yet enabled"
 * state and the only way forward is saving the details as an email
 * draft, which the copy states plainly does not publish anything. When
 * a tier's verified Stripe payment link is added in monetization.ts,
 * this same step renders the Stripe checkout button instead.
 */
export function PostingTierPicker({
  tierId,
  onChange,
}: {
  tierId: string;
  onChange: (tierId: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold">Choose your posting</p>
      <SegmentedControl
        label="Posting tier"
        options={AD_PACKAGES.map((p) => ({
          value: p.id,
          label: `${p.name.replace(" Posting", "")} — ${tierPriceLabel(p)}`,
        }))}
        value={tierId}
        onValueChange={onChange}
      />
      <p className="text-xs text-muted-foreground">{tierById(tierId).tagline}</p>
    </div>
  );
}

export function PaymentStep({
  tier,
  onTierChange,
  onSaveDraft,
  onBack,
}: {
  tier: AdPackage;
  onTierChange: (tierId: string) => void;
  /** Fail-closed continuation: saves the details as an email draft. Never publishes. */
  onSaveDraft: () => void;
  onBack: () => void;
}) {
  const enabled = paymentsEnabled(tier);
  return (
    <div className="flex flex-col gap-4 py-2">
      <PostingTierPicker tierId={tier.id} onChange={onTierChange} />
      <p className="text-sm">
        <strong>
          {tier.name} — {tierPriceLabel(tier)}.
        </strong>{" "}
        Your posting goes live only after payment is confirmed and the
        details are reviewed. There is no free posting option.
      </p>
      {enabled ? (
        <Button asChild className="rounded-full">
          <a href={tier.stripeUrl}>
            <CreditCard className="h-4 w-4" /> Pay {tierPriceLabel(tier)} with
            Stripe
          </a>
        </Button>
      ) : (
        <>
          <Alert>
            <Lock className="h-4 w-4 text-secondary" />
            <AlertDescription>
              <strong>Payments aren&rsquo;t enabled yet.</strong> Online
              payment for Leander Live postings hasn&rsquo;t been turned on,
              so this posting can&rsquo;t go live right now — and it
              won&rsquo;t be published without payment. Save your details
              as an email draft and we&rsquo;ll reply when paid postings
              open; nothing is published or charged in the meantime.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onSaveDraft} className="rounded-full">
              Save details as an email draft
            </Button>
            <Button variant="outline" onClick={onBack} className="rounded-full">
              Back to details
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Body line carried into the email draft so the chosen tier is on record. */
export function tierDraftLine(tier: AdPackage): string {
  return `Posting tier: ${tier.name} (${tierPriceLabel(tier)}) — payment pending; not published.`;
}
