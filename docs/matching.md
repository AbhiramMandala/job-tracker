# JobSetu — Matching engine (Slice 3, deterministic, no LLM)

## Formula

Total 100 = Skills 50 + Title 20 + Experience 15 + Location 10 + Type 5.
Weights unchanged from architecture; no reason found to change them
(skills dominate because skill fit is the observable signal; everything
else is a bounded adjustment).

Same candidate + same job always yields the same result. There is no
randomness, no embedding model, no LLM in the calculation.

## Skills (50)

`round(50 * |candidate ∩ job| / |job skills|)`, job-skill order = order of
first appearance in title+description. Empty job-skill set → 25 with
`skills-limited` flag and reason "skill requirements not listed — score is
provisional". Never invents precision.

## Title (20)

Token overlap after lowercasing and removing seniority tokens
(senior/sr/lead/junior/jr/fresher/trainee/...):
`min(20, round(20 * |shared| / |role tokens|))`. Empty role → 10 neutral.
No overlap → 0. Deliberately simple; seniority is scored separately so
"Senior Python Developer" still title-matches a Python role.

## Experience (15)

Parsed from title + first 2000 chars of description:

- Explicit minimum (`N years/yrs/yoe`, takes the min of all found):
  candidate ≥ min → 15; within min−1 → 8; else 3, reason states the minimum.
- Senior-titled (senior/lead/staff/principal/architect/head/manager) or
  min ≥ 3 with no fresher marker: fresher (≤1y) → 0; else 12.
- Fresher/entry/trainee/junior/graduate/intern marker → 15.
- No signal at all → 10 with `experience-unclear` (neutral, not a claim).

Detection runs on raw tokens because the title scorer strips seniority
words (a real bug caught in testing). Known limitation: range parsing is
naive ("0-2 years" reads min 0); contract prose can confuse it.

## Location (10)

Normalized comparison (`normalize_location`): equal → 10; remote listing
→ 7; anything else with a candidate preference → 0; missing job location
or missing preference → 5 with `location-unknown`. No geo-distance math.

## Type (5)

Candidate preference defaults to `any` → 5 ("no preference"). Otherwise
the job type is inferred by keyword (internship/part-time/contract/
full-time): match → 5, mismatch → 0, unstated → 3 with `type-unknown`.

## Skill extraction

Closed vocabulary in `app/data/skills.py` (~55 skills, alias map).
Longest-alias-first matching with matched spans blanked out, so "sql"
cannot fire inside "mysql" and "git" cannot fire inside "github".
Custom word boundaries handle `c++`, `node.js`, `.net`; the lookahead
deliberately allows sentence-final periods. "go" matches only via
"golang". Unknown tools are missed, not guessed — documented tradeoff.
`extract_skills` is pure and idempotent; `job_skills` upserts are unique
per (job, skill).

## Skill gaps

Per match: `missing = job skills − candidate skills`. Aggregated per
search into `skill_gaps` (top 8 by frequency) and shown as
"missing in N of M jobs" — counts, never percentages or predictions.

## Example

Candidate Python/FastAPI/PostgreSQL/Git vs a Python Backend listing
requiring Python/FastAPI/PostgreSQL/Docker/Redis:
skills 30/50, title 20/20, experience 10/15 (no signal), location 10/10,
type 5/5 → 75% MATCH, gap Docker · Redis.

## Limitations

- Skill synonyms outside the vocabulary are missed.
- "No negative" parsing: "no docker needed" still detects docker.
- Experience parsing is keyword-based, not semantic.
- Type preference defaults to "any", so type rarely differentiates today.
