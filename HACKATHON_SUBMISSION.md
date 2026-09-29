# SerpApi India Hackathon 2026 Submission — JobSetu

## Project

JobSetu — evidence-powered job intelligence for Indian freshers.

## Repository

https://github.com/AbhiramMandala/jobsetu

## Track

**Knowledge & Public Interest** (official track keywords: education, research,
**jobs**, news literacy, accessibility, civic information, patents).
JobSetu is a jobs + news-literacy tool: live listings, cited company evidence,
and categorized news context for fresher decisions.

Why not the others (verified against official track definitions):
- AI Agents — JobSetu has no planning/acting agent loop (deterministic pipeline).
- Open-Source Integrations — not a plugin/provider/connector for another platform.
- Travel & Local Discovery — no flights/hotels/maps itineraries.
- Commerce & Market Intelligence — not shopping/pricing/finance tooling.
- Open Innovation — wildcard fallback only; K&PI names jobs explicitly, so it fits better.

## One-line description

Relevant matches, verifiable companies, and skill gaps for Indian freshers —
one evidence-backed card per job.

## Project description

JobSetu ingests live job listings and returns decision cards: a deterministic
match score with reasons, a VERIFY section backed by cited search evidence,
recent company news context, and an aggregate skill-gap panel. Freshers drown
in stale, duplicated, unverifiable listings; job boards answer "what exists"
but never relevance, trust, or what to learn next. JobSetu answers all three
with sources, not black-box scores.

## Problem

Freshers face stale, duplicated, unverifiable listings. Boards show jobs but
never: is this relevant to me, can I trust this company, what should I learn
next.

## Solution

Search → deduplicate (exact + TF-IDF similarity) → extract skills → match
deterministically (50/20/15/10/5) → verify against independent search evidence
→ surface news context → aggregate gaps. Every number is computed from
retrieved data.

## How SerpApi is used

SerpApi is the data backbone — remove it and the product has zero listings.
Single `SerpApiClient` (`app/services/serpapi_client.py`); routes never see
raw SerpApi JSON:
- `engine=google_jobs` — discovery: `q=<role>`, `location=<city>, India`,
  `gl=in`, `hl=en`, ≤2 pages via `next_page_token`.
- `engine=google` — VERIFY evidence per top-5 job: `"<company>" "<title>"`,
  `"<company>" <city>`.
- `engine=google_news` — NEWS CONTEXT per top-3 job: `"<company>" <city>`.
Cold ≤15 calls/search; warm 0 (SQLite cache: jobs 24h, evidence/news 7d).
Every attempt logged to `api_usage`, visible at `/debug/usage`.

## Key features

- Live fresher job search with exact + similarity dedup and pipeline counts
- Explainable match breakdowns + skill-gap frequency panel
- VERIFY badges with inspectable cited evidence pages (no trust scores)
- News context with recency, categories, sources
- Credit-efficient caching with LIVE/CACHED transparency + stale fallback
- Warm-cache demo seeding (`python -m app.demo_seed`) + usage dashboard

## Tech stack

Python, FastAPI, SQLAlchemy, SQLite, Pydantic v2, Jinja2, vanilla CSS/JS,
httpx, pytest. No LLM, no vector DB.

## Demo video

Skipped intentionally by user — no URL.
NOTE: if the submission form mandates a video URL, this is a manual blocker
for the author (record per `docs/demo.md` or accept form validation limits).

## Solo contributor

Abhiram Mandala (sole contributor — author-confirmed; no teammates).

## Participant information

Name: Abhiram Mandala
Email: abhirammandala02@gmail.com
Phone: [USER INPUT REQUIRED: phone]
Occupation: [USER INPUT REQUIRED: occupation]
Years of experience: [USER INPUT REQUIRED: years]

## Existing project disclosure

Existing project before the hackathon: **No.**

JobSetu was started during the SerpApi India Hackathon 2026 period
(author-confirmed). The repository's first Git commit was on September 28,
2026 (hackathon runs Sep 1–Oct 10, 2026), `docs/research.md` records an empty
workspace at project start, and no JobSetu code existed anywhere before
September 2026.

## AI tools used

AI tools used: OpenCode for software-development assistance and ChatGPT for
writing/documentation assistance.

- OpenCode coding assistant — repository audit, README/docs drafting,
  submission documents and checklists (submission-prep sessions).
- ChatGPT — writing and documentation assistance during development.

AI use does not affect judging (Rules §5); listed here for the disclosure
requirement.

## Repository

https://github.com/AbhiramMandala/jobsetu
(setup instructions in README; test links in a private window before submitting)

## Demo

Skipped intentionally by user — no URL (see Demo video above).

## Final notes

- No secrets in the repo (`.env` + `*.db` git-ignored; key is env-only).
- Tests: 88 passed, SerpApi mocked (no key needed for `pytest`; if a real key
  sits in `.env`, run with `$env:SERPAPI_KEY='NO_KEY_FOR_TESTS'` so the suite
  stays hermetic).
- Honest limits: deploy + video pending (video intentionally skipped); live
  seed done 2026-09-29 (19 jobs, 5/5 supporting, news 2/3) with results
  screenshot in `docs/screenshots/usage-live.png`. Never claims scam/safe;
  never fabricates data.
