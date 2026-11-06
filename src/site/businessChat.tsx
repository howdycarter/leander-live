import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircleQuestion, RotateCcw, SendHorizontal } from "lucide-react";
import type { Business } from "../data/types";
import {
  composeAnswer,
  runMatch,
  type ChatContext,
} from "../lib/businessMatch";
import { BusinessRow } from "./businesses";
import { cn } from "@/lib/utils";

/**
 * Chat-style search over the business directory (CHR-2355).
 *
 * The visitor asks in plain language; answers come from the /business-chat
 * endpoint on the Convex deployment, which retrieves rows from the real
 * businesses dataset server-side (rate-limited, cached, optionally phrased
 * by a small LLM under a daily cap — see convex/businessChat.ts). If the
 * endpoint is unreachable, the SAME deterministic matcher runs locally over
 * the page's dataset, so the chat never invents a business either way.
 */

const CHAT_ENDPOINT =
  "https://adventurous-ostrich-311.convex.site/business-chat";
const MAX_QUESTION_LENGTH = 300;
const REQUEST_TIMEOUT_MS = 15000;

const SUGGESTIONS = [
  "Somewhere for dinner",
  "A plumber or repair service",
  "Where can I get coffee?",
  "Food trucks near me",
  "New businesses in town",
  "A salon for a haircut",
];

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  businesses?: Business[];
  mode?: "ai" | "directory";
  notice?: string | null;
}

interface ChatResponse {
  answer: string;
  businesses: Array<{ id: string }>;
  total: number;
  mode: "ai" | "directory";
  llmNotice: string | null;
  context: ChatContext;
}

const GREETING: ChatMessage = {
  id: 0,
  role: "assistant",
  text:
    "Ask me about Leander businesses — a kind of place (\"somewhere for dinner\"), " +
    "a service (\"a plumber\"), or a business name. I answer only from the directory's " +
    "Texas permit records, so I don't have hours or phone numbers — each listing links " +
    "to a map so you can confirm details with the business.",
  mode: "directory",
};

function getSessionId(): string {
  try {
    const key = "ll-bizchat-session";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "ephemeral-session";
  }
}

export function BusinessChat({
  businesses,
  onSelect,
}: {
  businesses: Business[];
  onSelect: (b: Business) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const businessesRef = useRef(businesses);
  businessesRef.current = businesses;
  const contextRef = useRef<ChatContext | undefined>(undefined);
  const sessionRef = useRef<string>("");
  const nextId = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionRef.current = getSessionId();
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, busy]);

  function push(msg: Omit<ChatMessage, "id">) {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { ...msg, id }]);
  }

  function resolveCards(ids: Array<{ id: string }>): Business[] {
    const byId = new Map(businessesRef.current.map((b) => [b.id, b]));
    return ids
      .map((r) => byId.get(r.id))
      .filter((b): b is Business => b !== undefined);
  }

  /** Deterministic local answer over the page's own dataset — the same
      matcher the server runs, so it can only name records on this page. */
  function localAnswer(question: string, notice: string) {
    const outcome = runMatch(
      businessesRef.current,
      question,
      contextRef.current,
    );
    contextRef.current = outcome.context;
    push({
      role: "assistant",
      text: composeAnswer(outcome),
      businesses: outcome.shown,
      mode: "directory",
      notice,
    });
  }

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || busy) return;
    push({ role: "user", text: question });
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          sessionId: sessionRef.current || undefined,
          context: contextRef.current,
        }),
        signal: ctrl.signal,
      });
      if (res.status === 429) {
        // Rate-limited server-side (the endpoint's abuse controls working).
        // Answer locally from the page's dataset instead of dead-ending —
        // this costs the server nothing and stays grounded in the same data.
        localAnswer(
          question,
          "Live answers are rate-limited right now (about 20 questions an hour), so this one was matched from the directory data on this page.",
        );
        return;
      }
      if (!res.ok) throw new Error(`chat endpoint ${res.status}`);
      const data = (await res.json()) as ChatResponse;
      contextRef.current = data.context;
      push({
        role: "assistant",
        text: data.answer,
        businesses: resolveCards(data.businesses ?? []),
        mode: data.mode,
        notice: data.llmNotice,
      });
    } catch {
      // Endpoint unreachable: same deterministic matcher, locally.
      localAnswer(
        question,
        "The live answer service didn't respond, so this answer was matched from the directory data on this page.",
      );
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  function reset() {
    contextRef.current = undefined;
    setMessages([GREETING]);
  }

  return (
    <section
      aria-labelledby="bizchat-heading"
      className="mb-8 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(22,50,79,0.07)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-navy px-4 py-3 sm:px-5">
        <h2
          id="bizchat-heading"
          className="flex items-center gap-2 text-body font-extrabold text-white"
        >
          <MessageCircleQuestion className="h-5 w-5 shrink-0" aria-hidden="true" />
          Ask the directory
        </h2>
        {messages.length > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={reset}
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Start over
          </Button>
        )}
      </div>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Directory chat conversation"
        aria-busy={busy}
        className="max-h-[32rem] space-y-4 overflow-y-auto px-4 py-4 sm:px-5"
      >
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-body text-white">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="flex flex-col items-start gap-2">
              <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                <p className="text-body leading-relaxed text-foreground">
                  {m.text}
                </p>
                {m.notice && (
                  <p className="mt-1.5 text-small font-semibold text-foreground/70">
                    {m.notice}
                  </p>
                )}
                <p className="mt-1.5 text-small text-muted-foreground">
                  {m.mode === "ai"
                    ? "Phrased with AI help — every fact from the directory."
                    : "Answered from the directory data."}
                </p>
              </div>
              {m.businesses && m.businesses.length > 0 && (
                <div className="grid w-full gap-2 sm:grid-cols-2">
                  {m.businesses.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-2xl border border-border bg-card"
                    >
                      <BusinessRow
                        business={b}
                        onSelect={() => onSelect(b)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {busy && (
          <p className="text-small font-semibold text-muted-foreground" role="status">
            Checking the directory…
          </p>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3 sm:px-5">
          {SUGGESTIONS.map((s) => (
            <Button
              key={s}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full font-semibold"
              onClick={() => void ask(s)}
              disabled={busy}
            >
              {s}
            </Button>
          ))}
        </div>
      )}

      <form
        className="border-t border-border px-4 py-3 sm:px-5"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <label htmlFor="bizchat-input" className="sr-only">
          Ask about Leander businesses
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="bizchat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for a business… e.g. “who does catering?”"
            maxLength={MAX_QUESTION_LENGTH}
            className={cn("rounded-full bg-white")}
            aria-describedby="bizchat-hint"
            autoComplete="off"
          />
          <Button
            type="submit"
            className="shrink-0 rounded-full"
            disabled={busy || !input.trim()}
            aria-label="Send question"
          >
            <SendHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only sm:ml-1">Ask</span>
          </Button>
        </div>
        <p id="bizchat-hint" className="mt-2 text-small text-muted-foreground">
          Answers name only real listings from the Leander directory (Texas
          permit records) — no hours, phone numbers, or ratings are listed.
          Follow-ups work too: try “what about ones in 78641?” or “show me more”.
        </p>
      </form>
    </section>
  );
}
