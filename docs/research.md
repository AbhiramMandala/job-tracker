# JobSetu — Research (verified 2026-09-28)

## 0. Verification status
- Official HydPy x SerpApi hackathon page: NOT FOUND via automated search on 2026-09-28.
  - `hydpy.org` fetched: no hackathon listing (only meetups / PyConf Hyderabad 2026).
  - Web-search integration returned no results for "HydPy SerpApi India Hackathon 2026".
  - Action: hackathon rules below are PROVISIONAL from user brief. Owner must paste official link if available.
- SerpApi documentation: VERIFIED via direct fetch of serpapi.com docs (see Sources).

Provisional hackathon facts (from user, unverified):
- Deadline: 2026-10-05, online, solo allowed, any SerpApi API allowed.
- Prizes: 3L+ total, 1st 1L cash, HydPy special 10K + credits, 1000 credits per valid submission.

## 1. Judging criteria (inferred, to be replaced by official rubric)
Standard SerpApi/community hackathon rubric assumed:
1. Meaningful SerpApi use (essential vs add-on)
2. Innovation / originality
3. Technical depth + Python quality (HydPy special)
4. Completeness / working demo
5. Real-world usefulness, India relevance
6. Presentation: README, demo video (2-3 min), deployment

Implication: JobSetu must prove it fails without live SerpApi data.

## 2. SerpApi engines verified

### google_jobs (engine=google_jobs) — CORE, P0
- Params verified: `q` (required), `location`, `uule`, `google_domain`, `gl`, `hl`, `next_page_token`, `engine`, `api_key` (required).
- Response: `jobs_results[]` with `title, company_name, location, via, share_link, extensions[], detected_extensions{posted_at, salary, schedule_type}, description, job_highlights[], apply_options[]{title,link}, job_id`, plus `serpapi_pagination.next_page_token`.
- Use: job discovery. Query e.g. `q=Python backend fresher`, `location=Hyderabad, India`, `gl=in`, `hl=en`.
- Cost: 1 search per request, ~10 jobs/page. Plan: 1-2 pages per demo query, cached 12-24h.
- Failure mode: empty `jobs_results`, expired token, location bias. Fallback: cached real data, clearly labeled.

### google (engine=google, organic) — P0 for verification
- Params verified: `q` (required), `location`, `gl`, `hl`, `google_domain`, `start`, `tbm`, `num` via docs.
- Response: `organic_results[]{title,link,snippet,displayed_link}`, `knowledge_graph`, `local_results`.
- Use: `"<company> <location> careers"` and `"<company> fraud OR scam OR fake jobs"` to collect presence/consistency signals. Powers VERIFY without fake scores.
- Cost: 1 per company batch; only top-N companies per search, cached 7d.

### google_news (engine=google_news) — P1 enrichment
- Params verified: `q`, `gl`, `hl`, `so` (0 relevance / 1 date), `story_token`, etc.
- Response: `news_results[]{title, source{name}, link, date, iso_date, snippet}`.
- Use: `"<company> layoffs OR funding OR hiring"` risk/context signals. Cached 7d. Never claim scam; show headlines as evidence.

### google_maps (engine=google_maps, type=search) — P1 location check
- Params verified: `q`, `location`/`ll`/`lat+lon+z|m`, `type=search` (required), `hl`, `gl`.
- Response: `local_results[]{title, address, rating, reviews, phone, operating_hours, gps_coordinates, place_id}`.
- Use: `"<company> Hyderabad"` office existence check. 1 call per top company, cached 7d. Optional for MVP if credit-tight.

### google_trends (engine=google_trends) — P1 skill demand (use sparingly)
- Params verified: `q` (max 5 comma-separated), `geo`, `date` (e.g. `today 12-m`), `data_type=TIMESERIES`, `tz`, `cat`.
- Response: `interest_over_time.timeline_data[]{date, values[]{query, extracted_value}}` (0-100 relative, NOT absolute volume).
- Use: curated skills only (Python, FastAPI, Docker, Redis...), `geo=IN`, refreshed daily, cached. Constraint: NEVER present as absolute demand counts; label "relative search interest".
- Risk: highest cost/complexity per insight. Degrade gracefully: hide trend section if unavailable.

Engines explicitly DEFERRED: Shopping/Product (not needed for jobs), YouTube transcripts, Flights/Hotels.

## 3. API usage plan (credit-efficient)
- Budget target: <300 searches total for build+demo+testing.
- Rules: DB-first reads; SerpApi only on cache miss; 1-2 jobs pages per query; News/Maps only for top-15 companies; Trends only for ~10 curated skills daily; log every call with engine+query to `/api/usage`; `SERPAPI_KEY` server-side only via env.
- SerpApi cache: identical query+params served free within ~1h (verified in docs). App-level SQLite cache extends to 24h (jobs) / 7d (enrichment).

## 4. Constraints
- Empty workspace (verified 2026-09-28, 0 entries). No existing code to reuse.
- 7 days to deadline. Solo dev. Must favor SQLite + FastAPI + server-rendered minimal UI.
- No hardcoded keys, no fake evidence, no fabricated percentages. All VERIFY badges must link to stored evidence rows.
- PDF resume: size cap, safe parsing, fallback to paste-text profile.

## 5. Risks
1. Jobs location bias / stale `posted_at` strings ("4 days ago") — mitigate with freshness signal, not exact dates.
2. Company name ambiguity in Search/News — mitigate with exact-phrase queries + `gl=in`, show sources, never auto-convict.
3. Trends misinterpretation (relative 0-100) — mitigate with correct labeling.
4. Credit exhaustion during demo — mitigate with seeded real cache + clearly labeled fallback.
5. Overbuilding frontend/LLM — mitigate with deterministic scoring first, LLM only for explanation.

## Sources (fetched 2026-09-28)
- https://serpapi.com/ (catalog)
- https://serpapi.com/search-api (engine=google params/response)
- https://serpapi.com/google-jobs-api (engine=google_jobs params/response)
- https://serpapi.com/google-news-api (engine=google_news params/response)
- https://serpapi.com/google-trends-api (engine=google_trends params/response)
- https://serpapi.com/google-maps-api (engine=google_maps params/response)
- https://hydpy.org/ (no hackathon listing found)
