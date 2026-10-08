# JobSetu — Architecture (MVP, approved 2026-09-28)

Stack: FastAPI + Jinja + minimal CSS/JS, SQLAlchemy + SQLite, Pydantic v2.
P0: Google Jobs + Google Search only. News/Maps/Trends behind flags, off by default.
No Postgres, no React/Streamlit/SPA, no vector DB, no LLM ranking.

## 1. System architecture

```
Browser (Jinja HTML + tiny JS)
  ↓ HTTP (forms + fetch for evidence tabs)
FastAPI (routes only: parse input, call services, render template)
  ↓
Services (pure Python, no request objects)
  ├── SerpApiClient (only module that talks to SerpApi)
  ├── JobSearchService (orchestrates search → cache → client → normalize → dedup → store)
  ├── JobNormalizer
  ├── JobDeduplicator (`services/deduplicator.py`: TF-IDF similarity + apply_merge)
  ├── SkillExtractor (`app/data/skills.py`: closed vocabulary, deterministic)
  ├── CandidateMatcher (`services/matcher.py`: 50/20/15/10/5 rule-based scoring)
  ├── SkillGapAnalyzer (inside matcher.refresh_matches: frequency aggregate)
  ├── EvidenceService (`services/evidence.py`: Google Search enrichment +
  │   deterministic classification; Slice 4)
  ├── NewsService (`services/news.py`: Google News context + rule categories)
  └── CacheService (SQLite-backed: jobs 24h, evidence/news 7d)
  ↓
SQLAlchemy models
  ↓
SQLite (single file `jobsetu.db`)
```

Rules:
- Routes never touch raw SerpApi JSON. They receive Pydantic models.
- Services never import FastAPI. Testable standalone.
- One service = one file under `app/services/`. No base classes, no interfaces.

## 2. Request / data flow

Search flow (P0):
```
GET / → search form (prefilled: Python Backend Developer / Hyderabad / Fresher)
POST /search {role, location, experience} →
  JobSearchService.run():
    1. canonicalize query (lowercase, trim, map "Fresher"→fresher filter client-side)
    2. CacheService.get(engine=google_jobs, params) → fresh? return jobs
    3. else SerpApiClient.google_jobs(q, location, gl=in, hl=en, pages=2)
    4. log api_usage row per HTTP call
    5. JobNormalizer.normalize each raw job → NormalizedJob
    6. JobDeduplicator.cluster → canonical jobs + dup counts
    7. upsert companies/jobs/job_skills/searches
    8. EvidenceService.enrich (Google Search, top EVIDENCE_MAX_JOBS by match score, cached)
    9. CandidateMatcher.score_all(active candidate) → matches/skill_gaps
    10. render results.html with LIVE/CACHED badge
```

Detail flow: `GET /jobs/{id}` loads job + matches + evidences from DB, no SerpApi call.

## 3. Service boundaries

| Service | Input | Output | Notes |
|---|---|---|---|
| SerpApiClient | engine, params | Pydantic `SerpApiResult` (raw payload + meta) | key, timeout, retry, logging |
| JobNormalizer | raw dict | `NormalizedJob` | pure functions, skill extraction via curated lexicon |
| JobDeduplicator | `NormalizedJob[]` | clusters + canonical pick | TF-IDF cosine, threshold |
| CandidateMatcher | candidate, jobs | `MatchResult` with sub-scores | deterministic |
| SkillGapAnalyzer | candidate skills, job skills | missing list + frequency across result set | counts from real result set |
| EvidenceService | company/job | `Evidence[]` | Search-backed, each row cites URL |
| CacheService | engine+params hash | cached payload or miss | SQLite table `cache_entries` |

## 4. Database schema

Conventions: integer PK `id`, UTC `created_at`, all text normalized columns stored alongside raw.

**searches** — one user search.
- `id INTEGER PK`, `role TEXT NOT NULL`, `location TEXT NOT NULL`, `experience TEXT NOT NULL`
- `query_hash TEXT NOT NULL UNIQUE`, `raw_count INT`, `canonical_count INT`, `dup_removed INT`
- `is_live BOOLEAN`, `retrieved_at DATETIME`, `created_at DATETIME`
- Index: `query_hash`. Relationship: 1→N jobs via `jobs.search_id` (nullable, last search that found it).

**companies** — deduped by normalized name.
- `id INTEGER PK`, `name_raw TEXT`, `name_norm TEXT NOT NULL UNIQUE`
- `created_at DATETIME`
- Index: `name_norm`.

