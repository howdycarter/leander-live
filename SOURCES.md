# SOURCES.md — where every Leander claim comes from

Judges and locals should find zero invented facts. Every Leander-specific claim
in the app traces to the research pack at
`~/workspace/research_notes/leander-texas-history-20260919-0632/report.md`
(researched 2026-09-19), or to the City's own site where noted.

## About page (`src/App.tsx` → About)

| Claim | Source |
|---|---|
| Pronounced "lee-AN-der" | report §6 (Wikipedia; barrypopik.com) |
| Founded 1882; Austin and Northwestern Railroad | report §1 (Wikipedia "Leander, Texas") |
| Named for railroad official Leander "Catfish" Brown | report §1 (TX Historical Commission marker Atlas #5491009259; Wikipedia; Texasescapes; theclio) |
| Grew from Bagdad (1854), bypassed by the rail line | report §1 (THC marker) |
| Incorporated 1978 | report §1 (Wikipedia; exact date Jan 21, 1978) |
| Locals call themselves "Leanderthals" | report §6 (Wikipedia; barrypopik.com, in print since 1998–99) |
| Leanderthal Lady: 10,000–13,000-year-old skeleton, discovered 1982, among North America's oldest intact burials | report §1/§3 (Wikipedia "Leanderthal Lady"; leanderhistory.com) |
| 59,202 people (2020) → ~91,132 (Census estimate, July 1, 2025) | report §4 (U.S. Census Bureau QuickFacts) |
| Fastest-growing U.S. city 2018–2019 | report §1/§4 (Census Bureau) |
| Planning for 250,000 | report §4 (texashometalk.com: infrastructure planned for 250,000) |
| Old Town Street Festival, first Saturday of June | report §5 (events table) |
| Liberty Fest, July 3, Devine Lake Park | report §5 |
| Floating Pumpkin Patch | report §5 |
| ArtFest | report §5 |
| Devine Lake Kite Festival | report §5 |
| Old Town Christmas Festival | report §5 |

## Seed events (`convex/seed.ts`)

All eight anchor events and their venues (Lakewood Park Sculpture Trail, Robin
Bledsoe Park, Devine Lake Park, Veterans Park, Historic Old Town Leander) come
from the report §5 events table and §3 parks list. Outbound links point only to
the city's tourism site (visitleandertx.com) and the city site (leandertx.gov),
both cited in report §6.

## Chat bot (`convex/chat.ts`)

Makes no independent factual claims about the town: it only mentions upcoming
events returned live from the Convex database, and says "I don't know" rather
than inventing. The voice agent (`voice-bridge/server.mjs`) likewise makes no
town-fact claims.

## Colors

Sampled 2026-09-19 from the **official City of Leander header logo** —
https://www.leandertx.gov/ImageRepository/Document?documentID=71 (alt text
"Leander Texas home page"). Dominant sampled colors: hill green `#47704c`,
river blue `#215ba3`, star gold `#deae49`, olive `#7d8f45`, sky blue `#4982c1`,
deep navy `#022d82`. These are the app's shadcn tokens — **not** the orange/
cream/terracotta palette from the ChatGPT mockups (that was ChatGPT's invention,
discarded).

> Brand-status note: the city is mid brand-definition (CivicBrand hired Sept
> 2025; council identity workshop July 7, 2026 — see
> https://www.leandertx.gov/1003/Branding-Leander). These colors reflect the
> current official art and may change when the new identity lands. The Leander
> Live logo itself (`design/logo.png`) is original app art, not city art.

## Motto / nickname

The research found **no official city motto or nickname** (report: "Could not
verify"). Nothing in the app presents one. **"All Aboard Leander." is the
Leander Live app's tagline** (from the report §7 tagline ideas, grounded in the
1882 railroad founding) — it is presented as the app's invitation, never as the
city's motto.
