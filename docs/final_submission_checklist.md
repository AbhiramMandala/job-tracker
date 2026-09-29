# Final SerpApi Hackathon Submission Checklist

Labels: READY (done) · BLOCKED (needs API key/live run) · USER INPUT (needs your
answer) · MANUAL ACTION (you operate browser/GitHub/form).

## Repository

- [x] README complete — READY
- [x] Setup verified without key (`pytest`, TestClient rehearsal) — READY
- [x] No secrets in tracked files; `.env` + `*.db` ignored — READY
- [x] Tests passing (88/88) — READY
- [ ] Public GitHub repository, final commit pushed — MANUAL ACTION

## SerpApi

- [x] Real integration (3 engines, one client, usage logging) — READY
- [x] API key in local `.env` — READY (user-provided, env-only, never committed)
- [x] Live seed executed (`python -m app.demo_seed`) — READY (2026-09-29)
- [x] `google_jobs` real results verified — READY (2 pages ok, 19 raw → 19 unique)
- [x] `google` verification verified — READY (10 ok, 5/5 supporting)
- [x] `google_news` verified — READY (2 ok; 1 persistent HTTP failure → honest unavailable)
- [ ] Usage + LIVE/CACHED evidence captured — MANUAL ACTION (screenshots per specs below)

## Demo — screenshot specs (capture AFTER successful seed, app running)

SCREENSHOT 1 — results page:
URL: `http://127.0.0.1:8000` → search `Python Backend Developer` / `Hyderabad` / `Fresher` → results.
Must show: pipeline counts, LIVE/CACHED badge, match scores, VERIFY badges.
Must NOT show: API key, terminal env output, personal data.
Save as: `docs/screenshots/04-results.png`

SCREENSHOT 2 — verification evidence:
URL: results → VIEW EVIDENCE on top card (`/jobs/{id}/evidence`).
Must show: 2–3 cited sources with queries + retrieval times + reasons.
Save as: `docs/screenshots/05-evidence.png`

SCREENSHOT 3 — usage proof:
URL: `http://127.0.0.1:8000/debug/usage`.
Must show: per-engine rows (`google_jobs`, `google`, `google_news`) with counts.
Must NOT show: API key (page never renders it — verify visually).
Save as: `docs/screenshots/06-usage-live.png`

- [ ] Screenshots captured (real app only, no fabrication) — BLOCKED
- [ ] Demo script finalized (`docs/demo.md`, 2:45) — READY

## Demo — recording checklist

PRE-RECORDING (manual): `.env` has key · `python -m app.demo_seed` succeeded ·
`python -m uvicorn app.main:app` running · browser at `/` · cache warm (badges
CACHED) · close terminals/editors showing secrets · hide bookmarks/personal tabs.
RECORDING: follow `docs/demo.md` timestamps exactly — same role/city, same
clicks (search → top card → WHY → VIEW EVIDENCE → `/debug/usage` → news panel).
POST-RECORDING: duration < 3:00 · no key/secrets visible or audible · upload as
public/unlisted (YouTube or Drive) · test link in incognito.

- [ ] Video — SKIPPED intentionally by user (no URL; if the form mandates one,
  record per `docs/demo.md` and test the link in incognito) — USER DECISION

## Submission

- [x] Track selected: Knowledge & Public Interest (jobs keyword verified) — READY
- [x] Project description finalized — READY
- [x] GitHub link inserted (`https://github.com/AbhiramMandala/jobsetu`) — READY
- [ ] Participant details filled (phone/occupation/years open) — USER INPUT
- [x] Existing project before hackathon: **No** (first commit Sep 28, 2026) — READY
- [x] AI tools disclosed: **OpenCode + ChatGPT** — READY
- [x] Solo contributor confirmed — READY
- [x] Eligibility (India residency, 18+) confirmed — READY
- [x] Event discovery source filled (SerpApi website) — READY

## Agreement (manual — acceptance happens only on the official form)

- [ ] Read the official Rules: https://serpapi.github.io/serpapi-india-hackathon-2026/rules.html?utm_source=india_hackathon_26
- [ ] Accept the official Rules (required: submission item 8, on the form)
- [ ] Read the official Terms & Conditions: https://serpapi.github.io/serpapi-india-hackathon-2026/terms.html?utm_source=india_hackathon_26
- [ ] Accept the official Terms & Conditions (required: submission item 8, on the form)

## Final verification

- [ ] GitHub link works in incognito — MANUAL ACTION
- [ ] Video link works in incognito — MANUAL ACTION
- [ ] Submission form reviewed — MANUAL ACTION
- [ ] Submitted before Oct 10, 2026 23:59 IST — MANUAL ACTION

## License

No LICENSE file in repo. Hackathon rules encourage but do NOT require an
open-source license. Adding MIT is a one-file, reversible decision with the
practical effect of permitting reuse. — USER DECISION REQUIRED.
