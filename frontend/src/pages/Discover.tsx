import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookmarkCheck, Compass, Search } from "lucide-react";
import { api } from "../services/api";
import { staggerIn } from "../animations/anime";
import { MatchRing } from "../components/MatchRing";
import { EmptyState, PageHeader, RowSkeleton, inputCls } from "../components/ui";

const JOBSETU_URL = (import.meta.env.VITE_JOBSETU_URL as string | undefined) || "http://127.0.0.1:8000";
const LAST_SEARCH_KEY = "jt-discover-last";

interface JobSignals {
  experience: string;
  min_years: number | null;
  job_type: string;
}

interface JobSetuJob {
  id: number;
  company: string;
  title: string;
  location: string;
  apply_link: string;
  salary: string;
  posted: string;
  description_snippet: string;
  match_total: number | null;
  signals?: JobSignals;
  evidence_url?: string;
  match?: { total: number; matched_skills: string[]; missing_skills: string[]; reasons: string[] };
}

interface JobSetuSearch {
  id: number;
  role: string;
  location: string;
  experience: string;
  job_count: number;
  retrieved_at: string | null;
}

const LOCATIONS = ["Hyderabad", "Bengaluru", "Chennai", "Remote (India)"];
const EXPERIENCES = ["Fresher", "Entry-level (0–1 years)", "Experienced (2+ years)"];
const TYPE_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "fulltime", label: "Full-time" },
  { value: "contract", label: "Contract" },
  { value: "parttime", label: "Part-time" },
  { value: "internship", label: "Internship" },
];

function expLabel(e: string | undefined): string | null {
  if (e === "entry") return "Entry-level";
  if (e === "experienced") return "Experienced";
  return null;
}

function typeLabel(t: string | undefined): string | null {
  const v = normJobType(t);
  if (v === "fulltime") return "Full-time";
  if (v === "contract") return "Contract";
  if (v === "parttime") return "Part-time";
  if (v === "internship") return "Internship";
  return null;
}

function normJobType(t: string | undefined): string {
  return (t ?? "").toLowerCase().replace(/[\s_\-]+/g, "");
}

