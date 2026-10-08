import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookmarkCheck, Search } from "lucide-react";
import { api } from "../services/api";
import type { DiscoveredJob, DiscoverPagination, DiscoverSearch } from "../types";
import { EmptyState, PageHeader, RowSkeleton, inputCls } from "../components/ui";

const LAST_SEARCH_KEY = "jt-discover-last";

const LOCATIONS = ["Hyderabad", "Bengaluru", "Chennai", "Remote (India)"];
const EXPERIENCES = ["Fresher", "Entry-level (0–1 years)", "Experienced (2+ years)"];

function metaLine(job: DiscoveredJob): string {
  const parts = [job.location, job.employment_type, job.remote === true ? "Remote" : job.remote === false ? "On-site" : ""].filter(Boolean);
  return parts.join(" · ");
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
  const [searches, setSearches] = useState<DiscoverSearch[] | null>(null);
  const [searchId, setSearchId] = useState("");
  const [jobs, setJobs] = useState<DiscoveredJob[] | null>(null);
  const [pagination, setPagination] = useState<DiscoverPagination | null>(null);
  const [cached, setCached] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedApps, setSavedApps] = useState<Record<string, string>>({});
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ searches: DiscoverSearch[] }>("/api/discover/searches")
      .then((d) => setSearches(d.searches ?? []))
      .catch(() => setSearches([]));
  }, []);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.role.trim()) {
      setError("Type a role or keywords to search for.");
      return;
    }
    setLoading(true);
    setJobs(null);
    setPagination(null);
    setDetailId(null);
    try {
      localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify(form));
    } catch {
      /* private mode */
    }
    try {
      const body = await api.post<{ search_id: string; jobs: DiscoveredJob[]; pagination: DiscoverPagination; meta: { cached: boolean } }>(
        "/api/discover/search",
        { role: form.role.trim(), location: form.location, experience: form.experience },
      );
      setJobs(body.jobs ?? []);
      setPagination(body.pagination);
      setCached(body.meta?.cached ?? null);
      setSearchId(body.search_id ?? "");
      if ((body.jobs ?? []).length === 0) setError("No jobs found. Try different keywords or another city.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const loadById = async (id: string, page = 1) => {
    setError(null);
    setJobs(null);
    setDetailId(null);
    setLoading(true);
    try {
      const q = new URLSearchParams({ search_id: id, page: String(page), limit: "20" });
      const body = await api.get<{ search_id: string; jobs: DiscoveredJob[]; pagination: DiscoverPagination }>(`/api/discover/jobs?${q}`);
      setJobs(body.jobs ?? []);
      setPagination(body.pagination);
      setCached(null);
      if ((body.jobs ?? []).length === 0) setError("That search has no jobs on this page.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  const save = async (job: DiscoveredJob) => {
    if (!searchId) return;
    setSaving(job.id);
    try {
      const created = await api.post<{ id: string }>(`/api/discover/jobs/${searchId}/${encodeURIComponent(job.id)}/save`);
      setSavedApps((prev) => ({ ...prev, [job.id]: created.id }));
      notify(`Saved "${job.title}" to applications.`);
    } catch (err) {
      const code = (err as { code?: string }).code;
      const existingId = (err as { details?: { application_id?: string } }).details?.application_id;
      if (code === "CONFLICT" && existingId) {
        setSavedApps((prev) => ({ ...prev, [job.id]: existingId }));
        notify("Already tracked — opened the existing application.");
      } else {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="Discover Jobs"
        description="Search live listings, then save the ones you like. Discovered → Saved → Applied → Interview → Offer."
      />

      <form onSubmit={runSearch} className="reveal grid gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm sm:grid-cols-4" aria-label="Search jobs">
        <input
          aria-label="Role or keywords"
          placeholder="Role — e.g. Python Developer"
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

      {searches === null && <RowSkeleton rows={1} />}
      {searches !== null && searches.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-blue-700 dark:text-blue-400 underline">Or pick up a previous search</summary>
          <div className="mt-2 flex max-w-xl gap-2">
            <select
              aria-label="Previous searches"
              className={inputCls}
              value={searchId}
              onChange={(e) => {
                setSearchId(e.target.value);
                if (e.target.value) void loadById(e.target.value, 1);
              }}
            >
              <option value="">Choose a search…</option>
              {searches.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.role || "Untitled"} in {s.location || "anywhere"} ({s.job_count} jobs)
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
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {pagination ? `${pagination.total} jobs · Page ${pagination.page} of ${pagination.totalPages}` : `${jobs.length} jobs`}
          {cached !== null && (cached ? " · Cached" : " · Live")}
        </p>
      )}

      {jobs !== null && !loading && jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map((job) => {
            const appId = savedApps[job.id];
            const open = detailId === job.id;
            const meta = metaLine(job);
            return (
              <article key={job.id} className="reveal rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:p-4 text-sm shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{job.company || "Unknown company"}</p>
                    <p className="text-slate-800 dark:text-slate-200">{job.title || "Untitled role"}</p>
                    {meta && <p className="mt-0.5 text-slate-600 dark:text-slate-400">{meta}</p>}
                    {(job.salary || job.posted_at) && (
                      <p className="mt-1 text-slate-500 dark:text-slate-400">
                        {[job.salary, job.posted_at].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
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
                    {job.description && <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-400">{job.description}</p>}
                    <div className="flex flex-wrap gap-3">
                      {job.apply_url && <a className="font-medium text-blue-700 dark:text-blue-400 underline" href={job.apply_url} target="_blank" rel="noreferrer">Apply →</a>}
                      {job.source && <span className="text-slate-500 dark:text-slate-400">Source: {job.source}</span>}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {pagination !== null && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            disabled={pagination.page <= 1}
            onClick={() => searchId && void loadById(searchId, pagination.page - 1)}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-slate-600 dark:text-slate-400">Page {pagination.page} of {pagination.totalPages}</span>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => searchId && void loadById(searchId, pagination.page + 1)}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}

      {jobs !== null && jobs.length === 0 && !loading && !error && (
        <EmptyState
          art="compass"
          title="No jobs in this search"
          body="Try different keywords or another city — or run a fresh search above."
        />
      )}
    </div>
  );
}
