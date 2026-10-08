# JobSetu — Deduplication spec

Goal: collapse the same posting seen via multiple `via` sources (Indeed, LinkedIn, company site) so counts like "47 found, 18 duplicates removed" are honest.

No embeddings, no vector DB. Deterministic, explainable, solo-maintainable.

## 1. Normalization (must run before any comparison)

- `company_norm`: lowercase, strip Pvt/Ltd/Inc/Technologies→tech map, remove punctuation, collapse spaces. e.g. `ABC Technologies Pvt. Ltd.` → `abc tech`.
- `title_norm`: lowercase, expand abbreviations (sr→senior, jr→junior, be→backend), remove seniority noise in separate field but keep in norm, strip brackets content. e.g. `Python Backend Developer (Fresher)` → `python backend developer`.
- `location_norm`: lowercase, `hyderabad / secunderabad` → `hyderabad`; `remote india` stays; strip `telangana, india` suffix.
- `desc_norm`: lowercase, strip HTML, collapse whitespace, truncate 4000 chars.
- `apply_domain`: registrable domain of first apply link (e.g. `indeed.com`).

## 2. Exact pass — composite key

```
source_key = sha256(company_norm + "|" + title_norm + "|" + location_norm + "|" + salary_norm + "|" + apply_domain_root)
```

Slice 2 decision (kept for Slice 3): upstream `job_id` is EXCLUDED from the key.
It is an opaque Google-internal token, absent on some listings, and observed to
differ across query formulations for the same posting. Identity rests on the
normalized composite above; `serpapi_job_id` is still stored on the job row for
debugging.
- `salary_norm`: digits-only buckets or `nosalary`.
- If `source_key` matches an existing job → duplicate, increment `dup_count`, update `last_seen`, keep earliest `first_seen` record as canonical.

## 3. Fuzzy pass — TF-IDF cosine

For items with no exact match, compare against canonicals from the same search:
- Features: char-3-gram TF-IDF over `title_norm + " " + company_norm` (weight 0.5) + `desc_norm` (weight 0.5). Use scikit-learn `TfidfVectorizer(analyzer='char_wb', ngram_range=(3,3))` fitted per-search (small N, no persistence needed) — or pure-Python fallback if sklearn unavailable (token Jaccard ≥0.8).
- Similarity = 0.5*cos(title_company) + 0.5*cos(description).
- Threshold: ≥0.82 → duplicate cluster. 0.70–0.82 → flag `needs_review`, keep separate (precision over recall; never merge two different companies).
- Guardrails: never merge if `company_norm` token overlap is 0 AND apply domains differ AND locations differ — require at least company OR (title+location) agreement.

## 4. Canonical pick

Within a cluster: earliest `first_seen`; tie-break longest description; copy richest apply link. `dup_count = cluster size - 1`. Store merged `via` list as JSON in `jobs.via` (e.g. `["Indeed","LinkedIn"]`).

## 5. Worked example

Raw: 3 rows titled `Python Backend Developer`, company `ABC Tech`/`ABC Technologies`, location `Hyderabad` → same `source_key` except apply domain differs → fuzzy sim 0.91/0.88 → 1 canonical, `dup_count=2`, evidence "Found in 3 sources".

## 6. Testing

Unit tests: exact-match, punctuation variants, cross-company non-merge, threshold boundary, empty description. Property: dedup is idempotent (re-run changes nothing).

## 7. Slice 3 implementation notes (actual behavior)

- Pure-Python char-3-gram TF-IDF cosine, no sklearn: per-search sets are
  tiny, fitting per comparison is trivial, and it avoids a native
  dependency. IDF uses `1 + log(2/df)` smoothing so identical docs score
  1.0; output clamped to [0, 1] against float epsilon.
- `job_id` excluded from `source_key` (opaque, unstable); stored on the row.
- Fuzzy merge requires shared company tokens (both non-empty); threshold 0.82.
- `apply_merge` preserves: longest description, known salary/posted text,
  first apply link, union of `via` sources, extra apply links in
  `jobs.extra_links`, newest `last_seen`, `dup_count + 1`. Canonical choice
  is first-processed (earliest fetch order), which approximates earliest seen.
- Datetime comparison is naive/aware-safe (SQLite round-trips naive).
