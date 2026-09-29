# JobSetu

Evidence-powered job intelligence for Indian freshers.

## What it does

JobSetu turns a raw job search into a decision card. Search a role + city →
get deduplicated listings, each with a deterministic match score against your
profile, a VERIFY section backed by cited search evidence, recent company news
context, and an aggregate "what should I learn next?" skill-gap panel.

## Why it exists

Fresher job boards answer "what exists" but never the three questions that
matter: **is this relevant to me, can I trust this company, what am I
missing?** JobSetu answers all three on one card per job — with sources, not
black-box scores.

## Key features

- Live fresher job search (Hyderabad-first, works for any Indian city)
- Exact + TF-IDF similarity deduplication with honest pipeline counts
- Candidate profile with explainable match breakdowns (WHY THIS MATCHES)
- VERIFY badges (Supporting evidence / Needs verification / Warning signals)
  with inspectable per-job evidence pages — every claim cites its source
- News context (layoffs, funding, expansion…) with recency, categories, sources
- Skill-gap frequency ("missing in N of M jobs")
- Credit-efficient SQLite caching with LIVE/CACHED transparency + stale fallback
- Credit visibility: `/debug/usage` logs every SerpApi attempt per engine
- Warm-cache demo seeding: `python -m app.demo_seed`

## How SerpApi is used

SerpApi is the data backbone, not a search box. Remove it and the product has
nothing — no listings, no evidence, no news. All traffic goes through the
single `SerpApiClient` (`app/services/serpapi_client.py`); routes never see
raw SerpApi JSON.

| Pillar | Engine | Query | Use |
|---|---|---|---|
| Discovery | `engine=google_jobs` | `q=<role>`, `location=<city>, India`, `gl=in`, `hl=en`, up to 2 pages via `next_page_token` | Job listings (`jobs_results[]`) |
| VERIFY | `engine=google` | Per top-5 job: `"<company>" "<title>"` and `"<company>" <city>` | Independent company/role/location evidence |
| News context | `engine=google_news` | Per top-3 job: `"<company>" <city>` | Recent headlines with dates/sources |

Credit bounds per search: cold ≤15 calls (2 jobs + ≤10 evidence + ≤3 news),
warm 0 (SQLite cache: jobs 24h, evidence/news 7d). Every attempt is logged to
`api_usage`, viewable at `/debug/usage`. Details: `docs/research.md`
(verified params/responses), `docs/verification.md` (evidence rules).

## Tech stack

Python, FastAPI, SQLAlchemy, SQLite, Pydantic v2, Jinja2, vanilla CSS/JS,
httpx, pytest. No LLM, no vector DB, no frontend framework — by design.

## Architecture

```mermaid
flowchart TD
    Browser --> FastAPI["FastAPI routes\n(thin: parse, call, render)"]
    FastAPI --> Services["Services\nSerpApiClient · JobSearch · Dedup · Matcher · Evidence · News · Cache"]
    Services --> SQLite[("SQLite\njobs · evidence · matches · cache")]
    Services --> SerpApi["SerpApi"]
    SerpApi --> Jobs["Google Jobs\n(discovery)"]
    SerpApi --> Search["Google Search\n(evidence)"]
    SerpApi --> News["Google News\n(context)"]
```

Flow: Browser → FastAPI routes → services → SQLAlchemy → SQLite.
Details: `docs/architecture.md`. Verification rules: `docs/verification.md`.
Matching formula: `docs/matching.md`. Demo tour: `docs/demo.md`.

## Prerequisites

