# BUDGET_SETUP.md — OpenAI $200 budget (Chris approved)

All OpenAI usage in Leander Live is locked to the cheap tier. No full-size chat
models, no reasoning models, no full-size realtime models — anywhere.

## Model choices

| Path | Model | Notes |
|---|---|---|
| Chat widget + lead extraction | `gpt-4o-mini` (default; `CHAT_MODEL` env swaps within cheap tier) | `max_tokens: 300`, tight system prompt |
| Event "why go" blurbs | `gpt-4o-mini` | `max_tokens: 60` |
| Phone voice agent | `gpt-realtime-2.1-mini` class (`VOICE_MODEL` env) | mini realtime tier only |
| Call transcription | `gpt-4o-mini-transcribe` | via Realtime session |

## Guardrails in code

- **Phone: hard 8-minute cap** — polite wrap-up at ~7:30, session terminated at
  8:00 (`voice-bridge/server.mjs`).
- **Chat: per-request caps** — history truncated to last 20 messages (2,000 chars
  each), `max_tokens: 300` on every completion.
- **Chat: per-session rate limit** — 20 requests / 10 min per browser session
  (`convex/chat.ts` → `chatSessions` table).
- **Visibility** — approximate token usage (chars/4) logged per chat session in
  the `chatSessions` table: `promptTokens`, `completionTokens`, `leadsCaptured`.

## Exact dashboard steps for Chris

1. Go to https://platform.openai.com/settings/organization/limits (or
   **Settings → Limits** in the left nav).
2. **Set a hard spending limit: $200.** Under "Usage limits" → set the monthly
   budget cap to $200 so the API stops rather than overruns.
3. **Add a $50 usage alert:** in the same Limits/Notifications area, create an
   email alert at $50 spend so there's early warning.
4. **Create the API key:** https://platform.openai.com/api-keys → "Create new
   secret key". Name it `leander-live`. Copy it once.
5. **Key permissions:** default permissions are fine — the app only calls
   `chat/completions` and the Realtime API. No admin scopes needed. (If your
   org uses granular scopes, allow *model capabilities: chat + realtime*.)
6. Save it to the deployment — never commit it:
   `npx convex env set OPENAI_API_KEY <key>`

## Other costs

- **Twilio:** ~$1–2/mo for a local 512 number + per-minute voice charges. The
  8-minute cap bounds the worst case per call.
- **Firecrawl:** free — every hackathon participant gets 20,000 credits.
- **Convex:** free tier covers this workload; no paid team needed.
- **AgentMail:** plan-dependent; the inbox webhook path is key-gated until
  configured.
