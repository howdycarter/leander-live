import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHero } from "./conceptA";
import { emailDraftText, hasRequiredDraftFields, type EmailDraft } from "./emailDrafts";
import { useDraftCopy } from "./useDraftCopy";
import {
  GIFT_CARD_DRAWING_OPEN,
  LAUNCH_CATEGORIES,
  LEAD_EMAIL,
  LEAD_PRICE_USD,
  PRIVACY_LANGUAGE_APPROVED,
  serviceRequestDisclosure,
  serviceRequestDraft,
  validateServiceRequest,
  weeklyEmailDraft,
  validateWeeklySignup,
} from "./serviceLeads";

function mailtoFor(subject: string, body: string): string {
  return `mailto:${LEAD_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const EMPTY_REQUEST = {
  name: "",
  email: "",
  phone: "",
  zip: "",
  category: "",
  details: "",
  weeklyEmail: true,
};

export function ServiceRequestForm() {
  const [input, setInput] = useState(EMPTY_REQUEST);
  const [prepared, setPrepared] = useState<EmailDraft | null>(null);
  const [error, setError] = useState("");
  const draftKey = JSON.stringify(input);
  const active = prepared;
  const { copyStatus, copyDraft, resetCopy } = useDraftCopy(active, LEAD_EMAIL, draftKey);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errors = validateServiceRequest(input);
    if (errors.length || !hasRequiredDraftFields([input.name, input.details])) {
      setError(
        errors.includes("leander-zip")
          ? "Use a Leander ZIP (78641, 78645, or 78646)."
          : "Add your name, a Leander ZIP, a category, the job details, and an email or phone number.",
      );
      return;
    }
    setError("");
    resetCopy();
    setPrepared(serviceRequestDraft(input));
  }

  if (prepared) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email draft prepared — not sent</CardTitle>
          <CardDescription>
            Open your email app to send it, or copy the draft. Nothing has been
            routed to a business.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              Human review only. Paid routing is off
              {PRIVACY_LANGUAGE_APPROVED ? "" : " (privacy language not approved)"}.
              Category buyers have not been signed.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={mailtoFor(prepared.subject, prepared.body)}>Open email app</a>
            </Button>
            <Button variant="outline" onClick={copyDraft}>
              Copy draft
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetCopy();
                setPrepared(null);
              }}
            >
              Edit details
            </Button>
          </div>
          {copyStatus ? (
            <p role="status" className="text-xs text-muted-foreground">
              {copyStatus}
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="svc-draft">Email draft — select to copy manually</Label>
            <Textarea
              id="svc-draft"
              readOnly
              rows={8}
              value={emailDraftText(prepared, LEAD_EMAIL)}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request a local pro</CardTitle>
        <CardDescription>
          Plumbing, HVAC, lawn, cleaning, or electrical. We review requests by
          email. Nobody is assigned until a category buyer is signed and privacy
          language is approved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="svc-name">Your name</Label>
              <Input
                id="svc-name"
                value={input.name}
                onChange={(e) => setInput({ ...input, name: e.target.value })}
                required
                maxLength={120}
                placeholder="Alex Rivera"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="svc-zip">Leander ZIP</Label>
              <Input
                id="svc-zip"
                value={input.zip}
                onChange={(e) => setInput({ ...input, zip: e.target.value })}
                required
                inputMode="numeric"
                placeholder="78641"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="svc-email">Email</Label>
              <Input
                id="svc-email"
                type="email"
                value={input.email}
                onChange={(e) => setInput({ ...input, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="svc-phone">Phone</Label>
              <Input
                id="svc-phone"
                type="tel"
                value={input.phone}
                onChange={(e) => setInput({ ...input, phone: e.target.value })}
                placeholder="(512) 555-0123"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            At least one of email or phone is required.
          </p>
          <div className="grid gap-2">
            <Label>What do you need?</Label>
            <Select
              value={input.category}
              onValueChange={(category) => setInput({ ...input, category })}
              required
            >
              <SelectTrigger aria-label="Service category" id="svc-category">
                <SelectValue placeholder="Choose a category…" />
              </SelectTrigger>
              <SelectContent>
                {LAUNCH_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                    {c.buyerSigned ? "" : " (waitlist — no buyer signed yet)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="svc-details">Describe the job</Label>
            <Textarea
              id="svc-details"
              value={input.details}
              onChange={(e) => setInput({ ...input, details: e.target.value })}
              required
              rows={5}
              maxLength={2000}
              placeholder="Leaking outdoor faucet on the north side of the house…"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <Checkbox
              checked={input.weeklyEmail}
              onCheckedChange={(checked) =>
                setInput({ ...input, weeklyEmail: checked === true })
              }
              aria-label="Also ask to join the weekly This week in Leander email"
            />
            <span>
              Also ask to join the weekly “This week in Leander” email. This is
              not a subscription until you send the draft.
            </span>
          </label>
          <p className="text-xs text-muted-foreground">{serviceRequestDisclosure()}</p>
          {GIFT_CARD_DRAWING_OPEN ? null : (
            <p className="text-xs text-muted-foreground">
              The monthly gift-card drawing is a later phase and is not open.
            </p>
          )}
          {error ? (
            <p role="alert" className="text-xs font-semibold text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit">
            <Mail className="h-4 w-4" /> Prepare email draft
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function WeeklyEmailForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [zip, setZip] = useState("");
  const [prepared, setPrepared] = useState<EmailDraft | null>(null);
  const [error, setError] = useState("");
  const key = JSON.stringify({ name, email, zip });
  const { copyStatus, copyDraft, resetCopy } = useDraftCopy(prepared, LEAD_EMAIL, key);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const input = { name, email, zip };
    if (validateWeeklySignup(input).length) {
      setError("Add your name, a valid email, and a Leander ZIP (78641, 78645, or 78646).");
      return;
    }
    setError("");
    resetCopy();
    setPrepared(weeklyEmailDraft(input));
  }

  if (prepared) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly email draft — not sent</CardTitle>
          <CardDescription>
            Send it from your email app to ask to join the list. This site does
            not subscribe you by itself.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={mailtoFor(prepared.subject, prepared.body)}>Open email app</a>
            </Button>
            <Button variant="outline" onClick={copyDraft}>
              Copy draft
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetCopy();
                setPrepared(null);
              }}
            >
              Edit details
            </Button>
          </div>
          {copyStatus ? (
            <p role="status" className="text-xs text-muted-foreground">
              {copyStatus}
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="week-draft">Email draft — select to copy manually</Label>
            <Textarea
              id="week-draft"
              readOnly
              rows={6}
              value={emailDraftText(prepared, LEAD_EMAIL)}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>This week in Leander</CardTitle>
        <CardDescription>
          Ask to join the weekly email. Preparing the draft does not subscribe
          you. The gift-card drawing is not open.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="week-name">Name</Label>
            <Input
              id="week-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="week-email">Email</Label>
              <Input
                id="week-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="week-zip">Leander ZIP</Label>
              <Input
                id="week-zip"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                required
                placeholder="78641"
              />
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-xs font-semibold text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit">
            <Mail className="h-4 w-4" /> Prepare email draft
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ServiceRequestPage() {
  return (
    <>
      <PageHero
        eyebrow="Neighbors"
        title="Need a plumber, HVAC tech, or lawn crew?"
        subtitle="Tell us what you need. We review every request. We do not sell or route your details until privacy language is approved and a category buyer is signed."
      />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid max-w-2xl gap-6">
          <ServiceRequestForm />
          <p className="text-sm text-muted-foreground">
            Businesses looking for advertising, not leads, can{" "}
            <Link to="/advertise" className="font-semibold text-primary underline">
              ask about a placement
            </Link>
            . Manual invoicing, if routing ever starts, is ${LEAD_PRICE_USD} per
            delivered lead — there is no online checkout here.
          </p>
        </div>
      </main>
    </>
  );
}
