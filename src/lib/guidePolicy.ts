export type GuideReview = { reviewStatus: string; checkedAt: string; reviewDueAt: string; endsAt: string };
/** One eligibility rule for the current feed, Event markup and sitemap. */
export function isCurrentGuideEvent(event: GuideReview, now: number): boolean {
  const checked = Date.parse(event.checkedAt);
  const due = Date.parse(event.reviewDueAt);
  const end = Date.parse(event.endsAt);
  return event.reviewStatus === "verified" && Number.isFinite(checked) && checked <= now &&
    Number.isFinite(due) && due > now && due - checked <= 48 * 3600000 &&
    Number.isFinite(end) && end > now;
}
