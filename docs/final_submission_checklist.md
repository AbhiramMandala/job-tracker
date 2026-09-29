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
- [ ] API key in local `.env` — MANUAL ACTION (never paste key in chat; never commit `.env`)
- [ ] Live seed executed (`python -m app.demo_seed`) — BLOCKED (see above)
- [ ] `google_jobs` real results verified — BLOCKED
- [ ] `google` verification verified — BLOCKED
- [ ] `google_news` verified — BLOCKED
- [ ] Usage + LIVE/CACHED evidence captured — BLOCKED

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

- [ ] Video recorded — MANUAL ACTION (after seed)
- [ ] Video ≤ 3 minutes — MANUAL ACTION
- [ ] Video link inserted in `HACKATHON_SUBMISSION.md` + `SUBMISSION_FORM_DRAFT.md` — USER INPUT
- [ ] Video link tested in incognito — MANUAL ACTION

## Submission

- [x] Track selected: Knowledge & Public Interest (jobs keyword verified) — READY
- [x] Project description finalized — READY
- [x] GitHub link inserted (`https://github.com/AbhiramMandala/jobsetu`) — READY
- [ ] Participant details filled — USER INPUT
- [ ] Existing-project disclosure confirmed — USER INPUT
- [ ] AI disclosure confirmed — USER INPUT
- [ ] Solo contributor confirmed — USER INPUT
- [ ] Eligibility (India residency, 18+) confirmed — USER INPUT
- [ ] Event discovery source filled — USER INPUT
- [ ] Rules + Terms accepted on the form — MANUAL ACTION

## Final verification

- [ ] GitHub link works in incognito — MANUAL ACTION
- [ ] Video link works in incognito — MANUAL ACTION
- [ ] Submission form reviewed — MANUAL ACTION
- [ ] Submitted before Oct 10, 2026 23:59 IST — MANUAL ACTION

## License

No LICENSE file in repo. Hackathon rules encourage but do NOT require an
open-source license. Adding MIT is a one-file, reversible decision with the
practical effect of permitting reuse. — USER DECISION REQUIRED.
