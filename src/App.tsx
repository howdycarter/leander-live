import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function formatDate(ms: number) {
  return new Date(ms).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const sourceLabel: Record<string, string> = {
  community: "Community",
  crawl: "City feed",
  email: "Email",
};

export default function App() {
  const events = useQuery(api.events.listUpcoming, { limit: 50 });
  const submit = useMutation(api.events.submit);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [url, setUrl] = useState("");
  const [when, setWhen] = useState(() => toLocalInputValue(new Date(Date.now() + 7 * 86400000)));
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    setSending(true);
    try {
      await submit({
        title,
        description,
        venue,
        url: url.trim() || undefined,
        startsAt: new Date(when).getTime(),
      });
      setSent(true);
      setTitle("");
      setDescription("");
      setVenue("");
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        {/* Original mark for Leander Live — not the City of Leander logo.
            The city is mid-rebrand (new identity in progress as of 2026), so
            this is an original train-town-inspired badge, not official art. */}
        <svg
          viewBox="0 0 64 64"
          width="64"
          height="64"
          aria-label="Leander Live mark"
          role="img"
          className="mark"
        >
          <circle cx="32" cy="32" r="30" fill="#123524" />
          <circle cx="32" cy="32" r="30" fill="none" stroke="#e8b64c" strokeWidth="2" />
          <circle cx="32" cy="15" r="5" fill="#e8b64c" />
          <path d="M25 52 L30.5 24 M39 52 L33.5 24" stroke="#e8b64c" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M26.5 46 H37.5 M27.8 40 H36.2 M29 34 H35 M30 28.5 H34" stroke="#e8b64c" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <h1>Leander Live</h1>
        <p className="tagline">All Aboard Leander.</p>
        <p className="muted">What's happening in Leander, TX — updated in real time.</p>
        <button className="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "Submit an event"}
        </button>
      </header>

      {showForm && (
        <section className="card form-card">
          <h2>Submit an event</h2>
          <p className="muted">
            Community submissions are reviewed before they appear. Organizers can
            also email events to our inbox (see README).
          </p>
          <form onSubmit={handleSubmit}>
            <label>
              Event name
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
                placeholder="Friday Night Market"
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
                placeholder="What should people expect?"
              />
            </label>
            <div className="row">
              <label>
                Date & time
                <input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  required
                />
              </label>
              <label>
                Venue
                <input
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  maxLength={160}
                  required
                  placeholder="Robin Bledsoe Park"
                />
              </label>
            </div>
            <label>
              Link (optional)
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
            {error && <p className="error">{error}</p>}
            {sent && (
              <p className="success">
                Got it — your event was submitted and is pending review.
              </p>
            )}
            <button className="primary" type="submit" disabled={sending}>
              {sending ? "Submitting…" : "Submit event"}
            </button>
          </form>
        </section>
      )}

      <main className="feed">
        {events === undefined && <p className="muted">Loading events…</p>}
        {events && events.length === 0 && (
          <div className="card">
            <h2>No upcoming events yet</h2>
            <p className="muted">
              Be the first — submit an event above and it will appear here once
              approved.
            </p>
          </div>
        )}
        {events?.map((event) => (
          <article className="card event" key={event._id}>
            <div className="event-top">
              <span className="when">{formatDate(event.startsAt)}</span>
              <span className="source">{sourceLabel[event.source] ?? event.source}</span>
            </div>
            <h2>{event.title}</h2>
            {event.blurb && <p className="blurb">✨ {event.blurb}</p>}
            <p>{event.description}</p>
            <div className="event-meta">
              <span>📍 {event.venue}</span>
              {event.url && (
                <a href={event.url} target="_blank" rel="noreferrer">
                  Details →
                </a>
              )}
            </div>
          </article>
        ))}
      </main>

      <section className="card about">
        <h2>About Leander</h2>
        <p>
          <strong>Lee-AN-der</strong>, Texas was founded in{" "}
          <strong>1882</strong> when the Austin and Northwestern Railroad built
          through — named for railroad official Leander "Catfish" Brown. The
          town grew from the older settlement of Bagdad (1854), bypassed by the
          rail line, and incorporated in 1978.
        </p>
        <p>
          Locals call themselves <strong>"Leanderthals"</strong> — a nod to the
          Leanderthal Lady, a 10,000-year-old skeleton discovered here in 1982
          and one of North America's oldest intact burials.
        </p>
        <p>
          From <strong>59,202</strong> people in 2020 to an estimated{" "}
          <strong>~91,132</strong> in 2025 — the fastest-growing city in America
          in 2018–2019, now planning for 250,000 — Leander keeps its Old Town
          soul while the new town booms around it.
        </p>
        <p className="muted">
          Anchor traditions: Old Town Street Festival (first Saturday of June),
          Liberty Fest (July 3 at Devine Lake Park), the Floating Pumpkin Patch,
          ArtFest, the Devine Lake Kite Festival, and the Old Town Christmas
          Festival.
        </p>
      </section>

      <footer className="footer">
        <p>
          <strong>10,000 years in the making.</strong>
        </p>
        <p className="muted">
          Old Town soul, new town energy. Built for the Convex All Gas Hackathon.
        </p>
      </footer>
    </div>
  );
}
