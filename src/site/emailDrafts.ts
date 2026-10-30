/** Email drafts only: these helpers neither submit nor persist visitor details. */
export interface EmailDraft {
  subject: string;
  body: string;
}

export function centralDateTimeInput(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function eventEmailDraft(input: {
  title: string; description: string; venue: string; category: string; url: string; when: string;
}): EmailDraft {
  return {
    subject: `Event submission: ${input.title.trim()}`,
    body: [
      `Event: ${input.title.trim()}`,
      // Preserve the wall time the visitor entered, not the browser's timezone.
      `When: ${input.when.replace("T", " ")} (Leander / America/Chicago — Central time)`,
      `Venue: ${input.venue.trim()}`,
      input.category ? `Category: ${input.category}` : null,
      input.url.trim() ? `Link: ${input.url.trim()}` : null,
      "", "Description:", input.description.trim(), "",
      "Submitted for review; publication is not guaranteed.",
      "Please confirm that you own or have permission to share this information when sending.",
    ].filter((line) => line !== null).join("\n"),
  };
}

export function jobEmailDraft(input: {
  title: string; company: string; location: string; type: string;
  payRange: string; applyUrl: string; description: string;
}): EmailDraft {
  return {
    subject: `Job posting: ${input.title.trim()} at ${input.company.trim()}`,
    body: [
      `Job title: ${input.title.trim()}`, `Company: ${input.company.trim()}`,
      `Location: ${input.location.trim()}`, `Type: ${input.type}`,
      input.payRange.trim() ? `Pay range: ${input.payRange.trim()}` : null,
      `Apply link: ${input.applyUrl.trim()}`, "", "Description:", input.description.trim(), "",
      "Submitted for review; publication is not guaranteed.",
      "Please confirm that you own or have permission to share this information when sending.",
    ].filter((line) => line !== null).join("\n"),
  };
}

export function hasRequiredDraftFields(values: readonly string[]): boolean {
  return values.every((value) => value.trim().length > 0);
}

export interface BusinessDraftFields {
  businessName: string; contactName: string; email: string; phone: string;
  vertical: string; interests: readonly string[]; packageName?: string;
}

/** A draft is current only while every field and its selected package still match. */
export function businessDraftKey(input: BusinessDraftFields): string {
  return JSON.stringify([
    input.businessName, input.contactName, input.email, input.phone,
    input.vertical, input.interests, input.packageName ?? null,
  ]);
}

export function businessEmailDraft(input: BusinessDraftFields): EmailDraft {
  return {
    subject: `Advertiser inquiry: ${input.businessName.trim()}${input.packageName ? ` (${input.packageName})` : ""}`,
    body: [
      `Business: ${input.businessName.trim()}`,
      `Contact: ${input.contactName.trim()}`,
      input.email.trim() ? `Email: ${input.email.trim()}` : null,
      input.phone.trim() ? `Phone: ${input.phone.trim()}` : null,
      input.vertical ? `Vertical: ${input.vertical}` : null,
      input.interests.length ? `Interested in: ${input.interests.join(", ")}` : null,
      input.packageName ? `Package inquiry: ${input.packageName}` : null,
      "", "Inquiry only. Rates and placements are proposals, subject to confirmation.",
      "No payment, reservation, or publication is made by preparing this email.",
      "Service leads are not available.",
    ].filter((line) => line !== null).join("\n"),
  };
}

export function emailDraftText(draft: EmailDraft, recipient: string): string {
  return `To: ${recipient}\nSubject: ${draft.subject}\n\n${draft.body}`;
}

/** Coordinate clipboard writes across forms, including a form that just unmounted. */
export function createDraftCopyManager(lock = { pending: false }) {
  return {
    createSession() {
      let generation = 0;
      return {
        invalidate() { generation += 1; },
        async copy(
          text: string,
          writeText: (text: string) => Promise<void>,
          publish: (message: string) => void,
        ): Promise<void> {
          // Clipboard writes cannot be cancelled. Never overlap a newer write with
          // an older pending write that could otherwise overwrite its contents.
          if (lock.pending) {
            publish("A copy is still finishing. Try again, or copy the draft below manually.");
            return;
          }
          const request = ++generation;
          lock.pending = true;
          publish("");
          try {
            await writeText(text);
            if (request === generation) publish("Copied — not sent. Paste it into your email app.");
          } catch {
            if (request === generation) publish("Copy unavailable. Select and copy the draft below manually.");
          } finally {
            lock.pending = false;
          }
        },
      };
    },
  };
}
