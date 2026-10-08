<<<<<<< HEAD
# Student Job Application Tracker (Cloudflare Full-Stack)

A production-style portfolio project for CSE graduates: track job applications, interviews,
notes, follow-ups, and resumes on **100% Cloudflare free-tier-friendly** infrastructure.

![Status](https://img.shields.io/badge/stack-Cloudflare-orange) ![CI](https://img.shields.io/badge/ci-GitHub_Actions-blue)

> Screenshots: add `docs/screenshot-dashboard.png`, `docs/screenshot-applications.png` after first run.

## Features

- **Auth** — register / login / logout, persistent sessions (Bearer token + HttpOnly cookie), PBKDF2-SHA256 password hashing, never returns password hashes. Forgot-password via single-use 1-hour emailed-style tokens (`POST /api/auth/forgot-password`, `POST /api/auth/reset-password`); reset links are written to the server log in local dev (plug in an email provider for production); password reset revokes all sessions.
- **RBAC + PBAC** — roles (`student`, `admin`) with a central permission catalog (`worker/src/authz.ts`); every protected route declares its permission and ownership policies verify `user_id` server-side. Students can only touch their own data; admins get `users.manage`/`admin.access`.
- **Dashboard** — totals (total/applied/interviewing/offers/rejected/saved), by-status chart bars, upcoming interviews, recent applications, overdue + upcoming follow-ups.
- **Applications** — full CRUD with company, title, location, URL, type, salary, date, status (`SAVED/APPLIED/OA/INTERVIEW/OFFER/REJECTED/WITHDRAWN`), notes, contacts, follow-up fields, optional resume link.
- **Search/filter/sort/pagination** — server-side (`LIKE` on company/title, status/type/date filters, newest/oldest, `LIMIT/OFFSET` + total count).
- **Interviews** — linked to an application, types (`PHONE/OA/TECHNICAL/HR/BEHAVIORAL/FINAL`), upcoming list on dashboard.
- **Resumes (R2)** — upload/view(download)/delete, metadata only in D1, strict MIME/size/filename validation, Worker-only R2 access.
- **Notes** — per-application create/edit/delete.
- **Follow-ups** — reminder flag + date + notes; overdue shown separately (`⚠ Follow up with Google, Due: …`).
- **UI** — hamburger + drawer navigation (all breakpoints) with backdrop, Escape/backdrop close, scroll lock, focus return and background `inert`; sticky header with page context + avatar → profile; professional footer; cards, tables, status badges, modals, loading/empty/error states, toasts, confirm-before-delete, responsive, accessible labels + keyboard-focusable dialogs.
=======
# JobSetu

Evidence-powered job intelligence for Indian freshers.

## What it does

JobSetu turns a raw job search into a decision card. Search a role + city →
get deduplicated listings, each with a deterministic match score against your
profile, a VERIFY section backed by cited search evidence, recent company news
context, and an aggregate "what should I learn next?" skill-gap panel.

## Why it exists

Fresher job boards answer "what exists" but never the three questions that
matter: **is this relevant to me, can I trust this company, what am I
missing?** JobSetu answers all three on one card per job — with sources, not
black-box scores.

## Key features

- Live fresher job search (Hyderabad-first, works for any Indian city)
- Exact + TF-IDF similarity deduplication with honest pipeline counts
- Candidate profile with explainable match breakdowns (WHY THIS MATCHES)
- VERIFY badges (Supporting evidence / Needs verification / Warning signals)
  with inspectable per-job evidence pages — every claim cites its source
- News context (layoffs, funding, expansion…) with recency, categories, sources
- Skill-gap frequency ("missing in N of M jobs")
- Candidate-reported selection-process context (interview stages with
  per-stage report counts; anecdotal stages labeled)
- Credit-efficient SQLite caching with LIVE/CACHED transparency + stale fallback
- Credit visibility: `/debug/usage` logs every SerpApi attempt per engine
- Warm-cache demo seeding: `python -m app.demo_seed`
- Landing guide (How it works, pillars, SerpApi story, FAQ), friendly 404 page

## How SerpApi is used

SerpApi is the data backbone, not a search box. Remove it and the product has
nothing — no listings, no evidence, no news. All traffic goes through the
single `SerpApiClient` (`app/services/serpapi_client.py`); routes never see
raw SerpApi JSON.

| Pillar | Engine | Query | Use |
|---|---|---|---|
| Discovery | `engine=google_jobs` | `q=<role>`, `location=<city>, India`, `gl=in`, `hl=en`, up to 2 pages via `next_page_token` | Job listings (`jobs_results[]`) |
| VERIFY | `engine=google` | Per top-5 job: `"<company>" "<title>"` and `"<company>" <city>` | Independent company/role/location evidence |
| News context | `engine=google_news` | Per top-3 job: `"<company>" <city>` | Recent headlines with dates/sources |
| Selection process | `engine=google` | Per top-3 job: `"<company>" "<title>" interview experience` + `"<company>" interview process freshers` | Candidate-reported interview stages (never scraped, only search results) |

Credit bounds per search: cold ≤21 calls (2 jobs + ≤10 evidence + ≤3 news +
≤6 interviews),
warm 0 (SQLite cache: jobs 24h, evidence/news 7d). Every attempt is logged to
`api_usage`, viewable at `/debug/usage`. Details: `docs/research.md`
(verified params/responses), `docs/verification.md` (evidence rules).

## Tech stack

Python, FastAPI, SQLAlchemy, SQLite, Pydantic v2, Jinja2, vanilla CSS/JS,
httpx, pytest. No LLM, no vector DB, no frontend framework — by design.
>>>>>>> e9c6929019e324b5af53fa75f10210ec7f411830

## Architecture

```mermaid
flowchart TD
<<<<<<< HEAD
    Browser --> Pages[Cloudflare Pages\nReact + Vite + Tailwind]
    Pages --> Worker[Cloudflare Worker\nREST API + Auth + RBAC/PBAC]
    Worker --> D1[(Cloudflare D1\nsource of truth)]
    Worker --> R2[(Cloudflare R2\nresumes)]
    Worker --> KV[(Cloudflare KV\ndashboard cache 60s)]
    Worker --> Logs[Workers Logs\nwrangler tail]
```

- One Worker, one D1 database, one R2 bucket, one KV namespace. No microservices.
- No external job provider: the Tracker is fully self-contained.
- KV caches `dashboard:{userId}` for 60s; D1 is always the source of truth; mutations invalidate the cache.
- Observability via `console.log` in the Worker, read with `wrangler tail`.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 3, React Router 6 |
| Backend | Cloudflare Workers, TypeScript, vanilla REST router (no framework) |
| DB | Cloudflare D1 (SQLite), SQL migrations |
| Files | Cloudflare R2 (Worker-only access) |
| Cache | Cloudflare KV (dashboard stats) |
| Tooling | Wrangler 3, Vitest, GitHub Actions |

## Database Schema

Tables: `users`, `sessions`, `applications`, `interviews`, `notes`, `resumes` — UUID PKs, FKs with `ON DELETE CASCADE/SET NULL`, `created_at/updated_at` timestamps, indexes in `migrations/0002_indexes.sql`.

```
users(id, email UNIQUE, password_hash, name, role DEFAULT 'student', created_at, updated_at)
sessions(id, user_id FK, token_hash UNIQUE, expires_at, created_at)
resumes(id, user_id FK, filename, content_type, size, r2_key UNIQUE, created_at)
applications(id, user_id FK, company, job_title, location, job_url, job_type, salary,
  application_date, status, notes, contact_person, contact_email,
  follow_up_date, follow_up_reminder, follow_up_notes, resume_id FK NULL,
  jobsetu_job_id INT NULL (historical provider provenance; partial UNIQUE(user_id, jobsetu_job_id)), timestamps)
interviews(id, user_id FK, application_id FK, interview_type, scheduled_at, interviewer, meeting_url, notes, result, timestamps)
notes(id, user_id FK, application_id FK, content, timestamps)
```

## API Endpoints

Consistent envelope: `{ "success": true, "data": … }` / `{ "success": false, "error": { "code", "message", "details?" } }`.

```
POST /api/auth/register   POST /api/auth/login   POST /api/auth/logout   GET /api/auth/me
POST /api/auth/forgot-password   POST /api/auth/reset-password
GET  /api/applications?search=&status=&job_type=&date_from=&date_to=&sort=newest|oldest&page=&limit=
POST /api/applications
GET  /api/applications/:id   PUT /api/applications/:id   DELETE /api/applications/:id
GET  /api/interviews?application_id=&upcoming=true   POST /api/interviews
PUT  /api/interviews/:id   DELETE /api/interviews/:id
GET  /api/notes?application_id=   POST /api/notes
PUT  /api/notes/:id   DELETE /api/notes/:id
POST /api/resumes (multipart `file`)   GET /api/resumes
GET  /api/resumes/:id   GET /api/resumes/:id/download   DELETE /api/resumes/:id
GET  /api/dashboard
GET  /api/admin/users   PUT /api/admin/users/:id/role   (admin only)
GET  /api/health
```

## Local Development

Prereqs: Node 20+, `npm`, Wrangler (`npx wrangler --version`).

```bash
# 1. Install
npm install --workspaces
# or: (cd worker && npm install) && (cd frontend && npm install)

# 2. Configure local secrets (placeholders only in repo)
cp worker/.dev.vars.example worker/.dev.vars
cp frontend/.env.example frontend/.env
cp .env.example .env   # reference only

# 3. Create local Cloudflare resources (one-time)
npx wrangler d1 create student_job_tracker      # paste database_id into worker/wrangler.toml
npx wrangler r2 bucket create job-tracker-resumes
npx wrangler kv namespace create CACHE

# 4. Run migrations locally
(cd worker && npm run db:migrate:local)

# 5. Start API + frontend (two terminals — no other services needed)
(cd worker && npx wrangler dev)     # http://127.0.0.1:8787
(cd frontend && npm run dev)        # http://localhost:5173 (proxies /api to :8787)

# 6. Verify
(cd worker && npm test && npm run typecheck)
(cd frontend && npm run typecheck && npm run build)
```

R2 locally works via Wrangler dev (persists under `.wrangler/`); KV cache is optional — the API works without the `CACHE` binding.

## Cloudflare Setup

1. `npx wrangler login`
2. `npx wrangler d1 create student_job_tracker` → set `database_id` in `worker/wrangler.toml`.
3. `npx wrangler d1 migrations apply student_job_tracker --remote` (runs `migrations/`).
4. `npx wrangler r2 bucket create job-tracker-resumes`.
5. `npx wrangler kv namespace create CACHE` → set `id` in `worker/wrangler.toml`.
6. Set secrets: `npx wrangler secret put SESSION_SECRET` (and `FRONTEND_ORIGIN` as var/secret to your Pages URL).
7. Deploy API: `(cd worker && npm run deploy)`.
8. Deploy frontend: set `VITE_API_URL=https://<worker>.workers.dev` in Pages env, then `npx wrangler pages deploy frontend/dist --project-name=student-job-tracker` (or connect the GitHub repo in the Pages dashboard).
9. Observe: `npx wrangler tail` (Workers Logs).

## Environment Variables

| Var | Where | Purpose |
|---|---|---|
| `SESSION_SECRET` | Worker secret / `.dev.vars` | reserved for future signed cookies (sessions currently opaque random tokens, SHA-256 hashed in D1) |
| `FRONTEND_ORIGIN` | Worker var | CORS allow-origin (Pages URL in prod, `http://localhost:5173` locally) |
| `SERPAPI_API_KEY` | Worker secret / `.dev.vars` | SerpApi key for native Discover Jobs. Server-side only — never sent to the browser, never logged, never committed. Unset = live search returns 503 (history/pagination of stored searches still work) |
| `VITE_API_URL` | Pages env / `frontend/.env` | Worker URL; empty = same-origin/Vite proxy |

See `.env.example`, `worker/.dev.vars.example`, `frontend/.env.example`. Never commit real values.

## D1 Migrations

- `migrations/0001_initial.sql` — tables + FKs.
- `migrations/0002_indexes.sql` — indexes for user-scoped filtering/sorting.
- `migrations/0003_jobsetu_provenance.sql` — `jobsetu_job_id` + partial unique index (non-destructive backfill; conflicting pre-existing rows keep NULL and are never deleted/merged).
- `migrations/0004_rbac.sql` — `users.role` (`student` default; existing users stay students) + index.
- `migrations/0005_password_resets.sql` — `password_resets` (selector/token-hash only, 1h expiry, cascade on user delete).
- `migrations/0006_discover.sql` — `discover_searches` (per-user history + normalized result snapshots) and `applications.provider` / `provider_job_id` with a partial unique index (native dedup; `jobsetu_job_id` untouched).
- Never edit prod schema by hand: add `migrations/0005_*.sql` and `wrangler d1 migrations apply … --remote`.

## R2 Setup

- Binding `RESUMES` → bucket `job-tracker-resumes`. Frontend never sees credentials; it POSTs `multipart/form-data` to the Worker, which validates (MIME allow-list pdf/doc/docx/txt, ≤5 MB, sanitized filename) and `PUT`s to `r2_key = {userId}/{resumeId}-{filename}`. Metadata row goes to D1. Download streams via `GET /api/resumes/:id/download` after ownership check. Delete removes R2 object + D1 row and nulls `applications.resume_id`.

## Information architecture (post sign-in)

Public landing (`/`) explains the product with Sign In / Sign Up actions (`/sign-in`, `/sign-up`; legacy `/login`, `/register` redirect). Sign-in is the gateway; logout returns to `/`. The first authenticated screen is a **career command center**, not an analytics dashboard:

- **Home** (`/home`; `/dashboard` redirects here): greeting, three action cards (My Applications, Interviews, Resumes), a Saved → Applied → Interview → Offer pipeline strip, a Next-action card (overdue follow-up first, else most recent Saved), Continue-where-you-left-off, and Upcoming interviews. Metrics are secondary.
- **Discover Jobs** (`/discover`; legacy `/discover-jobs` redirects here): native job search powered server-side by SerpApi (`SERPAPI_API_KEY`, never exposed to the browser). Search by role/keywords, location, and experience; previous-search history; inline details with Apply links; server-side Save/Track with duplicate protection (`409 Already tracked` links the existing application).
- **Applications** (`/applications`): the tracking workspace. Previously imported rows carry an `Imported` source badge (detected from the import note).
- **Interviews**, **Resumes** (`/resumes`): dedicated workspaces; R2 stays Worker-only, metadata in D1.
- **Profile** (`/profile`): account info, role + permission summary, sign-in security. Opened from the header avatar.
- **Admin** (`/admin`, admin role only, backend-enforced): user list with role management (self-change blocked server-side).
- **Settings**: account, session info, integration configuration.

Journey: Sign in → Home → Applications (New application) → Apply → Track → Interview → Offer. Everything is created and tracked directly in JobTracker.

## Job discovery (native, SerpApi-backed)

Discover Jobs is a built-in JobTracker feature: `Browser → JobTracker UI → JobTracker Worker → SerpApi`.
There is no separate provider service and no `JOBSETU_*` configuration. The browser
never contacts SerpApi; the key (`SERPAPI_API_KEY`) lives only in Worker config and
travels exclusively on the server-side outbound call. Identical recent searches are
cached in KV for 24h (payloads carry no user data); per-user search history lives in
`discover_searches`. Saving reuses the shared application insert, so the same native
job can never create two rows for one user (`409 Already tracked` + existing id).

## Historical provider provenance

Earlier versions integrated an external job provider ("JobSetu") for a Discover
Jobs page (`/api/discover/*`, `/discover-jobs`). That integration has been
removed: the provider is no longer required, no browser or Worker code contacts
it, and there is no `JOBSETU_*` configuration anymore. Only two terminals are
needed locally (Worker `:8787`, frontend `:5173`).

What remains, intentionally:

- `applications.jobsetu_job_id` + the partial unique index from migration `0003`
  still protect previously imported rows — saving the same provider reference
  twice via `POST /api/applications` returns `409` with the existing application
  id. The column is never written by any UI anymore.
- Historical duplicate rows (same provider job, `jobsetu_job_id` NULL from the
  non-destructive 0003 backfill) are preserved untouched.
- The dashboard's `discoveryImports` counts rows carrying that provenance; it is
  a historical count, not a live metric.

Run locally: Worker on `:8787`, frontend on `:5173`. No provider service needed.

### Deploying on other machines / production

No ports are hardcoded — every URL is env-configured:

| Where | Variable | Local default | Production value |
|---|---|---|---|
| Pages (frontend build) | `VITE_API_URL` | empty (Vite proxy → `:8787`) | `https://<worker>.<subdomain>.workers.dev` |
| Worker | `FRONTEND_ORIGIN` | `http://localhost:5173` | `https://<pages>.pages.dev` |

Gotchas:
- `VITE_*` vars are baked in at **build** time — set them in the Pages dashboard *before* building, and rebuild after changing them.
- On another dev machine on the same network, replace `localhost`/`127.0.0.1` with the host's LAN IP in all places (and in `worker/.dev.vars`).

## CI/CD

- `.github/workflows/ci.yml` — on PR/push: install, worker typecheck + tests, frontend typecheck + tests + build.
- `.github/workflows/deploy.yml` — on `main`: same checks, then `wrangler deploy` + `wrangler pages deploy`. Required secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Security Considerations

- PBKDF2-SHA256 (100k iterations, random 16-byte salt, constant-time verify); no plaintext passwords anywhere.
- Opaque 256-bit session tokens; only SHA-256 hashes stored; 7-day expiry; `HttpOnly; SameSite=Lax; Secure (https)` cookie + Bearer fallback.
- Auth middleware on every `/api/*` (except register/login/health); **every** query is scoped `WHERE user_id = ?`; IDs from the client are never trusted (ownership re-checked for nested resources, e.g. interview → application).
- RBAC (`worker/src/authz.ts`): central `ROLE_PERMISSIONS` (`student` / `admin`); every protected route declares its permission in `index.ts` (401 unauthenticated, 403 forbidden). PBAC `can(user, action, resource)` enforces ownership — students only touch their own rows; `user_id` from request bodies is ignored (server identity is authoritative).
- Admin endpoints (`GET /api/admin/users`, `PUT /api/admin/users/:id/role`) require `users.manage`; self-role-change is rejected.
- All SQL parameterized via `prepare().bind()`; no string interpolation.
- Input validation on both sides; centralized error handler (500s never leak stacks/DB errors; diagnostics go to Workers Logs).
- CORS allow-listed to `FRONTEND_ORIGIN`; rate-limit on auth endpoints (KV-backed, fail-open if KV missing).
- File validation: MIME + extension allow-list, 5 MB cap, filename sanitization, per-user R2 prefix.

## Future Improvements

- Refresh-token rotation + password reset via email.
- Full-text search (FTS5) and saved filters.
- Resume parsing (PDF text extraction) + application-resume matching.
- Email/push reminders for follow-ups (Queues + scheduled cron).
- E2E tests (Playwright) and preview deployments per PR.

## Project Structure

```
project/
├── frontend/src/{components,pages,hooks,services,types,utils}
├── worker/src/{routes,middleware,validation,utils,db} + index.ts
├── worker/tests/  migrations/  docs/competitive-analysis.md  .github/workflows/
├── README.md  .gitignore  package.json
```

Frontend tests (`frontend/src/**/*.test.tsx`, vitest + jsdom + Testing Library) cover the Home command center, auth-gated routing (`/home` blocked when logged out, `/dashboard` → `/home`, retired discover URLs → `/home`), the navigation drawer (backdrop/Escape/nav-close, admin visibility) + footer, profile/admin pages, and permissions helpers.
=======
    Browser --> FastAPI["FastAPI routes\n(thin: parse, call, render)"]
    FastAPI --> Services["Services\nSerpApiClient · JobSearch · Dedup · Matcher · Evidence · News · Cache"]
    Services --> SQLite[("SQLite\njobs · evidence · matches · cache")]
    Services --> SerpApi["SerpApi"]
    SerpApi --> Jobs["Google Jobs\n(discovery)"]
    SerpApi --> Search["Google Search\n(evidence)"]
    SerpApi --> News["Google News\n(context)"]
```

Flow: Browser → FastAPI routes → services → SQLAlchemy → SQLite.
Details: `docs/architecture.md`. Verification rules: `docs/verification.md`.
Matching formula: `docs/matching.md`. Demo tour: `docs/demo.md`.

## Prerequisites

- Python 3.12+ (`python --version`)
- `pip`
- A SerpApi key for live data ([free plan: 250 searches/month](https://serpapi.com/users/sign_up?plan=free&utm_source=india_hackathon_26)).
  Without a key the app still boots and all tests pass, but live search
  returns a friendly "not configured" page instead of fake data.

## Installation

```powershell
git clone https://github.com/AbhiramMandala/jobsetu.git
cd jobsetu
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Then add your key to `.env` (never commit it):

```
SERPAPI_KEY=your-key-here
```

## Environment variables

| Name | Default | Notes |
|---|---|---|
| `SERPAPI_KEY` | empty | Server-side only. Required for live search. |
| `DATABASE_URL` | `sqlite:///./jobsetu.db` | Local SQLite file. |
| `EVIDENCE_MAX_JOBS` | `5` | Top-N jobs enriched per search (credit control). |
| `NEWS_MAX_JOBS` | `3` | Top-N jobs with news context (credit control). |
| `ENABLE_NEWS` | `false` | Reserved P1 flag. |
| `ENABLE_MAPS` | `false` | Reserved P1 flag. |
| `ENABLE_TRENDS` | `false` | Reserved P1 flag. |
| `ENABLE_PDF` | `false` | Reserved P1 flag. |

## Running locally

```powershell
python -m uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000`, create your profile at `/profile`
(or use the labeled sample-data prefill), then fill role + location and
press Find jobs. Match scores appear only when a profile exists.

Warm the demo cache first (recommended for demos — instant, zero calls):

```powershell
python -m app.demo_seed
```

Requires `SERPAPI_KEY`. Runs the demo search end-to-end, creates the sample
profile if none exists, warms jobs + evidence + news caches, and prints
measured request counts and elapsed time.

Check health (secret-free): `GET /health` → `{"status": "ok"}`.

Run tests (SerpApi mocked — no key needed):

```powershell
python -m pytest
```

88 passed.

## Example workflow

1. Create a profile at `/profile`: Python, FastAPI, Django, PostgreSQL, Git.
2. Search `Python Backend Developer` in `Hyderabad` as `Fresher`.
3. Note the pipeline counts ("N listings → M duplicates removed → K unique")
   and the LIVE/CACHED badge.
4. Open the top card: match score + breakdown, matched vs missing skills.
5. Click VIEW EVIDENCE: 2–3 cited Google Search sources with queries and
   retrieval times behind the VERIFY badge.
6. Read NEWS CONTEXT (e.g. funding/expansion with source + date), then the
   "What should I learn next?" panel. Apply or learn the missing skill first.

## Screenshots / demo

Real UI captures (no demo data fabricated; profile shows clearly-labeled
sample data):

- `docs/screenshots/01-landing.png` — search form
- `docs/screenshots/02-profile.png` — profile with labeled sample prefill
- `docs/screenshots/03-usage.png` — dev credit dashboard
- `docs/screenshots/results.png` — search form (landing, live-seeded DB)
- `docs/screenshots/profile.png` — profile page with demo fresher data
- `docs/screenshots/usage-live.png` — live-seeded results page: 19 listings,
  CACHED badge, 63% top MATCH, VERIFY supporting evidence, skill gaps

Evidence-detail and `/debug/usage` captures are optional extras.
Demo script (2:45, video intentionally skipped): `docs/demo.md`.

## Project structure

```
app/
  main.py            # FastAPI entrypoint (create_app)
  config.py          # env-based settings (SERPAPI_KEY never hardcoded)
  database.py        # SQLite engine/session, health check
  demo_seed.py       # python -m app.demo_seed warm-cache command
  data/skills.py     # curated skill vocabulary + extractor
  models/            # SQLAlchemy: jobs, companies, evidence, matches, cache
  schemas/           # Pydantic: JobItem, organic/news result parsers
  services/          # serpapi_client, job_search, deduplicator, matcher,
                     # evidence, news, normalizer, cache
  routes/            # health, pages, search, evidence, profile, debug
  templates/ + static/
tests/               # 88 tests, SerpApi fully mocked
docs/                # architecture, matching, verification, research, demo…
Dockerfile  .dockerignore  requirements.txt  .env.example
```

## API / search flow

`POST /search` (form: `role`, `location`, `experience`) is the fast path —
discovery only, then renders useful cards immediately:
1. Validate input (empty → friendly 400 on the form, no traceback).
2. Cache lookup (SQLite, 24h). Hit → render CACHED with age, 0 SerpApi calls.
3. Miss → `SerpApiClient.google_jobs` (≤2 pages) → normalize → source-key
   upsert → TF-IDF fuzzy dedup → skill extraction → deterministic match
   refresh → commit pipeline counts. Deduplication always precedes any
   expensive work.
4. Pure derivations inline (no HTTP): authenticity score, company-type
   estimate. Cards render with loading placeholders for deep sections.
5. The page then fetches `GET /api/enrich/{verify,news,interview}?search_id=N`
   in parallel; each endpoint is cache-first under the existing caps and
   renders server-side partials (or honest unavailable states). A fresh
   search loads a new page, abandoning in-flight enrichment automatically.
6. Failure anywhere → stale cache with warning banner; no stale cache →
   friendly 503. Never fake data. Optional-enrichment failure never breaks
   the core search. Details: `docs/performance.md`.

## Selection process

Each card also shows a SELECTION PROCESS section built only from
SerpApi organic-search results — JobSetu never scrapes review sites and
never bypasses logins, CAPTCHAs, paywalls, or robots rules. Interview stages
(online assessment, technical, HR, …) carry per-stage report counts
("reported in 3 of 5 available candidate reports"); single-report stages are
labeled anecdotal, and everything is marked candidate-reported — never
official company policy. Every stage links to its sources for inspection.
Details, taxonomy, and limits: `docs/interviews.md`.

## Appearance & tools

- **Light/dark theme:** toggle in the header (sun/moon button), persisted in
  `localStorage`, falls back to the OS `prefers-color-scheme` setting, applied
  before first paint (no flash), and disabled animation under
  `prefers-reduced-motion`. Every surface uses CSS variables.
- **Useful Tools page** (`/tools`): a small curated set of career/developer
  resources with search + category filters (including `?q=` presets, used by
  per-topic "Practice in Useful Tools" links); external links open safely in
  a new tab. Curated starter set — not scraped from anywhere.
- **Results filters:** verification-status and company-type filters work
  instantly on rendered cards (client-side, zero extra searches).
- **Role intelligence:** each card links to its evidence page with company
  facts (type estimate + confidence, official site), role skills, interview
  prep topics with report counts, selection process, news, and sources.

## Credit visibility

`/debug/usage` (dev-only, no auth) shows real per-engine call counts,
cache entries, and stored rows. The API key is never displayed.

## Deployment

```powershell
# Environment (never commit .env)
SERPAPI_KEY=<key>            # required for live data
DATABASE_URL=sqlite:////data/jobsetu.db
EVIDENCE_MAX_JOBS=5
NEWS_MAX_JOBS=3
PORT=8000
```

Docker (SQLite persisted on a volume):

```powershell
docker build -t jobsetu .
docker run -p 8000:8000 -e SERPAPI_KEY=<key> -v jobsetu-data:/data jobsetu
```

Or any Python host (Render/Railway/HF Spaces): install requirements,
set env vars, serve `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
Health: `GET /health` (no secrets). Then warm the demo:
`python -m app.demo_seed`.

Status: Dockerfile + `.dockerignore` ready; image build and platform deploy
not yet executed (no Docker daemon/credentials in this environment).

## Matching

Deterministic and explainable: Skills 50 + Title 20 + Experience 15 +
Location 10 + Type 5 = 100. Same candidate + same job always gives the same
score. Missing data yields neutral sub-scores with explicit flags, never
fake precision. Full formula, weights, and limitations: `docs/matching.md`.

## Verification

Each search enriches the top-`EVIDENCE_MAX_JOBS` listings with live Google
Search evidence (cached 7 days): official-site detection, company/role
presence, location support. Statuses are Supporting evidence, Needs
verification, or Warning signals — no numeric trust scores, and every claim
links to its source on `GET /jobs/{id}/evidence`. Rules and limitations:
`docs/verification.md`.

## Job Authenticity

Each card also carries an evidence-based authenticity score (0–100) with
explained signals — and a clear statement of what the score is NOT:

- **What it checks:** company verification, job-post consistency across
  independent sources, application-channel signals (official domain vs free
  email / WhatsApp / Telegram / fee requests), and suspicious content patterns
  (guaranteed income, no interview, urgency pile-ups).
- **What it means:** 90+ Strong supporting evidence · 75+ Higher confidence ·
  50+ Mixed — verify · 25+ Significant risk signals · 0–24 High risk — verify
  carefully. UI categories, not fraud probabilities.
- **What it does NOT mean:** it never claims a job is real/fake, legitimate/
  fraudulent, or guaranteed anything. Scores without independent evidence are
  capped at 49 and say so.
- **SerpApi role:** the analyzer reuses already-stored SerpApi evidence and
  makes zero new calls (no credit cost). Structured output:
  `GET /jobs/{id}/authenticity`. Full formula: `docs/authenticity.md`.

> "This score is an evidence-based risk indicator, not a guarantee that a job
> is legitimate or fraudulent. Always verify the employer and application
> channel before sharing sensitive information or making payments."

## Limitations

- Closed skill vocabulary (curated list; misses niche/brand-new skills).
- Keyword-based experience/news parsing (can misread unusual phrasing).
- Website heuristic can misfire on single-token company names.
- Small employers with little web presence may show "needs verification"
  (wording guards against overreach; never claims scam/fake/safe).
- Cold searches are sequential (~21 calls max); warm is instant.
- Plain server-rendered visuals; no maps/trends depth, alerts, or LLM
  explanations.

## Future improvements

- Maps/Trends depth behind the existing `ENABLE_*` flags.
- Search alerts for new matching listings.
- Larger/industry-specific skill vocabularies.
- LLM-generated match explanations (deterministic scores stay as-is).

## Hackathon information

- Event: SerpApi India Hackathon 2026 — "Build with Live Search Data"
  (Sep 1–Oct 10, 2026; deadline Oct 10, 2026 23:59 IST).
- Track: **Knowledge & Public Interest** — official track keywords explicitly
  include jobs, news, research, and education; JobSetu is a jobs + news-literacy
  tool for Indian freshers.
- Entry: solo contributor (Abhiram Mandala).
- Submission docs: `HACKATHON_SUBMISSION.md` (full package),
  `SUBMISSION_FORM_DRAFT.md` (copy-paste form answers), `docs/demo.md` (2:45 demo).
- Disclosures: project built during the hackathon window (see git history);
  AI assistance used (OpenCode + ChatGPT, see `HACKATHON_SUBMISSION.md`).
>>>>>>> e9c6929019e324b5af53fa75f10210ec7f411830
