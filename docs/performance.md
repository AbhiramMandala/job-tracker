# Search performance — fast discovery, progressive enrichment

## Philosophy

```
USER SEARCHES → FAST DISCOVERY → SHOW JOB RESULTS → PROGRESSIVE ENRICHMENT
→ USER OPENS JOB → DEEP INTELLIGENCE (evidence page, already on demand)
```

The old flow blocked the first render on up to 21 sequential SerpApi calls
(jobs + evidence + news + interviews). The new flow renders useful cards
after discovery only (≤2 calls), then fills VERIFY/news/interview panels via
three parallel fetches to `GET /api/enrich/{verify,news,interview}`.

## Measured (mocked 300 ms/call, fixture data, hermetic)

| | Before | After |
|---|---|---|
| Cold POST (first useful result) | 2245 ms / 7 calls | 665 ms / 2 calls |
| Warm POST | 37 ms / 0 calls | 18 ms / 0 calls |
| Deep enrichment | blocked render | ~640 ms max, after first paint, parallel |

Real-world cold latency is dominated by sequential SerpApi HTTP (observed
1–11 s/call, 15 s timeout + 1 retry) — which is exactly what left the
critical path. Total SerpApi calls per search are UNCHANGED (same caps).

## Discovery depth decision: keep two pages (measured 2026-09-29)

Per-page telemetry is logged permanently
(`discovery q=... pages=N stats=[{page, ms, raw}]`).

Fixture measurement through the real service:

```text
Page 1 alone: raw=3 unique=2 dups=1
Both pages:   raw=4 unique=3 dups=1
Page 2 incremental: +1 unique (+50% more uniques), 0 page-2 duplicates here
```

Live history: 19 unique jobs across 2 pages. Matching is per-job
deterministic, so top picks (and the top-5/3/3 enrichment ranges) improve
with more candidates — any "enough jobs" cutoff would be arbitrary and could
drop the best matches. Conclusion: **keep two-page discovery**; the saving
(one SerpApi call) does not justify the coverage/ranking risk.

What changed instead (no coverage risk):

- Page-2 failure no longer fails the search: page-1 results return live
  (attempts still logged to `api_usage`).
- Cache behavior unchanged (combined-query key; hits make zero calls).
- Enrichment caps unchanged.

## What moved off the critical path
- VERIFY evidence (≤10 calls), news (≤3), interviews (≤6) → lazy
  `/api/enrich/*`, cache-first, same top-N ranking and caps.
- Deep intelligence was already on demand (`/jobs/{id}/evidence`).

## What stayed inline (fast, zero HTTP)

Discovery → normalize → dedup (before all expensive work) → skills →
deterministic match → gaps → authenticity + company type (one bounded local
query) → render. New search = full page load, which abandons in-flight
enrichment fetches automatically (no stale-overwrite possible).

## Deliberately NOT built

- **Background refresh / SWR:** no task queue exists; TTL + stale-fallback
  already cover freshness. Revisit only with a real queue.
- **Pagination:** result sets are tens of jobs; MAX_PAGES=2 bounds discovery.
- **Autocomplete debounce:** no live autocomplete exists.
- **Parallel same-request fan-out:** client fires 3 enrich fetches
  concurrently; per-service calls stay sequential (rate-limit safety).
- **React/WebSockets/Celery/Redis:** profiling never justified them.

## Telemetry

Structured logs, no secrets: `search fast ... discovery_ms=... fast_ms=...`
and `enrich kind=... ms=...`; enrich JSON carries `timings_ms`. Full-stage
assertions live in `tests/test_enrich.py` (zero enrichment calls during POST,
caps, cache reuse, failure isolation).
