# Interview selection process — candidate-reported context

## What it is

A SELECTION PROCESS section per job answering "what will the hiring process
look like?" from candidate-reported interview experiences found through
SerpApi organic search. Every stage shows its support count
("Technical interview — reported in 3 of 5 available candidate reports");
stages with fewer than two independent reports are labeled anecdotal, and
digests built from two or fewer total reports carry a limited-information
banner. Everything links to its source for inspection.

## Compliance rules (hard requirements, tested)

- **Sources come only from SerpApi organic-search results.** JobSetu never
  fetches review-site pages itself and never bypasses authentication,
  CAPTCHAs, paywalls, robots restrictions, or anti-bot mechanisms. If a
  source cannot be summarized from its search result, it is skipped.
- **No long copyrighted text.** Stored rows keep the (short) result title
  plus a concise factual stage summary ("Candidate-reported: Technical
  interview mentioned."), truncated snippets (≤300 chars), and full
  attribution: source name, URL, query, retrieval time.
- **Candidate-reported, always.** The section header, disclaimer, and every
  claim label the information as candidate-reported — never official company
  policy.
- **Aggregate honestly.** A stage counts reports by DISTINCT source domains
  (independent reports). Only claims supported by multiple reports read as
  established; single-report stages are explicitly anecdotal.

## Pipeline

`InterviewService.enrich_top` (top-`INTERVIEW_MAX_JOBS` jobs, sequential,
failure-isolated) runs two bounded queries per job —
`"<company>" "<title>" interview experience` and
`"<company>" interview process freshers` (`gl=in`, `hl=en`, cached 7 days,
usage-logged under the existing `google` engine label):

1. Parse organic results (existing `parse_organic_results`).
2. Drop results failing company relevance (majority of company tokens on
   word boundaries, or official-domain match) — stricter than substring
   matching on purpose, since wrong-company interview data is harmful.
3. Detect stages via `STAGE_RULES` keyword filing (a report can support
   several stages).
4. Store one `Evidence` row per (report, stage): `evidence_type`
   `interview_<stage>`, category `context`, claim
   `Candidate-reported: <label> mentioned.` Deduplicated by normalized URL.
5. Aggregate with `summarize_reports` (pure, no I/O): fingerprint-cluster
   near-identical texts (>= 0.9) so reposts count once, per-stage distinct
   domains, anecdotal flags, strength tiers (Official / Candidate-reported /
   Community-reported / Search-derived), last-checked age, display sentences.

## Stage taxonomy

Online assessment · Aptitude test · Technical interview · Managerial round ·
HR interview · Group discussion · Case study / assignment ·
Telephonic screening. See `STAGE_RULES` in `app/services/interview.py`.

## Limitations

- Keyword filing is literal: negations ("no aptitude test") still file under
  the stage (the source link is always shown so readers see context).
- English-only stage phrases; coverage depends on what the search index
  returns for each employer (small firms may have nothing → honest `empty`).
- Relevance uses word-boundary token matching; jammed-together name variants
  without an official-domain match can be missed (documented trade-off).
- Failures (timeout/5xx/429/auth) degrade to stale rows, then to an honest
  `unavailable` state — never to invented stages, never breaking search.

## Company type estimates

`classify_company_type` (in `app/services/company.py`) derives a conservative
label from the same stored rows: "Government / PSU" (High) on gov-domain or
gov-name signals; "Established employer" (Moderate) on an official site plus
≥3 independent corroborating domains. Anything else falls back to the
user-facing "Private Company" (Low) — the canonical internal value is
`private_company`, and `normalize_company_type` maps every spelling variant
to canonical form through a single layer (no scattered string comparisons).

Honesty model: "Private Company" here means "no evidence for a more specific
type on a private-sector job board," stated plainly via Low confidence and
the basis string ("insufficient evidence for a specific type; private-sector
default, not verified"). Startup, MNC, size, and non-profit claims are never
emitted — the evidence cannot support them. The UI exposes no Unknown
category; unrelated "Unknown ..." strings (location, salary, company name)
are untouched.

## Credit bounds

Interviews add at most 2 queries × `INTERVIEW_MAX_JOBS` (3) = 6 calls per
cold search: jobs 2 + evidence ≤10 + news ≤3 + interviews ≤6 = **≤21 cold**,
0 warm. See README credit bounds.