export function DiscoverPage({ notify }: { notify: (m: string) => void }) {
  const [form, setForm] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAST_SEARCH_KEY) ?? "{}");
      return {
        role: String(saved.role ?? ""),
        location: LOCATIONS.includes(saved.location) ? saved.location : "Hyderabad",
        experience: EXPERIENCES.includes(saved.experience) ? saved.experience : "Fresher",
      };
    } catch {
      return { role: "", location: "Hyderabad", experience: "Fresher" };
    }
  });
  const [expFilter, setExpFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("any");
  const [searches, setSearches] = useState<JobSetuSearch[] | null>(null);
  const [searchesError, setSearchesError] = useState(false);
  const [searchId, setSearchId] = useState("");
  const [jobs, setJobs] = useState<JobSetuJob[] | null>(null);
  const [searchMeta, setSearchMeta] = useState<{ live: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [savedApps, setSavedApps] = useState<Record<number, string>>({});
  const [detailId, setDetailId] = useState<number | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${JOBSETU_URL}/api/searches`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((body) => setSearches(body.searches ?? []))
      .catch(() => setSearchesError(true));
  }, []);

  useEffect(() => {
    staggerIn(resultsRef.current);
  }, [jobs]);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.role.trim()) {
      setError("Type a role to search for.");
      return;
    }
    setLoading(true);
    setJobs(null);
    setDetailId(null);
    try {
      localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify(form));
    } catch {
      /* private mode */
    }
    try {
      const res = await fetch(`${JOBSETU_URL}/api/search`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: form.role.trim(), location: form.location, experience: form.experience }),
      });
      if (res.status === 400) {
        const body = await res.json().catch(() => null);
        setError(body?.detail ?? "That search was rejected. Try different wording.");
        return;
      }
      if (res.status === 503) {
        setError("Job search is temporarily unavailable. Please try again in a while.");
        return;
      }
      if (!res.ok) throw new Error(`JobSetu returned ${res.status}`);
      const body = await res.json();
      setJobs(body.jobs ?? []);
      setSearchMeta({ live: Boolean(body.is_live) });
      if ((body.jobs ?? []).length === 0) setError("No jobs found. Try different wording or another city.");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? `Cannot reach JobSetu at ${JOBSETU_URL}. Is it running?`
          : err instanceof Error
            ? err.message
            : "Search failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadById = async (id: string) => {
    setError(null);
    setJobs(null);
    setDetailId(null);
    setLoading(true);
    try {
      const res = await fetch(`${JOBSETU_URL}/api/jobs?search_id=${encodeURIComponent(id)}`);
      if (res.status === 404) {
        setError("Search not found in JobSetu.");
        return;
      }
      if (!res.ok) throw new Error(`JobSetu returned ${res.status}`);
      const body = await res.json();
      setJobs(body.jobs ?? []);
      setSearchMeta(null);
      if ((body.jobs ?? []).length === 0) setError("That search has no active jobs.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  const save = async (job: JobSetuJob) => {
    setSaving(job.id);
    try {
      // Already authenticated here: the Tracker session token travels with
      // this request, so no extra login is ever needed on this page.
      const exp = await fetch(`${JOBSETU_URL}/api/jobs/${job.id}/tracker-export`);
      if (!exp.ok) throw new Error(`Export failed (${exp.status})`);
      const payload = await exp.json();
      const created = await api.post<{ id: string }>("/api/applications", payload);
      setSavedApps((prev) => ({ ...prev, [job.id]: created.id }));
      notify(`Saved "${job.title}" to applications.`);
    } catch (err) {
      // Re-saving an already-tracked JobSetu job returns 409 with the
      // existing application id — link to it instead of showing an error.
      const code = (err as { code?: string }).code;
      const existingId = (err as { details?: { application_id?: string } }).details?.application_id;
      if (code === "CONFLICT" && existingId) {
        setSavedApps((prev) => ({ ...prev, [job.id]: existingId }));
        notify(`"${job.title}" is already tracked — opened the existing application.`);
      } else {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    } finally {
      setSaving(null);
    }
  };

  const visible = (jobs ?? []).filter((job) => {
    const exp = job.signals?.experience ?? "";
    if (expFilter === "entry" && !(exp === "" || exp === "entry")) return false;
    if (expFilter === "experienced" && !(exp === "" || exp === "experienced")) return false;
    if (typeFilter !== "any") {
      const t = normJobType(job.signals?.job_type);
      if (t !== "" && t !== typeFilter) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Discover Jobs"
        description="JobSetu-powered discovery, inside your workspace. Discovered → Saved → Applied → Interview → Offer."
        actions={
          <a
            href={JOBSETU_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Compass size={15} aria-hidden="true" />
            Open full JobSetu search →
          </a>
        }
      />

      <form onSubmit={runSearch} className="reveal grid gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm sm:grid-cols-4" aria-label="Search jobs">
        <input
          aria-label="Role"
          placeholder="Role — e.g. Python Backend Developer"
          maxLength={200}
          className={inputCls}
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        />
        <select aria-label="Location" className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
          {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select aria-label="Experience" className={inputCls} value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })}>
          {EXPERIENCES.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <button className="btn-shine inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
          <Search size={15} aria-hidden="true" /> Search jobs
        </button>
      </form>

      {(searches === null && !searchesError) && <RowSkeleton rows={1} />}
      {searches !== null && searches.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-blue-700 dark:text-blue-400 underline">Or pick up a previous JobSetu search</summary>
          <div className="mt-2 flex max-w-xl gap-2">
            <select
              aria-label="Previous JobSetu searches"
              className={inputCls}
              value={searchId}
              onChange={(e) => {
                setSearchId(e.target.value);
                if (e.target.value) void loadById(e.target.value);
              }}
            >
              <option value="">Choose a search…</option>
              {searches.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  #{s.id} {s.role} in {s.location} ({s.job_count} jobs)
                </option>
              ))}
            </select>
          </div>
        </details>
      )}

      {loading && <RowSkeleton rows={4} />}
      {error && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-400" role="alert">
          {error} Your saved data is unaffected.
        </div>
      )}

      {jobs !== null && !loading && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-600 dark:text-slate-400">
            {visible.length} of {jobs.length} jobs
            {searchMeta !== null && (searchMeta.live ? " · Live" : " · Cached")}
          </span>
          <select aria-label="Filter by experience" className="w-auto rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm" value={expFilter} onChange={(e) => setExpFilter(e.target.value)}>
            <option value="">All levels</option>
            <option value="entry">Fresher / entry-level</option>
            <option value="experienced">Experienced</option>
          </select>
          <select aria-label="Filter by job type" className="w-auto rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      )}

      {jobs !== null && !loading && visible.length > 0 && (
        <div className="space-y-2" ref={resultsRef}>
          {visible.map((job) => {
            const appId = savedApps[job.id];
            const open = detailId === job.id;
            const meta = [job.location, expLabel(job.signals?.experience), typeLabel(job.signals?.job_type)]
              .filter(Boolean)
              .join(" · ");
            return (
              <article key={job.id} data-anime-item className="reveal rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-sm shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{job.company || "Unknown company"}</p>
                    <p className="text-slate-800 dark:text-slate-200">{job.title || "Untitled role"}</p>
                    {meta && <p className="mt-0.5 text-slate-600 dark:text-slate-400">{meta}</p>}
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      {job.salary && `${job.salary} · `}
                      {job.posted}
                    </p>
                  </div>
                  {job.match_total !== null && job.match_total !== undefined && (
                    <MatchRing value={job.match_total} />
                  )}
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setDetailId(open ? null : job.id)}
                      aria-expanded={open}
                      className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      {open ? "Hide details" : "View details"}
                    </button>
                    {appId ? (
                      <Link to={`/applications/${appId}`} aria-label="Saved. View application" className="inline-flex items-center gap-1 rounded-md bg-green-700 px-3 py-1.5 font-semibold text-white hover:bg-green-800">
                        <BookmarkCheck size={14} aria-hidden="true" /> Saved ✓
                      </Link>
                    ) : (
                      <button
                        disabled={saving === job.id}
                        onClick={() => void save(job)}
                        className="btn-shine rounded-md bg-slate-800 dark:bg-slate-200 px-3 py-1.5 font-semibold text-white dark:text-slate-900 hover:bg-slate-900 dark:hover:bg-slate-100 disabled:opacity-40"
                      >
                        {saving === job.id ? "Saving…" : "Save"}
                      </button>
                    )}
                  </div>
                </div>
                {open && (
                  <div className="mt-3 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    {job.description_snippet && <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-400">{job.description_snippet}</p>}
                    {job.match && (
                      <div className="rounded-md bg-slate-50 dark:bg-slate-800 p-2 text-[13px]">
                        <p className="font-semibold">Why this matches ({job.match.total}%)</p>
                        {job.match.reasons.map((r, i) => <p key={i} className="text-slate-600 dark:text-slate-400">• {r}</p>)}
                        {job.match.missing_skills.length > 0 && (
                          <p className="mt-1 text-slate-600 dark:text-slate-400">Missing: {job.match.missing_skills.join(" · ")}</p>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3">
                      {job.apply_link && <a className="font-medium text-blue-700 dark:text-blue-400 underline" href={job.apply_link} target="_blank" rel="noreferrer">Apply →</a>}
                      {job.evidence_url && (
                        <a className="font-medium text-blue-700 dark:text-blue-400 underline" href={`${JOBSETU_URL}${job.evidence_url}`} target="_blank" rel="noreferrer">
                          Evidence →
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {jobs !== null && jobs.length === 0 && !loading && !error && (
        <EmptyState
          art="compass"
          title="No jobs in this search"
          body="Try different wording or another city — or run a fresh search above."
        />
      )}
    </div>
  );
}



