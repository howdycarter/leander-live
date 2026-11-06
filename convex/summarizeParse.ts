/**
 * OpenAI "why go" blurb helpers (CHR-1475).
 *
 * requestBlurb never runs against api.openai.com from tests: callers inject
 * fetchImpl. The Convex action still no-ops when OPENAI_API_KEY is unset.
 */

export const BLURB_MODEL = "gpt-4o-mini";
export const BLURB_MAX_CHARS = 280;
export const BLURB_SYSTEM =
  "You write one-sentence event blurbs for a local events board. Under 140 characters, warm and specific to a Leander, Texas local. No hashtags, no emojis.";

export interface BlurbEvent {
  title: string;
  description: string;
  venue: string;
}

export function blurbUserPrompt(event: BlurbEvent): string {
  return `In one sentence, tell a local why they should go: "${event.title}" — ${event.description} at ${event.venue}.`;
}

export function chatCompletionsBody(event: BlurbEvent) {
  return {
    model: BLURB_MODEL,
    messages: [
      { role: "system", content: BLURB_SYSTEM },
      { role: "user", content: blurbUserPrompt(event) },
    ],
    max_tokens: 80,
    temperature: 0.7,
  };
}

export function clampBlurb(text: string, max = BLURB_MAX_CHARS): string {
  return text.trim().slice(0, max);
}

export function parseCompletion(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const content = (choices[0] as { message?: { content?: unknown } })?.message
    ?.content;
  if (typeof content !== "string") return null;
  const blurb = clampBlurb(content);
  return blurb.length > 0 ? blurb : null;
}

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export async function requestBlurb(
  apiKey: string,
  event: BlurbEvent,
  fetchImpl: FetchLike,
): Promise<{ ok: true; blurb: string } | { ok: false; reason: string }> {
  const res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(chatCompletionsBody(event)),
  });
  if (!res.ok) {
    await res.text();
    return { ok: false, reason: `openai ${res.status}` };
  }
  const data = await res.json();
  const blurb = parseCompletion(data);
  if (!blurb) return { ok: false, reason: "empty completion" };
  return { ok: true, blurb };
}
