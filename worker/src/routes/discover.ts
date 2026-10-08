import { JOB_TYPES, type AuthUser, type Env } from "../types";
import { fail, json, readJson, log } from "../utils/response";
import { sha256Hex } from "../utils/crypto";
import { newId } from "../utils/crypto";
import { validateDiscoverSearch } from "../validation/schemas";
import { serpApiGoogleJobs } from "../services/serpapi";
import { insertApplicationRow } from "./applications";

/**
 * Native Discover Jobs (SerpApi-backed, no external provider service).
 *
 *   Browser -> JobTracker Worker -> SerpApi
 *
 * Every endpoint requires auth + the jobs.discover permission (save additionally
 * requires applications.create). Search history and result snapshots are
 * per-user Tracker rows; cached SerpApi payloads in KV carry no user data.
 */

const CACHE_TTL_SEC = 24 * 60 * 60; // identical recent searches reuse results
const STORE_MAX_JOBS = 30;
const PAGE_DEFAULT = 20;
const PAGE_MAX = 50;
const PROVIDER_NAME = "serpapi";

export interface DiscoveredJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  apply_url: string;
  source: string;
  posted_at: string;
  salary: string;
  employment_type: string;
  remote: boolean | null;
}

function str(v: unknown, max = 500): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** FNV-1a fallback identity for listings without a provider job_id.
 *  Internal dedup key only — never displayed as a provider fact. */
function fallbackId(title: string, company: string, location: string, via: string): string {
  let h = 0x811c9dc5;
  const s = `${title}|${company}|${location}|${via}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `listing-${(h >>> 0).toString(16)}`;
}

function firstHttpUrl(v: unknown): string {
  const list = Array.isArray(v) ? v : [v];
  for (const item of list) {
    const u = typeof item === "string" ? item : (item as Record<string, unknown>)?.link;
    if (typeof u !== "string" || !u) continue;
    try {
      const parsed = new URL(u);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return u.slice(0, 2000);
    } catch {
      continue;
    }
  }
  return "";
}

function mapEmploymentType(schedule: string): string {
  const t = schedule.toLowerCase();
  if (t.includes("full")) return "FULL_TIME";
  if (t.includes("part")) return "PART_TIME";
  if (t.includes("intern")) return "INTERNSHIP";
  if (t.includes("contract")) return "CONTRACT";
  return "";
}

/** Normalize one SerpApi google_jobs item. Only fields SerpApi actually
 *  provides; everything else stays empty — never fabricated. */
export function normalizeSerpApiJob(j: unknown): DiscoveredJob | null {
  if (typeof j !== "object" || j === null || Array.isArray(j)) return null;
  const r = j as Record<string, unknown>;
  const title = str(r.title, 200);
  const company = str(r.company_name, 200);
  if (!title && !company) return null;
  const location = str(r.location, 200);
  const via = str(r.via, 200);
  const rawId = str(r.job_id, 200);
  const id = rawId || fallbackId(title, company, location, via);
  const det = (typeof r.detected_extensions === "object" && r.detected_extensions !== null
    ? (r.detected_extensions as Record<string, unknown>)
    : {});
  const applyOpts = Array.isArray(r.apply_options) ? r.apply_options : [];
  const applyUrl = firstHttpUrl(applyOpts.map((o) => (typeof o === "object" && o !== null ? (o as Record<string, unknown>).link : null)));
  const wfh = det.work_from_home;
  return {
    id,
    title,
    company,
    location,
    description: str(r.description, 4000),
    apply_url: applyUrl,
    source: via || str((applyOpts[0] as Record<string, unknown> | undefined)?.title, 200),
    posted_at: str(det.posted_at, 100),
    salary: str(det.salary, 200),
    employment_type: mapEmploymentType(str(det.schedule_type, 100)),
    remote: wfh === true ? true : wfh === false ? false : null,
  };
}

function cacheKey(input: { role: string; location: string; experience: string }): Promise<string> {
  return sha256Hex(`discover:v1|${input.role.toLowerCase()}|${input.location.toLowerCase()}|${input.experience.toLowerCase()}`);
}

function parsePageLimit(url: URL): { page: number; limit: number } | Response {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const rawLimit = Number(url.searchParams.get("limit") ?? String(PAGE_DEFAULT)) || PAGE_DEFAULT;
  const limit = Math.min(PAGE_MAX, Math.max(1, rawLimit));
  if (!Number.isFinite(page) || !Number.isFinite(limit)) return fail("VALIDATION_ERROR", "Invalid pagination", 400);
  return { page, limit };
}

function paginate(jobs: DiscoveredJob[], page: number, limit: number) {
  const total = jobs.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;
  return { items: jobs.slice(start, start + limit), pagination: { page: safePage, limit, total, totalPages } };
}

async function getOwnedSearch(env: Env, user: AuthUser, searchId: string): Promise<{ id: string; results: DiscoveredJob[] } | Response> {
  if (!searchId) return fail("VALIDATION_ERROR", "A valid search id is required", 400);
  const row = await env.DB.prepare(`SELECT id, results_json FROM discover_searches WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(searchId, user.id)
    .first<{ id: string; results_json: string }>();
  if (!row) return fail("NOT_FOUND", "Search not found", 404);
  let results: DiscoveredJob[] = [];
  try {
    const parsed: unknown = JSON.parse(row.results_json ?? "[]");
    if (Array.isArray(parsed)) results = parsed.filter((j): j is DiscoveredJob => typeof j === "object" && j !== null && typeof (j as DiscoveredJob).id === "string");
  } catch {
    results = [];
  }
  return { id: row.id, results };
}

