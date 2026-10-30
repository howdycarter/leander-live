import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, CalendarDays, Check, ChevronLeft, Copy, Mail, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AD_PACKAGES, formatPrice, type AdPackage } from "./monetization";
import { trackEvent } from "./analytics";

const CONTACT_EMAIL = "chris@howdycarter.com";
type SubmissionType = "event" | "job" | "business";
const TYPES = [
  { id: "event", label: "An event", Icon: CalendarDays, description: "Give the neighborhood something to look forward to." },
  { id: "job", label: "A job", Icon: BriefcaseBusiness, description: "Find your next great teammate, right here in Leander." },
  { id: "business", label: "A business", Icon: Store, description: "Introduce your business or suggest a directory correction." },
] as const;
const PLAN_TYPES: Record<string, SubmissionType> = {
  "sponsored-event": "event", "featured-job": "job", "featured-listing": "business",
};
type Fields = { title: string; organization: string; location: string; date: string; time: string; allDay: boolean; url: string; details: string; contact: string; email: string; pay: string; jobType: string };
const emptyFields = (): Fields => ({ title: "", organization: "", location: "", date: "", time: "", allDay: false, url: "", details: "", contact: "", email: "", pay: "", jobType: "" });
type EmailDraft = { subject: string; body: string };

function Field({ id, label, children, hint }: { id: string; label: string; children: ReactNode; hint?: string }) {
  return <div className="grid min-w-0 gap-2"><Label htmlFor={id}>{label}</Label>{children}{hint && <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}</div>;
}

function draftFor(type: SubmissionType, values: Fields, plan?: AdPackage): EmailDraft {
  const subject = `${plan ? "Promotion inquiry" : "Listing submission"}: ${values.title.trim()}`;
  const body = [
    `${plan ? "Promotion inquiry" : "Listing submission"} — ${type}`,
    `Title / business name: ${values.title.trim()}`,
    values.organization.trim() && `Organizer / employer: ${values.organization.trim()}`,
    `Location: ${values.location.trim()}`,
    type === "event" && `Date: ${values.date}`,
    type === "event" && `Time: ${values.allDay ? "All day" : values.time} (America/Chicago — Leander local time)`,
    type === "job" && values.jobType && `Job type: ${values.jobType}`,
    type === "job" && values.pay.trim() && `Pay: ${values.pay.trim()}`,
    values.url.trim() && `Official / application URL: ${values.url.trim()}`,
    "", "Details:", values.details.trim(), "",
    `Contact: ${values.contact.trim()}`, `Reply email: ${values.email.trim()}`,
    plan && `\nInterested in: ${plan.name} — proposed ${formatPrice(plan)}`,
    plan && "Please confirm availability, final pricing, placement, and terms. This is an inquiry only, not a reservation or purchase.",
    "", "I understand this listing is subject to review and is not automatically published.",
  ].filter((line) => line !== false && line !== undefined).join("\n");
  return { subject, body };
}

