# JobSetu — demo video script (2:45 max)

Setup (before recording): `python -m app.demo_seed` (needs `SERPAPI_KEY`),
then `python -m uvicorn app.main:app`. Demo warm: instant, zero SerpApi calls,
all badges show CACHED. Record the screen running locally; narration optional;
may be sped up. Numbers below marked [FILL] must be read off the real screen —
never invent them.

## 0:00–0:15 — Problem + intro

- SCREEN: Landing page (`/`).
- ACTION: Show the search form (role + location + hero steps).
- SAY: "Fresher job boards give listings but never answer three questions:
  is this relevant to me, can I trust this company, and what am I missing?
  JobSetu turns a raw listing into that decision."
- WHY: States the insight (judging: idea strength) in 15 seconds.

## 0:15–0:35 — What it does

- SCREEN: Scroll landing → profile snippet → `/debug/usage`.
- ACTION: Point at the pipeline (search → dedup → match → verify → news →
  skill gap) and the credit dashboard.
- SAY: "One search returns decision cards: a deterministic match score, cited
  verification evidence, recent company news, and the skills you're missing.
  Every SerpApi call is logged and visible."
- WHY: Previews the whole value prop before the live run.

## 0:35–1:30 — Live product demo

- SCREEN: `/` → results page.
- ACTION:
  1. Enter Role `Python Backend Developer`, `Hyderabad`, `Fresher` → Find jobs.
  2. Point at pipeline counts: [FILL e.g. "N listings found, M duplicates
     removed, K unique jobs"] + the LIVE/CACHED badge.
  3. Open the top card: score + breakdown
     [FILL e.g. "78% MATCH — skills 33/50, title 20/20 …"], matched skills vs
     gap; click WHY THIS MATCHES.
  4. Scroll to the "What should I learn next?" panel.
- SAY: "Same profile plus same job always gives the same number — no black
  box. And the gap panel aggregates what's missing across all K jobs."
- WHY: Proves the core workflow end-to-end (judging: usefulness, complexity).

## 1:30–2:00 — SerpApi / live-data integration

- SCREEN: Results → VIEW EVIDENCE (`/jobs/{id}/evidence`) → `/debug/usage`.
- ACTION:
  1. Point at the VERIFY badge, open VIEW EVIDENCE: show 2–3 real Google
     Search sources with queries + retrieval times.
  2. Open `/debug/usage`: point at per-engine rows
     (`google_jobs`, `google`, `google_news`) with real counts.
- SAY: "SerpApi doesn't just find the job — it independently searches for
  evidence about the company behind it. Discovery is Google Jobs; verification
  is Google Search; context is Google News. Without SerpApi this page is
  empty — and without a key the app says so instead of faking data."
- WHY: Proves meaningful SerpApi usage — the highest-weighted criterion.

## 2:00–2:25 — Result processing

- SCREEN: Results card → evidence page → news section.
- ACTION:
  1. Deduplication: point at "M duplicates removed".
  2. VERIFY: read one reason line aloud
     (e.g. "Official website found", "Hyderabad presence supported").
  3. NEWS CONTEXT: show one item with source + date + category label.
- SAY: "Dedup is exact source-keys plus TF-IDF similarity; verification is
  deterministic rules over cited sources — no trust scores, no scam claims;
  news is keyword-categorized context with dates. Everything links to its
  source."
- WHY: Shows engineering depth honestly (judging: technical complexity).

## 2:25–2:45 — Architecture + close

- SCREEN: README architecture diagram (or a single slide) → back to top card.
- ACTION: Show the 6-box flow (Browser → FastAPI → Services → SQLite +
  SerpApi → 3 engines), then close on the card.
- SAY: "One SerpApi client, SQLite caches, deterministic pipeline. Apply,
  verify, learn — one card per job. Built for the SerpApi India Hackathon,
  Knowledge and Public Interest track."
- WHY: Closes with stack clarity + track justification in 20 seconds.

## Presenter rules

- Never claim scam/fake/safe; say "supporting evidence" / "needs verification".
- Never quote numbers not on screen. All counts above are filled after seeding.
- If live calls fail mid-demo, point at the CACHED badges and stale banners:
  the product degrades openly, never with fake data.
- Keep it under 2:45: if long, speed up the search-wait section, never cut
  the evidence + usage screens.