/** POST /api/discover/search {role, location?, experience?} */
export async function runSearch(req: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = await readJson<any>(req);
  const { errs, input } = validateDiscoverSearch(body ?? {});
  if (errs.length) return fail("VALIDATION_ERROR", "Invalid search", 400, errs);

  const key = await cacheKey(input);
  let jobs: DiscoveredJob[] | null = null;
  let cached = false;
  if (env.CACHE) {
    try {
      const hit = await env.CACHE.get(`discover:${key}`, "json");
      if (hit && typeof hit === "object" && Array.isArray((hit as { jobs?: unknown }).jobs)) {
        jobs = ((hit as { jobs: unknown[] }).jobs as DiscoveredJob[]).filter((j) => typeof j?.id === "string");
        cached = true;
      }
    } catch {
      jobs = null;
    }
  }

  if (!jobs) {
    const upstream = await serpApiGoogleJobs(env.SERPAPI_API_KEY, { role: input.role, location: input.location });
    if (!upstream.ok) {
      log(req, env, "discover upstream failure:", upstream.failure.kind);
      return fail("UPSTREAM_UNAVAILABLE", "Job discovery is temporarily unavailable. Please try again.", 503);
    }
    jobs = upstream.jobs.map(normalizeSerpApiJob).filter((j): j is DiscoveredJob => j !== null);
    if (env.CACHE) {
      await env.CACHE.put(`discover:${key}`, JSON.stringify({ jobs }), { expirationTtl: CACHE_TTL_SEC }).catch(() => {});
    }
  }

  const stored = jobs.slice(0, STORE_MAX_JOBS).map((j) => ({ ...j, description: j.description.slice(0, 1500) }));
  const searchId = newId();
  await env.DB.prepare(
    `INSERT INTO discover_searches (id, user_id, role, location, experience, job_count, results_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(searchId, user.id, input.role, input.location, input.experience, jobs.length, JSON.stringify(stored), new Date().toISOString())
    .run();

  const { items, pagination } = paginate(jobs, 1, PAGE_DEFAULT);
  return json({ search_id: searchId, jobs: items, pagination, meta: { cached } });
}

/** GET /api/discover/searches — own history, newest first. */
export async function listSearches(_req: Request, env: Env, user: AuthUser): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, role, location, experience, job_count, created_at FROM discover_searches WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
  )
    .bind(user.id)
    .all();
  return json({ searches: results ?? [] });
}

/** GET /api/discover/jobs?search_id=&page=&limit= */
export async function listJobs(req: Request, env: Env, user: AuthUser): Promise<Response> {
  const url = new URL(req.url);
  const owned = await getOwnedSearch(env, user, url.searchParams.get("search_id") ?? "");
  if (owned instanceof Response) return owned;
  const pl = parsePageLimit(url);
  if (pl instanceof Response) return pl;
  const { items, pagination } = paginate(owned.results, pl.page, pl.limit);
  return json({ search_id: owned.id, jobs: items, pagination });
}

/** GET /api/discover/jobs/:searchId/:jobId — details from the stored snapshot. */
export async function getJob(_req: Request, env: Env, user: AuthUser, searchId: string, jobId: string): Promise<Response> {
  const owned = await getOwnedSearch(env, user, searchId);
  if (owned instanceof Response) return owned;
  const job = owned.results.find((j) => j.id === jobId);
  if (!job) return fail("NOT_FOUND", "Job not found", 404);
  return json(job);
}

/** POST /api/discover/jobs/:searchId/:jobId/save — server-side Save/Track. */
export async function saveJob(_req: Request, env: Env, user: AuthUser, searchId: string, jobId: string): Promise<Response> {
  const owned = await getOwnedSearch(env, user, searchId);
  if (owned instanceof Response) return owned;
  const job = owned.results.find((j) => j.id === jobId);
  if (!job) return fail("NOT_FOUND", "Job not found", 404);

  const created = await insertApplicationRow(env, user, {
    company: job.company || "Unknown company",
    job_title: job.title || "Untitled role",
    location: job.location,
    job_url: job.apply_url,
    ...(job.employment_type && (JOB_TYPES as readonly string[]).includes(job.employment_type) ? { job_type: job.employment_type } : {}),
    salary: job.salary,
    application_date: new Date().toISOString().slice(0, 10),
    status: "SAVED",
    notes: [`Saved from Discover Jobs${job.source ? ` (source: ${job.source})` : ""}.`, job.description.slice(0, 500)].filter(Boolean).join("\n\n"),
    provider: { name: "serpapi", job_id: job.id },
  });
  if (created.status === 409) {
    let existingId: string | undefined;
    try {
      existingId = ((await created.json()) as any)?.error?.details?.application_id;
    } catch {
      existingId = undefined;
    }
    return fail("CONFLICT", "Already tracked", 409, existingId ? { application_id: existingId } : undefined);
  }
  return created;
}