- Python 3.12+ (`python --version`)
- `pip`
- A SerpApi key for live data ([free plan: 250 searches/month](https://serpapi.com/users/sign_up?plan=free&utm_source=india_hackathon_26)).
  Without a key the app still boots and all tests pass, but live search
  returns a friendly "not configured" page instead of fake data.

## Installation

```powershell
git clone https://github.com/AbhiramMandala/jobsetu.git
cd jobsetu
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Then add your key to `.env` (never commit it):

```
SERPAPI_KEY=your-key-here
```

## Environment variables

| Name | Default | Notes |
|---|---|---|
| `SERPAPI_KEY` | empty | Server-side only. Required for live search. |
| `DATABASE_URL` | `sqlite:///./jobsetu.db` | Local SQLite file. |
| `EVIDENCE_MAX_JOBS` | `5` | Top-N jobs enriched per search (credit control). |
| `NEWS_MAX_JOBS` | `3` | Top-N jobs with news context (credit control). |
| `ENABLE_NEWS` | `false` | Reserved P1 flag. |
| `ENABLE_MAPS` | `false` | Reserved P1 flag. |
| `ENABLE_TRENDS` | `false` | Reserved P1 flag. |
| `ENABLE_PDF` | `false` | Reserved P1 flag. |

## Running locally

```powershell
python -m uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000`, create your profile at `/profile`
(or use the labeled sample-data prefill), then fill role + location and
press Find jobs. Match scores appear only when a profile exists.

Warm the demo cache first (recommended for demos — instant, zero calls):

```powershell
python -m app.demo_seed
```

Requires `SERPAPI_KEY`. Runs the demo search end-to-end, creates the sample
profile if none exists, warms jobs + evidence + news caches, and prints
measured request counts and elapsed time.

Check health (secret-free): `GET /health` → `{"status": "ok"}`.

Run tests (SerpApi mocked — no key needed):

```powershell
python -m pytest
```

88 passed.

## Example workflow

1. Create a profile at `/profile`: Python, FastAPI, Django, PostgreSQL, Git.
2. Search `Python Backend Developer` in `Hyderabad` as `Fresher`.
3. Note the pipeline counts ("N listings → M duplicates removed → K unique")
   and the LIVE/CACHED badge.
4. Open the top card: match score + breakdown, matched vs missing skills.
5. Click VIEW EVIDENCE: 2–3 cited Google Search sources with queries and
   retrieval times behind the VERIFY badge.
6. Read NEWS CONTEXT (e.g. funding/expansion with source + date), then the
   "What should I learn next?" panel. Apply or learn the missing skill first.

## Screenshots / demo

Real UI captures (no demo data fabricated; profile shows clearly-labeled
sample data):

- `docs/screenshots/01-landing.png` — search form
- `docs/screenshots/02-profile.png` — profile with labeled sample prefill
- `docs/screenshots/03-usage.png` — dev credit dashboard
- `docs/screenshots/results.png` — search form (landing, live-seeded DB)
- `docs/screenshots/profile.png` — profile page with demo fresher data
- `docs/screenshots/usage-live.png` — live-seeded results page: 19 listings,
  CACHED badge, 63% top MATCH, VERIFY supporting evidence, skill gaps

Evidence-detail and `/debug/usage` captures are optional extras.
Demo script (2:45, video intentionally skipped): `docs/demo.md`.

## Project structure

```
app/
  main.py            # FastAPI entrypoint (create_app)
  config.py          # env-based settings (SERPAPI_KEY never hardcoded)
  database.py        # SQLite engine/session, health check
  demo_seed.py       # python -m app.demo_seed warm-cache command
  data/skills.py     # curated skill vocabulary + extractor
  models/            # SQLAlchemy: jobs, companies, evidence, matches, cache
  schemas/           # Pydantic: JobItem, organic/news result parsers
  services/          # serpapi_client, job_search, deduplicator, matcher,
                     # evidence, news, normalizer, cache
  routes/            # health, pages, search, evidence, profile, debug
  templates/ + static/
tests/               # 88 tests, SerpApi fully mocked
docs/                # architecture, matching, verification, research, demo…
Dockerfile  .dockerignore  requirements.txt  .env.example
```

## API / search flow

`POST /search` (form: `role`, `location`, `experience`):
1. Validate input (empty → friendly 400 on the form, no traceback).
2. Cache lookup (SQLite, 24h). Hit → render CACHED with age, 0 SerpApi calls.
3. Miss → `SerpApiClient.google_jobs` (≤2 pages) → normalize → source-key
   upsert → TF-IDF fuzzy dedup → skill extraction → deterministic match
   refresh → commit pipeline counts.
4. VERIFY: `EvidenceService` re-searches each top company via
   `engine=google`, stores cited rows, classifies
   supporting / needs_verification / warning (no numeric trust scores).
5. NEWS: `NewsService` fetches `engine=google_news` per top-3 job;
   failures are isolated — search never breaks.
6. Failure anywhere → stale cache with warning banner; no stale cache →
   friendly 503. Never fake data.

## Credit visibility

`/debug/usage` (dev-only, no auth) shows real per-engine call counts,
cache entries, and stored rows. The API key is never displayed.

## Deployment

```powershell
# Environment (never commit .env)
SERPAPI_KEY=<key>            # required for live data
DATABASE_URL=sqlite:////data/jobsetu.db
EVIDENCE_MAX_JOBS=5
NEWS_MAX_JOBS=3
PORT=8000
```

Docker (SQLite persisted on a volume):

```powershell
docker build -t jobsetu .
docker run -p 8000:8000 -e SERPAPI_KEY=<key> -v jobsetu-data:/data jobsetu
```

Or any Python host (Render/Railway/HF Spaces): install requirements,
set env vars, serve `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
Health: `GET /health` (no secrets). Then warm the demo:
`python -m app.demo_seed`.

Status: Dockerfile + `.dockerignore` ready; image build and platform deploy
not yet executed (no Docker daemon/credentials in this environment).

## Matching

Deterministic and explainable: Skills 50 + Title 20 + Experience 15 +
Location 10 + Type 5 = 100. Same candidate + same job always gives the same
score. Missing data yields neutral sub-scores with explicit flags, never
fake precision. Full formula, weights, and limitations: `docs/matching.md`.

## Verification

Each search enriches the top-`EVIDENCE_MAX_JOBS` listings with live Google
Search evidence (cached 7 days): official-site detection, company/role
presence, location support. Statuses are Supporting evidence, Needs
verification, or Warning signals — no numeric trust scores, and every claim
links to its source on `GET /jobs/{id}/evidence`. Rules and limitations:
`docs/verification.md`.

## Limitations

- Closed skill vocabulary (curated list; misses niche/brand-new skills).
- Keyword-based experience/news parsing (can misread unusual phrasing).
- Website heuristic can misfire on single-token company names.
- Small employers with little web presence may show "needs verification"
  (wording guards against overreach; never claims scam/fake/safe).
- Cold searches are sequential (~15 calls max); warm is instant.
- Plain server-rendered visuals; no maps/trends depth, alerts, or LLM
  explanations.

## Future improvements

- Maps/Trends depth behind the existing `ENABLE_*` flags.
- Search alerts for new matching listings.
- Larger/industry-specific skill vocabularies.
- LLM-generated match explanations (deterministic scores stay as-is).

## Hackathon information

- Event: SerpApi India Hackathon 2026 — "Build with Live Search Data"
  (Sep 1–Oct 10, 2026; deadline Oct 10, 2026 23:59 IST).
- Track: **Knowledge & Public Interest** — official track keywords explicitly
  include jobs, news, research, and education; JobSetu is a jobs + news-literacy
  tool for Indian freshers.
- Entry: solo contributor (Abhiram Mandala).
- Submission docs: `HACKATHON_SUBMISSION.md` (full package),
  `SUBMISSION_FORM_DRAFT.md` (copy-paste form answers), `docs/demo.md` (2:45 demo).
- Disclosures: project built during the hackathon window (see git history);
  AI assistance used (see `HACKATHON_SUBMISSION.md` — edit before submitting).

## Status

Slices 1–10 complete, final QA done (88/88 green). **STOP CODING** — no new
features. Live seed succeeded 2026-09-29 (19 real jobs, VERIFY 5/5 supporting,
news 2/3 with 1 honest unavailable). Remaining work is deployment,
screenshots/video, and submission — not features.
