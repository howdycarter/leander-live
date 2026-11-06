export type DecisionSummaryStatus = "draft" | "reviewed" | "published";

export interface DecisionSummary {
  id: string;
  meetingId: string;
  body: string;
  title: string;
  status: DecisionSummaryStatus;
  bullets: string[];
  agendaUrl?: string | null;
  minutesUrl?: string | null;
  sourceUrl?: string | null;
  createdAt: number;
  reviewedAt?: number | null;
  publishedAt?: number | null;
  note?: string | null;
}

export function publishedSummaries(
  summaries: readonly DecisionSummary[],
): DecisionSummary[] {
  return summaries.filter((summary) => {
    switch (summary.status) {
      case "published":
        return true;
      case "draft":
      case "reviewed":
        return false;
      default: {
        const _never: never = summary.status;
        throw new Error(`Unknown summary status: ${_never}`);
      }
    }
  });
}
