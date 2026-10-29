import type { LiveEvent } from "../data/types";
import { icsAllDayDates } from "./eventTime";

/** Format an epoch-ms timestamp as an ICS UTC datetime (YYYYMMDDTHHMMSSZ). */
function icsDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Build an .ics calendar file for a single event and trigger a download. */
export function downloadEventIcs(event: LiveEvent): void {
  const uid = `${event.id}@leanderlive.com`;
  const stamp = icsDate(Date.now());
  const start = icsDate(event.startsAt);
  const end = icsDate(event.endsAt ?? event.startsAt + 2 * 60 * 60 * 1000);
  const allDay = icsAllDayDates(event);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Leander Live//Events//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    ...(allDay
      ? [`DTSTART;VALUE=DATE:${allDay.start}`, `DTEND;VALUE=DATE:${allDay.endExclusive}`]
      : [`DTSTART:${start}`, `DTEND:${end}`]),
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description)}`,
    `LOCATION:${escapeIcs([event.venue, event.address].filter(Boolean).join(", "))}`,
  ];
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push("END:VEVENT", "END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${event.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}
