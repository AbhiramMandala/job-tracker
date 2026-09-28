# JobSetu — hackathon submission draft

## One-line pitch

Evidence-powered job intelligence for Indian freshers: relevant matches,
verifiable companies, and skill gaps — one card per job.

## Problem

Freshers drown in stale, duplicated, and unverifiable listings. Job boards
answer "what exists" but never: is this relevant to me, can I trust this
company, what should I learn next.

## Solution

JobSetu ingests live listings and returns decision cards: a deterministic
match score with reasons, a VERIFY section backed by cited search evidence,
recent company news context, and an aggregate skill-gap panel.

## Why this is different

Normal board: search → list. JobSetu: search → deduplicate (exact +
TF-IDF similarity) → extract skills → match deterministically → verify
against independent search evidence → surface news context → aggregate gaps.
Every number is computed from retrieved data; nothing is a black box.

## Why SerpApi is fundamental

- Google Jobs → discovery (the product has no listings without it).
- Google Search → independent company/listing evidence (VERIFY pillar).
- Google News → recent company context (layoffs, funding, expansion).
Remove SerpApi and all three pillars disappear. It is the data backbone,
not a search box.

## Technical architecture

FastAPI + Jinja + SQLite/SQLAlchemy + Pydantic. One `SerpApiClient` owns
all HTTP (15s timeout, one retry on timeout/5xx only, typed errors).
SQLite-backed cache (jobs 24h, evidence/news 7d) with LIVE/CACHED
transparency. Deterministic pipeline: normalization → source-key +
similarity dedup → skill extraction (curated vocabulary) → 50/20/15/10/5
matching → rule-based verification → keyword news categorization.
No LLM, no vector DB, no numeric trust scores — by design.

## Key features

- Live fresher job search (Hyderabad-first, generalizable)
- Exact + similarity deduplication with honest pipeline counts
- Candidate profile with explainable match breakdowns
- VERIFY badges with inspectable evidence trail pages
- News context with recency, categories, and sources
- Skill-gap frequency ("missing in N of M jobs")
- Credit-efficient caching, usage logging, warm demo seeding

## Example user journey

Fresher creates a profile (Python, FastAPI, Django, PostgreSQL, Git) →
searches Python Backend Developer in Hyderabad → opens top card (match +
gap) → checks VERIFY sources → reads news context → applies or learns
the missing skill first.

## Limitations / future work

Closed skill vocabulary; keyword-based experience/news parsing; website
heuristic can misfire on single-token names; small employers may show
"needs verification"; cold searches are sequential (~15 calls max, warm is
instant); Maps/Trends depth, alerts, and LLM explanations are future work.

## Demo instructions

1. `pip install -r requirements.txt && cp .env.example .env` (add SERPAPI_KEY)
2. `python -m app.demo_seed` (warms jobs + evidence + news, prints credits)
3. `python -m uvicorn app.main:app` → open `/`, use the sample profile
4. Follow `docs/demo.md` (90 seconds)
