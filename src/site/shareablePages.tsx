import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Share2 } from "lucide-react";
import { ALL_EVENTS } from "./content";
import { ALL_BUSINESSES } from "./businesses";
import { PageHero } from "./conceptA";
import { createEventShareManager, eventShareUrl } from "./eventShare";
import { clipboardWriteLock } from "./clipboardWrites";
import { newNearYou, weekendRoundup } from "./shareables";

const sharing = createEventShareManager(clipboardWriteLock);

function CopyBlock({
  label,
  text,
  sharePath,
}: {
  label: string;
  text: string;
  sharePath: string;
}) {
  const [status, setStatus] = useState("");
  const [session] = useState(() => sharing.createSession());

  async function copyText() {
    await session.copy(
      text,
      navigator.clipboard?.writeText?.bind(navigator.clipboard),
      (state) => {
        setStatus(
          state === "copied"
            ? "Text copied. Nothing was posted from this page."
            : state === "unavailable" || state === "failed"
              ? "Copy unavailable. Select the text below and copy it manually."
              : "",
        );
      },
    );
  }

  async function copyLink() {
    const url = eventShareUrl(window.location.origin, sharePath);
    await session.copy(
      url,
      navigator.clipboard?.writeText?.bind(navigator.clipboard),
      (state) => {
        setStatus(
          state === "copied"
            ? "Link copied. Nothing was sent from this page."
            : state === "unavailable" || state === "failed"
              ? "Copy unavailable. Select the text below and copy it manually."
              : "",
        );
      },
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copyText}>
          <Share2 className="h-4 w-4" /> Copy text card
        </Button>
        <Button type="button" variant="outline" onClick={copyLink}>
          Copy link
        </Button>
      </div>
      {status ? (
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor={label}>{label}</Label>
        <Textarea id={label} readOnly rows={8} value={text} />
      </div>
    </div>
  );
}

export function WeekendRoundupPage() {
  const card = useMemo(() => weekendRoundup(ALL_EVENTS, Date.now()), []);
  return (
    <>
      <PageHero
        eyebrow="Shareable"
        title={card.title}
        subtitle="A text-first weekend card from the events feed. Copy it to share — this page never posts."
      />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card>
            <CardContent className="space-y-4 p-6">
              <img
                src={card.image}
                alt=""
                className="aspect-[16/9] w-full rounded-xl object-cover"
              />
              {card.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing posted for this weekend yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {card.events.map((event) => (
                    <li key={event.id}>
                      <Link
                        to={event.href}
                        className="font-semibold text-navy hover:text-primary"
                      >
                        {event.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {event.when} · {event.venue}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="link" className="h-auto px-0">
                <Link to="/events">
                  All events <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <CopyBlock
                label="Weekend card text"
                text={card.text}
                sharePath={card.sharePath}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

export function NewNearYouPage() {
  const digest = useMemo(() => newNearYou(ALL_BUSINESSES, Date.now()), []);
  return (
    <>
      <PageHero
        eyebrow="Shareable"
        title="New on your street"
        subtitle="Recent Texas sales-tax permits in Leander ZIPs. A permit is not a confirmed grand opening — confirm with the business."
      />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card>
            <CardContent className="space-y-4 p-6">
              {digest.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No new storefront permits in Leander ZIPs in the last two weeks.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {digest.items.map((item) => (
                    <li key={item.id}>
                      <p className="font-semibold text-navy">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.category} · {item.address} {item.zip}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="link" className="h-auto px-0">
                <Link to="/businesses">
                  Business directory <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <CopyBlock
                label="New-near-you text"
                text={digest.text}
                sharePath={digest.sharePath}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
