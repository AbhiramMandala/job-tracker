# JobSetu — VERIFY: evidence-backed verification (Slice 4)

## Purpose

Help a fresher decide whether a listing deserves further investigation by
showing observable, sourced signals — never verdicts. The system must not
say "scam", "fake", "trustworthy", or "legitimate". It says what was found,
where, and when, and aggregates into one of:

- 🟢 Supporting evidence (≥2 supporting finding types, zero warnings)
- 🟡 Needs verification (some evidence, but thin or unclear)
- 🔴 Warning signals (≥1 warning; warnings dominate)
- Verification unavailable (no data at all — shown as muted text, no badge)

No numeric trust/risk scores exist anywhere. A test asserts the word "87%"
style percentages never appear in verification reasons.

## Query strategy (engine=google, via SerpApiClient only)

Per job, at most 2 queries, both `gl=in hl=en`:

1. Identity: `"<company_raw>" "<title_raw>"` (title truncated to 80 chars).
   Exact quoting reduces ambiguity.
2. Location: `"<company_raw>" <city>` where city is the job location's
   first segment. Skipped when the listing has no location.

No-company listings get zero HTTP calls and a stored warning instead.
Only the top `EVIDENCE_MAX_JOBS` (default 5) jobs per search are enriched,
ranked by match score (or result order without a profile). Sequential
execution — no concurrency (credit safety + simpler failure handling).

## Evidence schema

Rows in `evidences` (see architecture §4). New in Slice 4: `evidence_type`.
Identity of a row is `(job_id, normalized URL)` across all types —
the same source found by both queries stays one row (first type wins);
re-runs refresh content, never duplicate. URLs normalize to
lowercased host+path for identity; display keeps the original.

Row types: `job_presence` (identity query + company & title match),
`location_presence` (location query + city match), `company_website`
(official-site heuristic), `company_presence` (name match, weaker),
`warning_signal` (no source URL; e.g. no-company, zero-presence).

## Classification rules (deterministic, in `_type_row` + `_classify`)

- Official site: domain first label contains (nearly) all company tokens
  (single-token names need that one). Heuristic, documented; fails safe
  toward "not official" for shared-name companies.
- Company match: ≥ half the company tokens (min 1) in title+snippet+domain.
- Title link: any shared token between normalized job title and result text.
- Zero results on BOTH queries → stored warning ("No independent search
  presence"). Zero on one → limited ("could not be independently confirmed").
- ≥4 distinct matching domains with no official site → limited
  ("Ambiguous identity").
- Warnings dominate the status. A zero-presence warning is retired
  automatically once real evidence arrives.

## Ambiguity handling

Company names normalize (`normalize_company`) but the original raw name is
always shown and always quoted in queries. Similar-but-different companies
("ABC Tech" vs "ABC Technologies USA") are NOT assumed identical: fuzzy
matching requires token overlap, and multi-organization name collisions
surface as "Ambiguous identity" instead of a false match.

## Cache strategy

Same `cache_entries` table, engine `google`, key = full params, TTL 7 days
(`EVIDENCE_TTL_HOURS`). Fresh hit → zero HTTP. Failure → stale body when
present (summary flagged `stale`), else "unavailable". UI shows
`LIVE` vs `CACHED · retrieved X ago` per job card.

## API-credit strategy

Cold search worst case: 2 (jobs) + 2×5 (evidence) = 12 calls. Warm search:
0. Same-company location queries share cache entries, so real usage is
usually lower. Every attempt is logged to `api_usage` (engine `google`)
with an independent commit, so failed attempts are still counted.
`EVIDENCE_MAX_JOBS` is env-configurable; a test pins the cap.

## Sync vs async (Option A chosen)

Enrichment runs synchronously inside POST /search, bounded and sequential.
Reason: simplest reliable demo, no background infra for a solo build, and
the warm-cache path (the actual demo path — seed once, demo warm) is
instant. Cold latency (~10 sequential SerpApi calls) is the accepted
tradeoff; async/on-demand is recorded future work.

## Limitations

- Small/obscure employers may show "Needs verification" or the
  zero-presence warning despite being legitimate — wording says
  "no independent presence found", not "fake".
- Common-name companies can trigger "Ambiguous identity".
- Location support depends on city tokens appearing in snippets.
- Only Google organic results; no News/Maps yet (Slice 5+).
- Website heuristic can misfire on single-token company names.

## Known false-positive / false-negative scenarios
- FP (warning on legit): tiny startup with no web footprint → zero-presence
  warning. Mitigated by wording; accepted.
- FP (supporting on weak): official site + one directory listing reaches
  "Supporting" via 2 findings. Accepted: both findings are shown, judge sees
  exactly how thin it is.
- FN (missed risk): sophisticated fake postings borrowing a real company's
  name pass presence checks. Out of scope: we report presence, not
  authenticity of the posting itself.

## News rows in this table (Slice 5)

News reuses `evidences` with `evidence_type = news_<category>` and
`category = context`, plus `source_date` for the publication date.
News rows never feed the VERIFY status above (excluded from domain counts
and findings); the detail page renders them in a separate NEWS CONTEXT
section. Identity for news rows is also (job, normalized URL). Categories
are keyword rules (layoff/shutdown/restructuring checked before
acquisition/funding/expansion/regulatory, default company_update);
see `app/services/news.py`.
