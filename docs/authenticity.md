# Job Authenticity — evidence-based risk signals

## What it is

An **Authenticity Evidence Score (0–100)** per job with explained signals.
It reuses already-stored SerpApi evidence rows plus the job's own fields and
makes **zero new SerpApi calls** — it works identically on live, cached, or
stale data and costs no credits.

## What it is NOT

- Not a scam detector. It never says real/fake, legitimate/fraudulent, or
  guaranteed anything. Banned wording: "definitely", "100%", "scam", "fake".
- Not a statistical probability. Category weights are documented judgment
  calls, not validated on a labeled dataset (no such dataset exists here).

## Formula

Total = Company 25 + Consistency 25 + Application 20 + Content 20 + Evidence 10.

| Category | Points from |
|---|---|
| Company verification (/25) | Official domain found +10; company in supporting results +8; role connection +4; location support +3 |
| Job consistency (/25) | Independent job match +10; location match +6; company match +5; corroboration across ≥3 independent sites +4; −3 per contradiction (unconfirmed location, ambiguous identity, stored warnings) |
| Application signals (/20) | Base 12; official-domain apply link +5; recognized platform (LinkedIn/Indeed/Naukri/…) +3; unrelated channel −4; no link −2; free-email contact −4; WhatsApp/Telegram −5 each |
| Content risk (/20) | Starts 20; fee/payment phrases −6; guaranteed-income −5; no-interview −4; urgency pile-up −2; salary caution −3 |
| Independent evidence (/10) | 1/2/3+ distinct supporting sources → 4/7/10; +2 when news context exists |

Level bands: 90+ Strong supporting evidence · 75+ Higher confidence ·
50+ Mixed evidence — verify · 25+ Significant risk signals · 0–24 High risk —
verify carefully. These are UI categories, not fraud probabilities.

## Honesty rules built in

- **No-evidence cap:** with zero stored evidence rows the score is capped at
  49 with an explicit "capped until evidence exists" notice — content signals
  alone can never produce confidence.
- **Failures never become verdicts:** missing apply links, missing companies,
  and absent evidence produce notices ("Insufficient independent evidence"),
  never risk inflation.
- **Keyword heuristics are English-only** and documented in
  `app/services/authenticity.py` (`FEE_PHRASES`, `GUARANTEE_PHRASES`, …).
  A Gmail recruiter address raises risk but never classifies a job as a scam.
- Deterministic: same job + same rows always give the same score
  (tested). Scores clamp to 0–100 per category and total.

## SerpApi role

Indirect but real: every evidence point the analyzer reads (official-site
rows, presence rows, corroborating domains, news availability) was retrieved
through SerpApi (`google`/`google_news`) and cached by the existing pipeline.
No SerpApi → no evidence rows → capped, content-only scores that say so.

## Endpoints & UI

- `GET /jobs/{id}/authenticity` → JSON (`score`, `level`, `category_scores`,
  `signals`, `contradictions`, `evidence_available`, `disclaimer`).
- Results cards and the evidence page embed the same report
  (`_authenticity.html` partial) with the full disclaimer.
