# JobSetu — submission form draft (copy-paste)

> Fill `[BRACKETS]` before submitting. Keep answers as-is otherwise.

## Project name

JobSetu

## Tagline

Evidence-powered job intelligence for Indian freshers — relevant matches,
verifiable companies, skill gaps, one card per job.

## Track

Knowledge & Public Interest

## Project description

JobSetu turns a fresher job search into decision cards. Search a role + city:
listings are deduplicated (exact + TF-IDF), matched deterministically against
your profile (50/20/15/10/5 with reasons), verified against independent search
evidence with cited sources, enriched with recent company news, and summarized
into a skill-gap panel. Built with FastAPI + SQLite + Jinja; no LLM, no fake
scores.

## Problem

Fresher boards show stale, duplicated, unverifiable listings — never relevance,
trust, or what to learn next.

## Solution

Search → dedup → skill extraction → deterministic match → cited verification →
news context → gap aggregation. One card per job: apply, verify, learn.

## SerpApi usage

Three engines via one `SerpApiClient`: `google_jobs` for discovery
(`q=<role>`, `location=<city>, India`, `gl=in`, `hl=en`, ≤2 pages);
`google` for VERIFY evidence per top-5 job; `google_news` for company context
per top-3 job. Cold ≤15 calls, warm 0 (SQLite cache 24h/7d). All calls logged
at `/debug/usage`. Without SerpApi the product has no data — it says so
instead of faking it.

## Tech stack

Python, FastAPI, SQLAlchemy, SQLite, Pydantic v2, Jinja2, httpx, pytest.

## GitHub URL

https://github.com/AbhiramMandala/jobsetu

## Demo URL

[USER INPUT REQUIRED: video link — public/unlisted, opens in incognito]

## Solo contributor details

Name: Abhiram Mandala
Email: [USER INPUT REQUIRED: email]
Phone: [USER INPUT REQUIRED: phone]
Occupation: [USER INPUT REQUIRED: occupation]
Years of experience: [USER INPUT REQUIRED: years]

## How did you learn about the event?

[USER INPUT REQUIRED: e.g. HydPy / SerpApi website / friend / social media]

## Existing-project disclosure

New project built during the hackathon (first commit 2026-09-28).
[USER CONFIRMATION REQUIRED before submitting.]

## AI-tool disclosure

Includes OpenCode coding assistant (audit, README/docs, submission drafts).
[USER INPUT REQUIRED: any other AI tools + one-line contributions each.]
