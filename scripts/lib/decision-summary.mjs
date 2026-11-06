/**
 * Reviewed-only decision summaries (CHR-1874).
 *
 * Minutes detection queues a draft. A human writes five plain-English bullets
 * and marks the draft reviewed. publishSummary refuses to run without that
 * reviewed step — never auto-published unattended.
 */

export const SUMMARY_STATUSES = ["draft", "reviewed", "published"];

export function isSummaryStatus(value) {
  return SUMMARY_STATUSES.includes(value);
}

function assertStatus(status) {
  switch (status) {
    case "draft":
    case "reviewed":
    case "published":
      return;
    default: {
      const _never = status;
      throw new Error(`Unknown summary status: ${_never}`);
    }
  }
}

export function draftFromMinutesSignal(signal, now = Date.now()) {
  if (!signal || signal.kind !== "summary-draft") {
    throw new Error("Only summary-draft signals become decision drafts.");
  }
  return {
    id: `decision-${signal.meetingId}`,
    meetingId: signal.meetingId,
    body: signal.body,
    title: signal.title,
    status: "draft",
    bullets: [],
    agendaUrl: signal.agendaUrl || null,
    minutesUrl: signal.minutesUrl || signal.url || null,
    sourceUrl: signal.url || null,
    createdAt: now,
    reviewedAt: null,
    publishedAt: null,
    note: "Minutes posting detected. A reviewer writes five plain-English bullets before this can be published.",
  };
}

export function reviewSummary(draft, bullets, now = Date.now()) {
  if (!draft || draft.status === "published") {
    throw new Error("Cannot review a missing or already-published summary.");
  }
  const cleaned = (Array.isArray(bullets) ? bullets : [])
    .map((b) => (typeof b === "string" ? b.trim() : ""))
    .filter(Boolean)
    .slice(0, 5);
  if (cleaned.length !== 5) {
    throw new Error("Reviewed summaries need exactly five plain-English bullets.");
  }
  return {
    ...draft,
    status: "reviewed",
    bullets: cleaned,
    reviewedAt: now,
    note: "Reviewed. Not published until an explicit publish step.",
  };
}

export function publishSummary(draft, { reviewer } = {}, now = Date.now()) {
  if (!reviewer) {
    throw new Error("Publishing requires an explicit reviewer — never unattended.");
  }
  if (!draft || draft.status !== "reviewed") {
    throw new Error("Only reviewed summaries can be published.");
  }
  if (!Array.isArray(draft.bullets) || draft.bullets.length !== 5) {
    throw new Error("Published summaries need exactly five bullets.");
  }
  return {
    ...draft,
    status: "published",
    publishedAt: now,
    note: null,
  };
}

export function publishedOnly(summaries) {
  return (Array.isArray(summaries) ? summaries : []).filter((s) => {
    assertStatus(s.status);
    return s.status === "published";
  });
}

/** Merge a new draft into the store without touching published rows or auto-promoting. */
export function upsertDraft(store, draft) {
  const list = Array.isArray(store) ? store.slice() : [];
  const idx = list.findIndex((s) => s.id === draft.id);
  if (idx === -1) {
    list.push(draft);
    return list;
  }
  if (list[idx].status === "published" || list[idx].status === "reviewed") {
    return list;
  }
  list[idx] = draft;
  return list;
}
