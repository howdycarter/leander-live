import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageCircle, X, Send, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "../site/analytics";

/* ------------------------------------------------------------------ */
/* On-site chat widget (shadcn): converses, qualifies intent, captures */
/* leads via the `api.chat.chatReply` Convex action (OpenAI).          */
/* ------------------------------------------------------------------ */

type Role = "user" | "assistant";
interface Msg {
  role: Role;
  content: string;
}

function getSessionId(): string {
  const key = "leander-live-chat-session";
  let id = localStorage.getItem(key);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

const GREETING: Msg = {
  role: "assistant",
  content:
    "Howdy! Looking for event reminders, a trusted local pro, or are you a local business? I can help with any of those.",
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const chatReply = useAction(api.chat.chatReply);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(getSessionId());

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const result = await chatReply({ messages: next.slice(-20), sessionId: sessionId.current });
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
      if (result.leadSaved) {
        setDone(true);
        trackEvent("chat_lead_captured");
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Something hiccuped on my end — mind trying again? Or use the forms below and we'll take it from there.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 md:bottom-6 md:right-6">
      {open && (
        <Card className="absolute bottom-16 right-0 flex h-[480px] max-h-[calc(100vh-220px)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden shadow-xl">
          <CardHeader className="flex flex-row items-center gap-3 bg-primary p-4 text-primary-foreground">
            <Avatar className="h-8 w-8 rounded-md">
              <AvatarImage src="/brand/logo-mark.png" alt="Leander Live" />
              <AvatarFallback className="rounded-md bg-white/20 text-xs font-bold text-primary-foreground">
                LL
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 leading-tight">
              <CardTitle className="text-base text-primary-foreground">Leander Live</CardTitle>
              <p className="text-xs text-primary-foreground/80">Typically replies instantly</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent ref={scrollRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "self-end rounded-br-sm bg-primary text-primary-foreground"
                    : "self-start rounded-bl-sm bg-muted text-foreground",
                )}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="self-start rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm tracking-widest">
                …
              </div>
            )}
          </CardContent>
          <div className="border-t p-3">
            {done ? (
              <Alert className="border-secondary/30 bg-secondary/10">
                <CircleCheck className="h-4 w-4 text-secondary" />
                <AlertDescription className="font-semibold text-secondary">
                  You're all set — we'll be in touch! 🎉
                </AlertDescription>
              </Alert>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message…"
                  aria-label="Chat message"
                  maxLength={500}
                />
                <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}
            <p className="pt-2 text-center text-[11px] text-muted-foreground">
              Chats may be reviewed to improve the service. We'll only text you if you ask us to.
            </p>
          </div>
        </Card>
      )}
      <Button
        size="icon"
        onClick={() => {
          setOpen((v) => {
            if (!v) trackEvent("chat_opened");
            return !v;
          });
        }}
        aria-label={open ? "Close chat" : "Chat with Leander Live"}
        className="h-14 w-14 rounded-full shadow-lg"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>
    </div>
  );
}
