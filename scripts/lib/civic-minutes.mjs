/**
 * Map minutes URLs from already-fetched CivicClerk / BoardBook records.
 * No HTTP. Callers that scrape still own fetch; this only reads fields they
 * already have.
 */

export const CIVICCLERK_API = "https://leandertx.api.civicclerk.com/v1";

export function civicClerkFileStreamUrl(apiBase, fileId) {
  if (fileId == null || fileId === "") return undefined;
  const base = String(apiBase).replace(/\/$/, "");
  return `${base}/Meetings/GetMeetingFileStream(fileId=${fileId})`;
}

/** CivicClerk events expose minutes as minutesFile (same shape as agendaFile). */
export function minutesUrlFromCivicClerkEvent(apiBase, event) {
  const file = event && typeof event === "object" ? event.minutesFile : null;
  const fileId =
    file && typeof file === "object"
      ? file.agendaId ?? file.fileId ?? file.id
      : null;
  return civicClerkFileStreamUrl(apiBase, fileId);
}

/** BoardBook minutes links already present in previously fetched markdown. */
export function boardbookMinutesUrl(markdownSlice) {
  const m = String(markdownSlice ?? "").match(
    /https:\/\/meetings\.boardbook\.org\/Public\/Minutes\/[^\s"'<>]+/i,
  );
  return m ? m[0] : undefined;
}
