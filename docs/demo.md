# JobSetu — 90-second judge demo

Warm the environment first: `python -m app.demo_seed` (needs SERPAPI_KEY),
then serve and demo warm (instant, zero SerpApi calls).

## 0–15 sec — Problem

"Fresher job boards give listings but never answer three questions:
is this relevant to me, what should I verify, and what am I missing?
JobSetu turns a raw listing into that decision."

## 15–35 sec — Search

Role `Python Backend Developer`, `Hyderabad`, `Fresher` → Find jobs.
Point at the pipeline counts: [FILL AFTER SEED: e.g. "N listings found,
M duplicates removed, K unique jobs"]. Note the LIVE/CACHED badge.

## 35–55 sec — Match + gap

Open the top card. Read the score and its breakdown:
[FILL AFTER SEED: e.g. "78% MATCH — skills 33/50, title 20/20 …"].
Show matched skills vs the gap (Docker · Redis). Stress: deterministic,
same profile + same job always gives the same number; click WHY THIS MATCHES.

## 55–75 sec — Verify

Point at the VERIFY badge, click VIEW EVIDENCE. Show 2–3 real Google
Search sources with queries and retrieval times. Say: "SerpApi doesn't
just find the job — it independently searches for evidence about the
company behind it. No trust scores, everything cited."

## 75–90 sec — News + close

Scroll to NEWS CONTEXT (e.g. a funding or expansion item with source and
date), then the "What should I learn next?" panel. Close: "Apply, verify,
learn — one card per job."

## Rules for the presenter

- Never claim scam/fake/safe; say "supporting evidence" / "needs verification".
- Never quote numbers not on screen. All counts above are filled after seeding.
- If live calls fail mid-demo, point at the CACHED badges and stale banners:
  the product degrades openly, never with fake data.
