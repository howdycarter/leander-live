import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trackEvent } from "./analytics";
import {
  COPY,
  MAX_QUERY_LENGTH,
  type ChatMessage,
  type ChatMode,
  type DirectoryListing,
  type PublicMatch,
} from "@/lib/directoryChat";
import { askDirectory } from "@/lib/directoryChatClient";

const SUGGESTIONS = [
  "Coffee in 78641",
  "Who is opening soon?",
  "Tacos",
  "Haircuts and nails",
  "Auto repair",
] as const;

type ThreadItem =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string; matches: PublicMatch[]; notice?: string; mode: ChatMode };

function noticeFor(mode: ChatMode, notice?: string): string | undefined {
  switch (mode) {
    case "llm":
    case "fallback":
    case "refused":
    case "rate_limited":
    case "too_long":
      return notice;
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

export function BusinessChat({
  listings,
  onSelectBusiness,
}: {
  listings: DirectoryListing[];
  onSelectBusiness: (id: string) => void;
}) {
  const headingId = "directory-chat-heading";
  const liveId = "directory-chat-live";
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [pending, setPending] = useState(false);
  const [liveText, setLiveText] = useState(
    "Ask about a Leander business. Answers come from the permit directory.",
  );

  async function submitQuery(text: string) {
    const query = text.trim();
    if (!query || pending) return;
    const userItem: ThreadItem = {
      id: `user-${thread.length}-${query.slice(0, 24)}`,
      kind: "user",
      text: query,
    };
    const nextThread = [...thread, userItem];
    setThread(nextThread);
    setDraft("");
    setPending(true);
    setLiveText("Looking in the Leander directory…");

    const history: ChatMessage[] = nextThread.map((item) =>
      item.kind === "user"
        ? { role: "user" as const, content: item.text }
        : { role: "assistant" as const, content: item.text },
    );
    const result = await askDirectory({ listings, messages: history });
    const notice = noticeFor(result.mode, result.notice);
    setThread([
      ...nextThread,
      {
        id: `assistant-${nextThread.length}`,
        kind: "assistant",
        text: result.reply,
        matches: result.matches,
        notice,
        mode: result.mode,
      },
    ]);
    setLiveText(notice ? `${result.reply} ${notice}` : result.reply);
    setPending(false);
    try {
      trackEvent("directory_chat", { mode: result.mode });
    } catch {
      /* analytics must never break the site */
    }
    inputRef.current?.focus();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submitQuery(draft);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submitQuery(draft);
  }

  const remaining = MAX_QUERY_LENGTH - draft.length;
  const tooLong = draft.length > MAX_QUERY_LENGTH;

  return (
    <section
      aria-labelledby={headingId}
      className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(22,50,79,0.07)] sm:p-5"
    >
      <h2 id={headingId} className="font-display text-xl font-extrabold text-navy">
        Ask the directory
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Type a question in plain language. Answers name real Leander businesses
        from Texas sales-tax permit records — name, category, address, ZIP, and
        permit dates only, never hours or phone numbers.
      </p>

      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        id={liveId}
      >
        {liveText}
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={pending}
            onClick={() => void submitQuery(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>

      {thread.length > 0 && (
        <ol className="mt-4 space-y-3" aria-label="Directory conversation">
          {thread.map((item) => {
            if (item.kind === "user") {
              return (
                <li key={item.id} className="flex justify-end">
                  <p className="max-w-[min(40rem,100%)] rounded-2xl bg-navy px-3.5 py-2 text-sm text-white">
                    <span className="sr-only">You asked: </span>
                    {item.text}
                  </p>
                </li>
              );
            }
            return (
              <li key={item.id}>
                <div className="max-w-[min(44rem,100%)] rounded-2xl bg-muted px-3.5 py-2 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  <span className="sr-only">Directory answer: </span>
                  {item.text}
                </div>
                {item.notice && (
                  <p className="mt-1 text-xs text-muted-foreground" role="note">
                    {item.notice}
                  </p>
                )}
                {item.matches.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {item.matches.map((match) => (
                      <li key={match.id}>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto w-full justify-start whitespace-normal rounded-xl px-3 py-2 text-left font-normal"
                          onClick={() => onSelectBusiness(match.id)}
                        >
                          <span className="block">
                            <span className="font-semibold text-navy">{match.name}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {match.category} · {match.address}, {match.zip}
                            </span>
                          </span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {pending && (
        <p className="mt-3 text-sm font-semibold text-foreground/70" aria-hidden="true">
          Looking in the Leander directory…
        </p>
      )}

      <form className="mt-4" onSubmit={onSubmit} aria-describedby={liveId}>
        <Textarea
          ref={inputRef}
          id="directory-chat-input"
          label="Ask about a Leander business"
          description="Texas permit records only — no hours or phone numbers. Enter sends; Shift+Enter adds a line."
          error={tooLong ? COPY.tooLong : undefined}
          value={draft}
          maxLength={MAX_QUERY_LENGTH}
          rows={3}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onComposerKeyDown}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="submit" className="rounded-full" disabled={pending || draft.trim() === "" || tooLong}>
            Ask
          </Button>
          <p className="text-xs text-muted-foreground">
            {remaining} characters left. About 20 questions per hour.
          </p>
        </div>
      </form>
    </section>
  );
}