**jobs** — canonical jobs only (duplicates collapsed).
- `id INTEGER PK`, `search_id INT FK→searches NULL`
- `company_id INT FK→companies NOT NULL`
- `title_raw TEXT`, `title_norm TEXT`, `location_raw TEXT`, `location_norm TEXT`
- `via TEXT` (e.g. Indeed), `apply_link TEXT`, `description TEXT`
- `posted_text TEXT` (e.g. "4 days ago"), `salary_text TEXT`
- `source_key TEXT NOT NULL UNIQUE` (composite hash, see §6), ` serpapi_job_id TEXT`
- `first_seen DATETIME`, `last_seen DATETIME`, `is_active BOOLEAN DEFAULT 1`
- `dup_count INT DEFAULT 0`
- Indexes: `source_key UNIQUE`, `(company_id, title_norm)`, `last_seen`.
- Relationships: 1→N `job_skills`, `evidences`, `matches`.

**evidences** — first-class, one row per supporting/warning signal.
- `id INTEGER PK`, `job_id INT FK→jobs NULL`, `company_id INT FK→companies NULL`
- `engine TEXT NOT NULL` (`google_jobs|google|google_news|google_maps|google_trends`)
- `query TEXT`, `claim TEXT NOT NULL` (e.g. "company appears in 3 independent results")
- `category TEXT NOT NULL` (`supporting|limited|warning`)
- `source_title TEXT`, `source_url TEXT`, `source_snippet TEXT`
- `retrieved_at DATETIME`, `created_at DATETIME`
- Index: `(job_id)`, `(company_id)`.

**candidates** — single active profile for MVP (multi later).
- `id INTEGER PK`, `name TEXT DEFAULT 'Fresher'`, `experience_years REAL DEFAULT 0`
- `location TEXT`, `is_active BOOLEAN DEFAULT 1`, `resume_text TEXT`, `created_at DATETIME`.

**candidate_skills** — `id PK`, `candidate_id FK`, `skill_norm TEXT`, `source TEXT` (pasted/inferred). UNIQUE(`candidate_id`, `skill_norm`).

**job_skills** — `id PK`, `job_id FK`, `skill_norm TEXT`, `evidence_snippet TEXT`. UNIQUE(`job_id`, `skill_norm`). Index `(skill_norm)`.

**matches** — computed per candidate×job.
- `id PK`, `candidate_id FK`, `job_id FK`, UNIQUE(`candidate_id`,`job_id`)
- `total INT` (0-100), `skill_pts INT`, `title_pts INT`, `exp_pts INT`, `loc_pts INT`, `type_pts INT`
- `matched_skills JSON`, `missing_skills JSON`, `reasons JSON`, `computed_at DATETIME`.

**skill_gaps** — aggregated per search (for "learn X unlocks N roles").
- `id PK`, `search_id FK`, `candidate_id FK`, `skill_norm TEXT`, `missing_in_count INT`, `total_jobs INT`.

**api_usage** — every SerpApi HTTP call.
- `id PK`, `engine TEXT`, `query TEXT`, `params_hash TEXT`, `status TEXT` (ok|cached|error), `http_status INT`, `created_at DATETIME`.
- Slice 2 addition: `duration_ms INT DEFAULT 0` per-attempt latency. Usage rows are
  committed independently of the search transaction so failed searches still
  leave a usage trail. `init_db` heals pre-Slice-2 dev DBs via additive
  `ALTER TABLE` (fresh checkouts unaffected).

**cache_entries** — generic cache.
- `cache_key TEXT PK` (sha256 of engine+sorted params), `engine TEXT`, `payload JSON`, `retrieved_at DATETIME`, `expires_at DATETIME`.
- Index: `expires_at`.

ER (text): candidates 1—N candidate_skills; companies 1—N jobs; jobs 1—N job_skills/evidences/matches; searches 1—N jobs (weak), 1—N skill_gaps.

## 5. SerpApi integration architecture

```
Route → JobSearchService → SerpApiClient.google_jobs() / .google_search()
  → _cached_or_fetch(): CacheService.get → if miss: httpx GET https://serpapi.com/search
  → map to Pydantic (GoogleJobsItem / GoogleOrganicItem), never raw dict upstream
  → api_usage insert → CacheService.set → return
```

