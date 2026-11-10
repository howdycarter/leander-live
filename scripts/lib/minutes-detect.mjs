/**
 * Detect newly posted minutes / agenda URL changes on already-stored civic
 * records (CHR-1874). Operates on JSON snapshots — it does not fetch CivicClerk
 * or BoardBook.
 */

export const DECISION_BODY_RE =
  /City Council|Planning & Zoning|Leander ISD Board|ISD Board of Trustees/i;

export function isDecisionBody(body) {
  return DECISION_BODY_RE.test(String(body ?? ""));
}

export function snapshotCivic(meetings) {
  return (Array.isArray(meetings) ? meetings : []).map((m) => ({
    id: m.id,
    body: m.body ?? "",
    title: m.title ?? "",
    startsAt: m.startsAt ?? null,
    agendaUrl: m.agendaUrl || null,
    minutesUrl: m.minutesUrl || null,
    sourceUrl: m.sourceUrl || null,
  }));
}

function normUrl(value) {
  const s = typeof value === "string" ? value.trim() : "";
  return s || null;
}

/**
 * Compare previous vs current civic snapshots.
 * firstRun (no previous records) records the baseline and emits nothing.
 */
export function detectMinutesSignals(prev, next, now = Date.now()) {
  const current = snapshotCivic(next);
  const previous = snapshotCivic(prev);
  if (previous.length === 0) {
    return { signals: [], baseline: true, snapshots: current };
  }
  const prevById = new Map(previous.map((m) => [m.id, m]));
  const signals = [];

  for (const meeting of current) {
    if (!isDecisionBody(meeting.body)) continue;
    const before = prevById.get(meeting.id);
    const minutesNow = normUrl(meeting.minutesUrl);
    const minutesBefore = before ? normUrl(before.minutesUrl) : null;
    const agendaNow = normUrl(meeting.agendaUrl);
    const agendaBefore = before ? normUrl(before.agendaUrl) : null;

    if (minutesNow && minutesNow !== minutesBefore) {
      signals.push({
        id: `summary-draft-${meeting.id}`,
        kind: "summary-draft",
        priority: "medium",
        title: `Minutes posted — ${meeting.body}: ${meeting.title}`,
        detail:
          "Minutes URL appeared or changed. Queue a plain-English summary draft; do not publish unattended.",
        url: minutesNow,
        agendaUrl: agendaNow,
        minutesUrl: minutesNow,
        meetingId: meeting.id,
        body: meeting.body,
        source: "data-diff-civic-minutes",
        firstSeenAt: now,
        autoPublish: false,
      });
    } else if (before && agendaNow && agendaNow !== agendaBefore) {
      signals.push({
        id: `agenda-updated-${meeting.id}`,
        kind: "agenda-updated",
        priority: "low",
        title: `Agenda updated — ${meeting.body}: ${meeting.title}`,
        detail: "Agenda URL changed on a watched body. Not a publish trigger.",
        url: agendaNow,
        agendaUrl: agendaNow,
        minutesUrl: minutesNow,
        meetingId: meeting.id,
        body: meeting.body,
        source: "data-diff-civic-agenda",
        firstSeenAt: now,
        autoPublish: false,
      });
    }
  }

  return { signals, baseline: false, snapshots: current };
}
