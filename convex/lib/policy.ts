/** Pure policy helpers shared by mutations and their tests. */
export function requireAdmin(provided: string | undefined) {
  const expected = process.env.ADMIN_KEY;
  if (!expected || !provided || provided !== expected) throw new Error("Not authorized.");
}

export function safeSourceUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Use a public HTTPS source link.");
  }
  return url.toString();
}

export function assertReviewedEvent(event: {
  startsAt: number; endsAt?: number; venue: string; url?: string;
  checkedAt?: number; detailsIncomplete?: boolean;
}, now: number) {
  if (event.detailsIncomplete || !Number.isFinite(event.startsAt) ||
      !event.endsAt || !Number.isFinite(event.endsAt) || event.endsAt <= event.startsAt ||
      event.endsAt <= now || !event.venue.trim() || !safeSourceUrl(event.url) ||
      !event.checkedAt || event.checkedAt > now || now - event.checkedAt > 48 * 60 * 60 * 1000) {
    throw new Error("Review the source, venue, start/end time and freshness before publication.");
  }
}

export function normalizeContact(email?: string, phone?: string) {
  const cleanEmail = email?.trim().toLowerCase() || undefined;
  const cleanPhone = phone?.trim() || undefined;
  if (!cleanEmail && !cleanPhone) throw new Error("Please provide an email address or phone number.");
  if (cleanEmail && (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) {
    throw new Error("Please enter a valid email address.");
  }
  if (cleanPhone && (cleanPhone.length > 40 || cleanPhone.replace(/\D/g, "").length < 10)) {
    throw new Error("Please enter a valid phone number.");
  }
  return { email: cleanEmail, phone: cleanPhone };
}