- Key: `SERPAPI_KEY` env only, read once at startup, never logged, never sent to templates.
- Timeouts: 15s connect/read; 1 retry on timeout/5xx only, no retry on 4xx.
- Errors mapped: `SerpApiError{kind: auth|rate_limit|no_results|http|parse, message, http_status}`.
- `no_results` (empty jobs_results) is valid, not exception: store zero-result search.
- Demo query plan: Jobs `q="{role} {experience}"`, `location="{city}, India"`, `gl=in`, `hl=en`, max 2 pages. Search `q='"{company}" {city} careers'` + `q='"{company}" fake OR fraud OR scam jobs'` (evidence only, top companies).

## 6. Deduplication (summary; full spec in docs/deduplication.md)

Composite `source_key = sha256(company_norm | title_norm | location_norm | salary_norm | first-apply-domain)`.
Pipeline: normalize → exact source_key match → fuzzy TF-IDF cosine on title+company+description (threshold 0.82) → cluster → canonical = earliest first_seen with longest description. `dup_count` shown in UI ("47 found, 18 duplicates removed").

## 7. Matching algorithm (deterministic, explainable)

Total 100 = Skills 50 + Title 20 + Experience 15 + Location 10 + Type 5.
- Skills 50: `|C∩J| / max(|J|,1)` scaled, capped; empty job skills → 25 neutral + `limited` flag (never fake precision).
- Title 20: token overlap between role and title (python/backend/developer lexicon), fresher-friendly titles bonus.
- Experience 15: fresher-compatible keywords (0-1, fresher, junior, entry, trainee) → full; senior-only (5+ years, lead, staff) → 0 with reason.
- Location 10: same city 10, same state/remote-India 7, India 4, else 0.
- Type 5: full-time/on-site match 5, unknown 3, mismatch 0.
Output stored as sub-scores + reasons list; UI shows stacked bar + bullets, labeled "Job Match (rule-based, not ML)".

## 8. Evidence model

Categories: `supporting 🟢 / limited 🟡 / warning 🔴`. Never a numeric trust score.
P0 signals (Jobs+Search only): multi-source presence, location consistency, freshness (`posted_text` parsed to bucket), description specificity (length + requirements keywords), apply-domain consistency, contact-anomaly (gmail/whatsapp-only → warning).
Evidence page lists each claim + engine + query + retrieved_at + source link. Aggregation rule: ≥3 supporting + 0 warnings → Strong; 1-2 supporting → Needs verification; ≥2 warnings or 0 supporting → Multiple warnings.

## 9. Error handling

SerpApi fail → stale cache if present (badge CACHED + age) → else friendly error with retry, never fabricated jobs. Malformed item → skip + log, search still succeeds if ≥1 valid. All handlers catch `SerpApiError`, render `error.html` with correlation id (api_usage.id).

## 10. Security model

`.env` never committed; `.env.example` documents `SERPAPI_KEY`, `ENABLE_NEWS/MAPS/TRENDS=false`. Input validation via Pydantic (length caps, city allowlist for demo + free text). Resume cap 20KB text; PDF (P1) 1MB, `pypdf` text-only, no embedded exec. `httpx` timeouts, per-IP rate limit (slowapi, 30 searches/hour). Logs redact key.

## 11. Feature flags

```env
ENABLE_NEWS=false
ENABLE_MAPS=false
ENABLE_TRENDS=false
ENABLE_PDF=false
```
Checked once in `app/core/config.py`; P1 code paths early-return when off. UI hides tabs when off. Core works with flags all false.

## 12. Local dev flow

`python -m venv .venv → pip install -r requirements.txt → cp .env.example .env (add key) → uvicorn app.main:app --reload → http://127.0.0.1:8000`. Seed: `python scripts/seed_hyderabad.py` (runs real SerpApi once, stores cache). Tests: `pytest`.

## 13. Deployment architecture

Single container (Dockerfile: python:3.12-slim, uvicorn). SQLite file on persistent volume. Render/Railway/HF Spaces all fine. Env vars set in dashboard. `/health` returns db+key-present (not key value). No migrations: `Base.metadata.create_all` on boot for MVP.

## 14. Demo fallback strategy

Pre-demo: run seed for `Python Backend Developer / Hyderabad / Fresher` + 1 backup query, verify `cache_entries` fresh. During demo: app prefers fresh cache (<24h) so even offline it shows real previously-retrieved rows with "CACHED — retrieved Xh ago" badge. If no cache + API down: error card + retry, zero fake rows.
