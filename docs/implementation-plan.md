# JobSetu — Implementation plan (vertical slices)

## Slice 1 — Project setup ✅ COMPLETE
- FastAPI app, config from env, SQLite+SQLAlchemy models (empty tables), Jinja base + minimal CSS, `/health`, `.env.example`, Dockerfile skeleton, pytest hello.
- Done when: `uvicorn` boots, `/health` ok, `pytest` passes.

## Slice 2 — Live job search (end-to-end) ✅ COMPLETE
- Implemented: form → POST /search → JobSearchService → SerpApiClient.google_jobs
  (max 2 pages) → JobItem Pydantic models → JobNormalizer → source_key upsert → results page.
- Exact-duplicate collapse via source_key + in-memory intra-fetch collapsing.
  Full TF-IDF similarity stays in Slice 3.
- Cache-first (24h TTL), LIVE/CACHED + stale banners, api_usage per HTTP attempt
  (committed independently so failures are still logged).
- Done when: mocked Hyderabad query renders titles/companies from DB. Live run
  succeeded 2026-09-29 (2 pages, 19 real jobs, warm cache verified).

## Slice 3 — Deduplication ✅ COMPLETE
- Implemented docs/deduplication.md (+§7 impl notes); pure-Python TF-IDF
  similarity (0.82, company-overlap guard), merge-preserving canonicals,
  pipeline counts ("X listings → Y duplicates removed → Z unique").
- Done when: seeded duplicate fixtures collapse correctly + counts display.

## Slice 3b — Candidate + matching ✅ COMPLETE (folded into Slice 3 build)
- GET/POST /profile (single local profile, normalized skills, labeled demo
  prefill), curated skill extractor (`app/data/skills.py`), deterministic
  50/20/15/10/5 matcher with sub-scores + reasons + limited flags
  (docs/matching.md), per-card WHY breakdown, "learn next" frequency panel.
- Done when: demo profile + mocked Hyderabad search renders explainable scores.

## Slice 4 — Candidate ✅ COMPLETE (built as part of Slice 3)
- See Slice 3b above. Single active local profile, no auth.

## Slice 5 — Matching + skill gap ✅ COMPLETE (built as part of Slice 3)
- See Slice 3b above and docs/matching.md.

## Slice 6 — Evidence (P0: Google Search only) ✅ COMPLETE (built as Slice 4)
- EvidenceService.google_search per top company, evidences table + evidence page with sources, VERIFY badge (Strong/Needs verification/Warnings).
- Done when: evidence page shows engine+query+retrieved_at+links for every claim.
- See docs/verification.md for the full design record.

## Slice 7 — Polish ✅ COMPLETE
- Loading/empty/error states, LIVE/CACHED badges with age, responsive cards, apply links, saved jobs (localStorage or DB flag if trivial).
- Done when: cold run + cached run + zero-result run all look intentional.
- Status (final QA): loading/empty/error/stale states done; LIVE/CACHED on jobs,
  verify, and news; news failure isolated; hero + card hierarchy polished.
  Friendly 400/503/404 manually verified, no tracebacks; empty states done.

## Slice 8 — Reliability ✅ COMPLETE
- Tests: normalizer, dedup, matcher, cache TTL, malformed SerpApi payloads, API-failure fallback (stale cache → error, never fake). Request logging redaction check.
- Done when: `pytest` covers P0 paths, fallback manually verified by revoking key.
- Status (final QA): 88 tests green covering all of the above; key-absent and
  failure paths verified manually; live-key run still blocked (no key).

## Slice 9 — Deployment
- Prod config, volume for SQLite, `/health`, deploy to Render/Railway, run real Hyderabad seed, verify cache fallback on deployed URL.
- Done when: public URL serves seeded demo without key-dependent failure.
- Status (final QA): Dockerfile + .dockerignore + README deploy section done;
  `/health` secret-free; image build NOT validated (no Docker daemon in this
  environment); no platform deploy executed (no credentials); live seed blocked
  (no key). Deploy + seed remain pre-submission actions.

## Slice 10 — Hackathon packaging
- README (problem/solution/SerpApi/architecture/setup/env/API/tests), screenshots, architecture diagram export, 2-min demo script rehearsal, final QA against judge bar.
- Done when: stranger can run from README + demo fits 3 min.
- Status (final QA): README hackathon-ready (Why SerpApi, deploy, seeding);
  Mermaid architecture diagram in README; `docs/demo.md` (2:45, live-measured
  numbers); `docs/jobsetu/hackathon/submission.md` draft; 6 UI screenshots in
  `docs/jobsetu/hackathon/screenshots/` (incl. live-seeded results page); video intentionally
  skipped; deploy pending.

P1 slices (only after Slice 8 green): News, Maps, Trends, PDF upload — each behind its flag, each independently revertible.