export function SubmitPage() {
  const [params, setParams] = useSearchParams();
  const typeParam = params.get("type");
  const type: SubmissionType = typeParam === "job" || typeParam === "business" ? typeParam : "event";
  const plan = AD_PACKAGES.find((item) => item.id === params.get("plan") && PLAN_TYPES[item.id] === type);
  const [forms, setForms] = useState<Record<SubmissionType, Fields>>(() => ({ event: emptyFields(), job: emptyFields(), business: emptyFields() }));
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [emailAttempted, setEmailAttempted] = useState(false);
  const draftRef = useRef<HTMLElement>(null);
  const values = forms[type];
  const currentType = TYPES.find((item) => item.id === type)!;

  // Back/Forward and promotion links must not leave a draft from a different
  // request visible. Keep the individual forms in memory, but invalidate preview.
  useEffect(() => {
    setDraft(null); setCopyStatus(""); setEmailAttempted(false);
  }, [type, plan?.id]);

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setForms((previous) => ({ ...previous, [type]: { ...previous[type], [key]: value } }));
    setDraft(null); setCopyStatus(""); setEmailAttempted(false);
  }
  function chooseType(next: SubmissionType) {
    if (next === type) return;
    setParams({ type: next });
    setDraft(null); setCopyStatus(""); setEmailAttempted(false);
  }
  function prepareDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    for (const control of Array.from(event.currentTarget.elements)) {
      if ((control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) && control.required && !control.value.trim()) {
        control.setCustomValidity("Please enter a value, not only spaces.");
        control.reportValidity();
        return;
      }
    }
    setDraft(draftFor(type, values, plan)); setCopyStatus(""); setEmailAttempted(false);
    trackEvent("submission_draft_prepared", { listing_type: type, package: plan?.id ?? "standard" });
    requestAnimationFrame(() => {
      draftRef.current?.focus();
      draftRef.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
    });
  }
  async function copyDraft() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`To: ${CONTACT_EMAIL}\nSubject: ${draft.subject}\n\n${draft.body}`);
      setCopyStatus("Draft copied. Paste it into your email app and send it when you’re ready.");
    } catch {
      setCopyStatus("Copy isn’t available in this browser. Select and copy the draft below instead.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary"><ChevronLeft className="h-4 w-4" /> Back to the neighborhood</Link>
      <div className="mt-8 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Made by the community</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Put it on the local board.</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">An upcoming event, a new opportunity, a place worth knowing. Share the details and help your neighbors discover it.</p>
      </div>
      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <fieldset className="mb-6">
            <legend className="mb-3 text-sm font-semibold">What would you like to share?</legend>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {TYPES.map(({ id, label, Icon }) => <Button key={id} type="button" variant={type === id ? "default" : "outline"} aria-pressed={type === id} onClick={() => chooseType(id)} className="h-auto min-h-14 flex-col gap-2 px-2 py-3 sm:flex-row"><Icon className="h-4 w-4" />{label}</Button>)}
            </div>
          </fieldset>
          <Card>
            <CardContent className="p-5 sm:p-8">
              <h2 className="text-xl font-semibold">{plan ? `${plan.name} inquiry` : `Share ${currentType.label.toLowerCase()}`}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{currentType.description}</p>
              {plan && <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm"><p className="font-semibold">Proposed rate: {formatPrice(plan)}</p><p className="mt-1 text-muted-foreground">Inquiry only. Final pricing, availability, and terms must be confirmed before any payment or placement.</p><Link to={`/submit?type=${type}`} className="mt-2 inline-block font-medium text-primary underline underline-offset-4" onClick={() => setDraft(null)}>Continue without promotion</Link></div>}
              <form onSubmit={prepareDraft} onInput={(event) => { const control = event.target; if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) control.setCustomValidity(""); }} className="mt-7 grid gap-5">
                <Field id="submission-title" label={type === "business" ? "Business name *" : type === "job" ? "Job title *" : "Event title *"}>
                  <Input id="submission-title" required maxLength={160} value={values.title} onChange={(e) => update("title", e.target.value)} placeholder={type === "event" ? "What’s happening?" : type === "job" ? "What role are you hiring for?" : "Your business name"} />
                </Field>
                {type !== "business" && <Field id="submission-organization" label={type === "job" ? "Employer *" : "Organizer *"}><Input id="submission-organization" required maxLength={160} value={values.organization} onChange={(e) => update("organization", e.target.value)} /></Field>}
                <Field id="submission-location" label={type === "event" ? "Venue and address *" : type === "job" ? "Work location *" : "Address or service area *"}>
                  <Input id="submission-location" required maxLength={240} value={values.location} onChange={(e) => update("location", e.target.value)} placeholder={type === "job" ? "Leander, TX · on-site, hybrid, or remote" : "Help people find you"} />
                </Field>
                {type === "event" && <><div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field id="submission-date" label="Event date *"><Input id="submission-date" type="date" required value={values.date} onChange={(e) => update("date", e.target.value)} /></Field>
                  <Field id="submission-time" label={values.allDay ? "Start time" : "Start time *"} hint="Leander local time (Central)."><Input id="submission-time" type="time" aria-describedby="submission-time-hint" required={!values.allDay} disabled={values.allDay} value={values.time} onChange={(e) => update("time", e.target.value)} /></Field>
                </div><label htmlFor="submission-all-day" className="inline-flex w-fit cursor-pointer items-center gap-3 text-sm"><Checkbox id="submission-all-day" checked={values.allDay} onCheckedChange={(checked) => update("allDay", checked === true)} /> This is an all-day event</label></>}
                {type === "job" && <div className="grid grid-cols-1 gap-5 sm:grid-cols-2"><Field id="submission-job-type" label="Job type"><Input id="submission-job-type" maxLength={80} placeholder="Full-time, part-time, contract…" value={values.jobType} onChange={(e) => update("jobType", e.target.value)} /></Field><Field id="submission-pay" label="Pay range"><Input id="submission-pay" maxLength={120} placeholder="e.g. $20–$25 / hour" value={values.pay} onChange={(e) => update("pay", e.target.value)} /></Field></div>}
                <Field id="submission-url" label={type === "job" ? "Application link *" : "Official website or listing link"} hint="Include https://. Only share a public link."><Input id="submission-url" type="url" aria-describedby="submission-url-hint" required={type === "job"} maxLength={1000} placeholder="https://" value={values.url} onChange={(e) => update("url", e.target.value)} /></Field>
                <Field id="submission-details" label="The details *" hint={type === "event" ? "Include admission cost, end time, accessibility details, and anything attendees should know." : type === "job" ? "Include responsibilities, requirements, and how to apply." : "Tell us what you offer, your hours, or what needs correcting."}><Textarea id="submission-details" required aria-describedby="submission-details-hint" rows={5} maxLength={3000} value={values.details} onChange={(e) => update("details", e.target.value)} /></Field>
                <div className="border-t pt-6">
                  <h3 className="mb-4 text-sm font-semibold">How can we reach you?</h3>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2"><Field id="submission-contact" label="Your name *"><Input id="submission-contact" required autoComplete="name" maxLength={120} value={values.contact} onChange={(e) => update("contact", e.target.value)} /></Field><Field id="submission-email" label="Email address *"><Input id="submission-email" type="email" required autoComplete="email" maxLength={200} value={values.email} onChange={(e) => update("email", e.target.value)} /></Field></div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">Required fields are marked *. Your details stay in this page until you choose to send the email. We use your contact information to review the listing. <Link to="/privacy" className="underline underline-offset-2">Privacy policy</Link></p>
                <Button type="submit" className="min-h-11 w-full sm:w-fit">Prepare email draft <ArrowRight className="h-4 w-4" /></Button>
                <p className="-mt-2 text-xs text-muted-foreground">Nothing is sent or published by this button.</p>
              </form>
            </CardContent>
          </Card>
          {draft && <section ref={draftRef} tabIndex={-1} aria-labelledby="draft-heading" className="mt-6 rounded-2xl border border-primary/25 bg-card p-5 outline-none sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Ready for your review</p>
            <h2 id="draft-heading" className="mt-2 text-2xl font-semibold">Your draft is ready. It has not been sent.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Open your email app, review the details, and press Send there. If an email app doesn’t open, copy the draft and email it to <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary underline underline-offset-2">{CONTACT_EMAIL}</a>.</p>
            <div className="my-5 flex flex-wrap gap-3"><Button asChild><a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`} onClick={() => { setEmailAttempted(true); trackEvent("submission_email_opened", { listing_type: type, package: plan?.id ?? "standard" }); }}><Mail className="h-4 w-4" /> Open email app</a></Button><Button type="button" variant="outline" onClick={copyDraft}><Copy className="h-4 w-4" /> Copy draft</Button></div>
            <div role="status" aria-live="polite" className="text-sm leading-relaxed text-muted-foreground">{copyStatus || (emailAttempted ? "We can’t verify that your email app opened or that the email was sent. Please send it from your email app to complete your request." : "")}</div>
            <label htmlFor="submission-draft" className="mb-2 mt-4 block text-sm font-medium">Draft text — select to copy manually</label><Textarea id="submission-draft" readOnly rows={12} value={`To: ${CONTACT_EMAIL}\nSubject: ${draft.subject}\n\n${draft.body}`} className="font-mono text-xs" />
          </section>}
        </div>
        <aside className="space-y-6 lg:sticky lg:top-24">
          <div className="rounded-2xl bg-muted/60 p-6"><h2 className="text-lg font-semibold">A little local knowledge goes a long way.</h2><ol className="mt-5 space-y-5 text-sm">{[["Share the essentials", "Use accurate details and an official source when you have one."], ["Send your email", "We prepare a draft. You review and send it from your own email app."], ["We review the request", "Listings are reviewed for relevance and accuracy before publication."]].map(([title, body], index) => <li key={title} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold">{index + 1}</span><div><p className="font-semibold">{title}</p><p className="mt-1 leading-relaxed text-muted-foreground">{body}</p></div></li>)}</ol></div>
          <div className="px-1 text-sm"><h2 className="font-semibold">Looking for a little more visibility?</h2><p className="mt-2 leading-relaxed text-muted-foreground">Explore proposed promotion options for events, jobs, and local businesses. No payment is collected here.</p><Link to="/advertise" className="mt-3 inline-flex items-center gap-2 font-semibold text-primary">Explore promotion <ArrowRight className="h-4 w-4" /></Link></div>
        </aside>
      </div>
    </main>
  );
}

export function AdvertisePage() {
  return <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
    <div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">For the people building Leander</p><h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-6xl">Local attention.<br />For local ambition.</h1><p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">Hosting something great? Hiring your next teammate? Running a neighborhood business? Let’s talk about helping the right people find you.</p></div>
    <div className="mt-10 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="text-sm leading-relaxed"><p className="font-semibold">Promotion is currently inquiry-only.</p><p className="mt-1 text-muted-foreground">These are proposed rates, not final offers. There is no online checkout and no payment is collected. We’ll need to confirm pricing, availability, placement, and terms directly before anything is purchased or promoted.</p></div></div>
    <section aria-label="Proposed promotion packages" className="mt-8 grid gap-5 md:grid-cols-3">{AD_PACKAGES.map((pkg) => <Card key={pkg.id} className="flex"><CardContent className="flex flex-1 flex-col p-6 sm:p-7"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proposed package</p><h2 className="mt-4 text-2xl font-semibold">{pkg.name}</h2><p className="mt-3 min-h-12 text-sm leading-relaxed text-muted-foreground">{pkg.tagline}</p><p className="my-6 text-4xl font-semibold tracking-tight">${pkg.price}<span className="ml-1 text-sm font-normal tracking-normal text-muted-foreground">{pkg.cadence}</span></p><ul className="mb-8 space-y-3 text-sm">{pkg.features.map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{feature}</span></li>)}</ul><Button asChild variant="outline" className="mt-auto w-full"><Link to={`/submit?type=${PLAN_TYPES[pkg.id]}&plan=${pkg.id}`}>Start an inquiry <ArrowRight className="h-4 w-4" /></Link></Button><p className="mt-3 text-center text-xs text-muted-foreground">No purchase. No reservation.</p></CardContent></Card>)}</section>
    <section className="mt-16 grid gap-8 border-t pt-10 md:grid-cols-2"><div><h2 className="text-2xl font-semibold tracking-tight">A good fit for the neighborhood.</h2><p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">Promoted listings should be relevant, useful, and clearly labeled. We don’t promise clicks, applications, attendance, or sales. The final placement and duration must be agreed before any payment.</p></div><div><h2 className="text-2xl font-semibold tracking-tight">Just want to share a listing?</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">You don’t have to request promotion to send an event, job, business, or correction for review.</p><Button asChild className="mt-5"><Link to="/submit">Submit a listing <ArrowRight className="h-4 w-4" /></Link></Button></div></section>
  </main>;
}
