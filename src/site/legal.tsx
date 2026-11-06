/**
 * Legal pages for Leander Live — Terms of Use and Accessibility
 * Statement. The Privacy Policy lives in pages.tsx (PrivacyPage).
 *
 * Content rules (Nov 2, 2026 legal/compliance build): every sentence
 * must match how the site actually operates today — email-only
 * submissions, no accounts, no online checkout, paid placements
 * arranged and confirmed by email before any payment. Do not describe
 * features that do not exist. Operator: Newton & Carter LLC.
 * Contact for submissions, legal, and abuse: chris@newtonandcarter.com
 * (the same inbox the site's forms prepare email drafts to).
 */

import type { ReactNode } from "react";

export const LEGAL_CONTACT_EMAIL = "chris@newtonandcarter.com";
export const LEGAL_EFFECTIVE_DATE = "November 2, 2026";

function LegalShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-10"
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-primary">
        Leander Live
      </p>
      <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight text-navy">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Effective {LEGAL_EFFECTIVE_DATE}
      </p>
      <div className="prose-cream mt-8 space-y-6 text-body leading-relaxed">
        {children}
      </div>
    </main>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-xl font-extrabold text-navy">{heading}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

function MailLink() {
  return (
    <a
      href={`mailto:${LEGAL_CONTACT_EMAIL}`}
      className="font-semibold text-primary hover:underline"
    >
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}

/* ---------------- terms of use ---------------- */

export function TermsPage() {
  return (
    <LegalShell title="Terms of Use">
      <p>
        Leander Live is a community board for events, jobs, businesses, and
        civic information in Leander, Texas, operated by Newton &amp; Carter
        LLC (&ldquo;we,&rdquo; &ldquo;us&rdquo;). By using this site you agree
        to these terms. If you do not agree, please do not use the site.
      </p>

      <Section heading="The service">
        <p>
          The board collects listings from public sources (such as city,
          school district, and chamber publications) and from community
          submissions, and presents them for general information. Listings
          are provided by third parties and public sources, and details —
          dates, times, prices, job terms — can change without notice.
          Always confirm details with the event organizer, business, or
          employer before relying on them. Inclusion on the board is not an
          endorsement.
        </p>
        <p>
          There are no accounts and no sign-in. The site is provided
          &ldquo;as is&rdquo; and &ldquo;as available&rdquo;; we may change,
          suspend, or remove any part of it at any time.
        </p>
      </Section>

      <Section heading="Submissions">
        <p>
          You may submit events, jobs, and business information for
          publication. The site&rsquo;s forms prepare an email draft in your
          own email app — nothing is sent to us until you send that email.
          By submitting, you confirm that:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            The information is accurate to the best of your knowledge and
            you own it or have permission to share it, including any names,
            images, and contact details it contains.
          </li>
          <li>
            You grant us a non-exclusive, royalty-free license to publish,
            copy, format, and promote the submission on this site and in
            Leander Live channels, for as long as the listing runs.
          </li>
          <li>
            The submission is not unlawful, deceptive, or infringing; it is
            not spam or a duplicate; and it does not include anyone
            else&rsquo;s private personal information.
          </li>
        </ul>
        <p>
          Publication is never guaranteed. We review submissions and may
          edit them for length and formatting, decline them, or remove a
          published listing at any time, at our discretion — for example if
          details cannot be verified or a listing violates these terms.
        </p>
      </Section>

      <Section heading="Paid placements">
        <p>
          We offer three paid placements at charter rates: Featured Listing
          at $29 per month, Sponsored Event at $19 per event, and Featured
          Job at $59 per 30 days. Paid placements are labeled as featured
          or sponsored on the board.
        </p>
        <p>
          <strong>How buying works today:</strong> there is no online
          checkout, and no payment is collected on this site. Placements
          are arranged by email — send an inquiry through the Advertise
          page, and the placement, dates, and price are confirmed in
          writing by email before any payment is due. Payment is then made
          by the method stated in that written confirmation. A placement
          runs for the agreed period once payment is received. An inquiry
          by itself reserves nothing.
        </p>
        <p>
          We do not offer a lead-delivery service: no customer requests are
          qualified, routed, or sold, and no exclusive categories are
          offered.
        </p>
      </Section>

      <Section heading="Refunds for paid placements">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>We can&rsquo;t run it as agreed:</strong> if a confirmed
            paid placement does not run, or runs materially differently
            from the written confirmation, you receive a full refund for
            the part that did not run as agreed.
          </li>
          <li>
            <strong>You cancel before it starts:</strong> full refund.
          </li>
          <li>
            <strong>You cancel after it starts:</strong> refund of the
            unused portion of the placement period.
          </li>
          <li>
            <strong>Removed for a terms violation:</strong> if a placement
            is removed because the listing was deceptive, unlawful, or
            otherwise in material breach of these terms, amounts for the
            period already run are not refundable.
          </li>
        </ul>
        <p>
          Refunds are issued to the original payment method. To request
          one, email <MailLink /> with the placement details.
        </p>
      </Section>

      <Section heading="Intellectual property; reporting problems">
        <p>
          The site&rsquo;s design, branding, and original content belong to
          us or our licensors. Listing content remains the
          submitter&rsquo;s, licensed to us as described above. Links to
          third-party sites are provided for convenience; we do not control
          or endorse them.
        </p>
        <p>
          To report an inaccurate listing, abusive content, or content you
          believe infringes your copyright, email <MailLink /> with the
          page address and a description of the problem (for copyright:
          the work infringed and where it appears on the board). We review
          reports and remove content where appropriate.
        </p>
      </Section>

      <Section heading="Liability">
        <p>
          To the fullest extent permitted by law, we disclaim warranties of
          accuracy, fitness, and non-infringement for listing content
          provided by third parties and public sources, and our total
          liability arising from this site or a paid placement is limited
          to the greater of the amounts you paid us in the twelve months
          before the claim or $100. You agree to indemnify us against
          claims arising from your submissions or your breach of these
          terms.
        </p>
      </Section>

      <Section heading="Changes; governing law; contact">
        <p>
          We may update these terms; the version posted here, with its
          effective date, governs. These terms are governed by Texas law,
          and any dispute will be brought in the state or federal courts
          located in Williamson County, Texas. Questions about these
          terms: <MailLink />.
        </p>
      </Section>
    </LegalShell>
  );
}

/* ---------------- accessibility statement ---------------- */

export function AccessibilityPage() {
  return (
    <LegalShell title="Accessibility Statement">
      <p>
        Leander Live is a community board for Leander, Texas, operated by
        Newton &amp; Carter LLC. We want everyone in the community —
        including people who use assistive technology — to be able to use
        it, and we treat accessibility as ongoing work, not a one-time
        project.
      </p>

      <Section heading="Standard and assessment">
        <p>
          The site was evaluated against the Web Content Accessibility
          Guidelines (WCAG) 2.2, Level AA, in November 2026, using
          automated checks, keyboard-navigation review, and code review of
          the core pages (home, events, jobs, businesses, and the
          submission and advertising forms). WCAG 2.2 Level AA encompasses
          the WCAG 2.0 criteria referenced by the Revised Section 508
          standards. This statement describes a technical conformance
          assessment against that standard; it is not a legal compliance
          certification.
        </p>
      </Section>

      <Section heading="Measures in place">
        <ul className="list-disc space-y-2 pl-5">
          <li>Semantic landmarks with one main region per page, plus a skip-to-content link.</li>
          <li>Every form field has a visible label; submission dialogs are keyboard-operable.</li>
          <li>Visible focus indicators, and text contrast checked against WCAG AA ratios.</li>
          <li>Images that carry information have text alternatives; decorative images are marked as such.</li>
          <li>Reduced-motion preferences are respected, and content does not depend on color alone.</li>
        </ul>
      </Section>

      <Section heading="Known limitations">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Listing content comes from public sources and community
            submissions. Some third-party event images and descriptions may
            not yet have full text alternatives; we correct these as we
            find them and when they are reported.
          </li>
          <li>
            Pages we link to — city, school, employer, and organizer sites —
            are outside our control and may not meet the same standard.
          </li>
          <li>
            A full manual audit with screen readers across every page is
            still in progress; findings are remediated in priority order —
            barriers that block a core task first.
          </li>
        </ul>
      </Section>

      <Section heading="Feedback and help">
        <p>
          If you hit a barrier on this site, or need a listing in another
          format, email <MailLink /> with the page address and what went
          wrong. We aim to respond within two business days, and
          accessibility reports go to the front of our fix queue.
        </p>
      </Section>
    </LegalShell>
  );
}
