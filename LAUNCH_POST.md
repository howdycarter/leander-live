# LAUNCH_POST.md — DRAFT ONLY. Do NOT post without Chris's exact approval.

Nothing here is approved. Every platform below needs Chris's explicit go-ahead
on the exact copy, exact asset, exact account, and exact time before anything
is published. (Standing rule: X is read-only unless Chris approves the exact
mutation; no replies/quote-posts without approval.)

---

## X (@howdycarter) — draft

🚂 All Aboard Leander.

I built Leander Live — a real-time community events board for my town:
live event feed, one-tap reminders, local business leads, and an AI chat +
phone bot that actually captures leads into Convex.

Built for the @ConvexDev All Gas Hackathon. Live demo: <URL>

#BuildInPublic

[Attach: 30s screen recording of the event feed + chat widget]

## LinkedIn — draft

I live in one of America's fastest-growing cities — Leander, TX (59k → 91k
since 2020) — and its event scene deserved better than scattered Facebook posts.

So I built Leander Live for the Convex "All Gas" Hackathon:

- Real-time event feed on Convex (approved + upcoming, soonest first)
- Firecrawl ingestion pulls city/chamber listings weekly
- Email-to-board: organizers email events in via AgentMail
- OpenAI: one-line "why go" blurbs, an on-site chat bot, and a Twilio voice
  agent that qualifies callers and saves leads
- Two-sided lead capture: resident reminders + a mini-CRM pipeline that routes
  leads to local businesses by vertical

Live: <URL> | Code: github.com/howdycarter/leander-live

## Demo video (<3 min) — shot list

1. (0:00) Hero + live event feed, filter by category/date
2. (0:30) Submit an event → shows as pending
3. (0:50) Get reminders form → success
4. (1:10) Chat widget: qualify + capture a lead conversationally
5. (1:40) #admin/leads: move a lead through the pipeline, assign to a business
6. (2:10) Phone bot: call the number, get qualified (record the agent audio)
7. (2:40) Architecture slide: Convex + Firecrawl + AgentMail + OpenAI + Twilio
