# Competitive analysis: job-tracker UX benchmarks

Researched October 2026 (Huntr, Teal, Simplify, Jobscan, Prentus/TrackJobs roundups).
Purpose: inform our Home-first restructure. Not copied; used as benchmarks.

## Post-login first screen

| Product | What you see first |
|---|---|
| Huntr | **Kanban board** (Saved → Applied → Interview → Offer). Metrics exist but are secondary. |
| Teal | **Pipeline/list of tracked jobs** grouped by stage; extension-saved jobs land here. |
| Simplify | **Tracker list** of applied/bookmarked jobs; applying auto-saves. |
| Jobscan | **Kanban board where every card shows Match Rate** — the board is a readiness readout, not just a record. |
| JobSetu + Tracker (now) | Metric tiles (Total/Applied/Interviewing/Offers/Rejected/Saved). Action-poor. |

**Takeaway:** nobody leads with analytics. Everyone lands the user on *their jobs* and the *next action*. Our Home must do the same.

## Discovery → save → track

| Product | Pattern |
|---|---|
| Huntr | Chrome clipper turns any posting into a card in one click. |
| Teal | Extension bookmarks from 50+ boards; per-job keyword/skill insights before applying. |
| Simplify | Applying auto-saves; autofill removes re-typing; follow-up email help. |
| JobSetu + Tracker (now) | Two valid paths (Discover page import; JobSetu Save-to-Tracker button) but the Discover→Saved→Applied staging is invisible. |

**Takeaway:** saving must be one click with context preserved (our export already carries match score + evidence URL in notes — surface it). Stages must read as a funnel: Discovered → Saved → Applied → Interview → Offer/Rejected.

## Interviews, resumes, jobs-vs-applications

- Huntr/Teal/Simplify all separate **tracking a job** from **its process** (interviews, notes, docs live on the card/application, not on the board).
- Resume-per-application is standard (Huntr stores a resume + cover letter per job; Simplify records which resume performed).
- Nobody merges "jobs I found" with "applications I own" — discovery and pipeline are distinct surfaces.

**Takeaway:** our data model already matches (JobSetu owns discovery/intelligence; Tracker owns applications/interviews/resumes). The restructure must make that separation *visible*: Discover ≠ Applications, and a discovered job only becomes an application via an explicit Save.

## Adopt / avoid / better

- **Adopt:** pipeline-first home; per-card readiness context (we have match scores — show them on Tracker cards); resume ↔ application linkage visibility; next-action surfacing (overdue follow-ups, upcoming interviews).
- **Avoid:** metric-tile dashboards; exposing integration mechanics (origins, API URLs, tokens); forcing analytics before action; custom-stage complexity (our 7 statuses stay, grouped into 4 pipeline buckets in the UI).
- **Better than them:** evidence-backed verification travels with the saved job (competitors show keywords; we show cited sources + authenticity signals via the evidence URL); no extension install needed (JobSetu *is* the discovery engine).
