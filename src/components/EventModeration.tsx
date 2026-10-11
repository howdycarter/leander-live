import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { parseLeanderTime, toLocalInputValue, formatDate } from "../lib/eventTime";

function ReviewEvent({ event, adminKey }: { event: Doc<"events">; adminKey: string }) {
  const review = useMutation(api.events.review);
  const setStatus = useMutation(api.events.setStatus);
  const [start, setStart] = useState(event.startsAt ? toLocalInputValue(new Date(event.startsAt)) : "");
  const [end, setEnd] = useState(event.endsAt ? toLocalInputValue(new Date(event.endsAt)) : "");
  const [venue, setVenue] = useState(event.venue);
  const [url, setUrl] = useState(event.url ?? "");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const field = `event-${event._id}-`;
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setMessage("");
    try {
      await review({adminKey, id:event._id, startsAt:parseLeanderTime(start), endsAt:parseLeanderTime(end), venue, url, sourceChecked:checked});
      setMessage("Source review saved and event approved."); setChecked(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Review could not be saved."); }
    finally { setBusy(false); }
  }
  async function cancel() {
    if (busy) return; setBusy(true);
    try { await setStatus({adminKey,id:event._id,status:"cancelled"}); setMessage("Event removed from the public feed."); }
    catch { setMessage("Status could not be saved. Try again."); }
    finally { setBusy(false); }
  }
  return <article className="rounded-xl border p-5">
    <h3 className="font-bold">{event.title} <span className="text-sm font-normal">({event.status})</span></h3>
    <p className="mt-2 text-sm">{event.description}</p>
    <p className="mt-2 text-sm">Last source check: {event.checkedAt ? formatDate(event.checkedAt) : "not reviewed"}</p>
    <form onSubmit={submit} className="mt-4 grid gap-3">
      <label htmlFor={field+"source"}>Original event source (HTTPS)</label><input className="rounded border p-2" id={field+"source"} type="url" required value={url} onChange={e=>setUrl(e.target.value)} />
      {event.url?.startsWith("https://") && <a className="underline" href={event.url} target="_blank" rel="noreferrer">Open submitted source in another tab</a>}
      <label htmlFor={field+"venue"}>Verified venue</label><input className="rounded border p-2" id={field+"venue"} required maxLength={160} value={venue} onChange={e=>setVenue(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2"><label>Starts (Central)<input className="mt-1 block w-full rounded border p-2" type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)} /></label><label>Ends (Central)<input className="mt-1 block w-full rounded border p-2" type="datetime-local" required value={end} onChange={e=>setEnd(e.target.value)} /></label></div>
      <label className="flex items-start gap-2"><input className="mt-1" type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} required /><span>I checked the original event page and confirmed its title, description, dates, venue, and cancellation status.</span></label>
      <div className="flex flex-wrap gap-3"><button className="rounded bg-primary px-4 py-2 text-primary-foreground" disabled={busy || !checked}>Save verified event</button><button className="rounded border px-4 py-2" type="button" disabled={busy} onClick={cancel}>Mark cancelled</button></div>
      <p role="status">{message}</p>
    </form>
  </article>;
}

export function EventModeration({ adminKey }: { adminKey: string }) {
  const events = useQuery(api.events.listForReview, {adminKey});
  return <section className="grid gap-5" aria-labelledby="moderation-title"><h2 id="moderation-title" className="text-2xl font-bold">Source review queue</h2><p>Only source-checked events appear in the public feed. Checks expire after 48 hours. AI blurbs remain drafts and are not published automatically.</p>{events ? events.map(event=><ReviewEvent key={event._id} event={event} adminKey={adminKey} />) : <p>Loading review queue…</p>}</section>;
}
