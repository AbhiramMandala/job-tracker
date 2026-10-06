import { useEffect, useState } from "react";
import { api } from "../services/api";
import { EmptyState, Spinner, inputCls } from "../components/ui";

const JOBSETU_URL = (import.meta.env.VITE_JOBSETU_URL as string | undefined) || "http://127.0.0.1:8000";

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
}

interface JobSetuSearch {
  id: number;
  role: string;
  location: string;
  experience: string;
  job_count: number;
  retrieved_at: string | null;
}

function extractSearchId(raw: string): string {
  // Accept a bare ID ("3") or anything containing one (pasted URL, "Search #3").
  const m = raw.match(/\d+/);
  return m ? m[0]! : "";
}

export function DiscoverPage({ notify }: { notify: (m: string) => void }) {
  const [searches, setSearches] = useState<JobSetuSearch[] | null>(null);
  const [searchesError, setSearchesError] = useState(false);
  const [searchId, setSearchId] = useState("");
  const [jobs, setJobs] = useState<JobSetuJob[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch(`${JOBSETU_URL}/api/searches`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((body) => setSearches(body.searches ?? []))
      .catch(() => setSearchesError(true));
  }, []);

  const loadById = async (id: string) => {
    setError(null);
    setJobs(null);
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
      if ((body.jobs ?? []).length === 0) setError("That search has no active jobs.");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? `Cannot reach JobSetu at ${JOBSETU_URL}. Is it running? (python -m uvicorn app.main:app)`
          : err instanceof Error
            ? err.message
            : "Failed to load jobs",
      );
    } finally {
      setLoading(false);
    }
  };

  const load = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractSearchId(searchId);
    if (!id) {
      setError("Enter a JobSetu search — pick one above or type its ID.");
      return;
    }
    setSearchId(id);
    void loadById(id);
  };

  const save = async (job: JobSetuJob) => {
    setSaving(job.id);
    try {
      const exp = await fetch(`${JOBSETU_URL}/api/jobs/${job.id}/tracker-export`);
      if (!exp.ok) throw new Error(`Export failed (${exp.status})`);
      const payload = await exp.json();
      await api.post("/api/applications", payload);
      setSaved((prev) => new Set(prev).add(job.id));
      notify(`Saved "${job.title}" to applications.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Discover Jobs</h1>
          <p className="mt-1 text-sm text-slate-600">
            Discovered → Saved → Applied → Interview → Offer. Saving a job here
            adds it to <span className="font-medium">My Applications</span> as Saved.
          </p>
        </div>
        <a
          href={JOBSETU_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Open full JobSetu search →
        </a>
      </div>

      {searches === null && !searchesError && <Spinner />}
      {searches !== null && searches.length > 0 && (
        <div>
          <label htmlFor="search-pick" className="text-sm font-medium">Recent JobSetu searches</label>
          <div className="mt-1 flex max-w-xl gap-2">
            <select
              id="search-pick"
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
        </div>
      )}

      <form onSubmit={load} className="flex max-w-md gap-2">
        <input
          aria-label="JobSetu search ID or URL"
          placeholder="…or paste search ID"
          inputMode="numeric"
          className={inputCls}
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
        />
        <button className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Load jobs
        </button>
      </form>
      {searchesError && (
        <p className="text-sm text-slate-500">
          Couldn't list recent searches — is JobSetu running at {JOBSETU_URL}? You can still paste an ID above.
        </p>
      )}

      {loading && <Spinner />}
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {jobs !== null && !loading && jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-lg bg-white p-3 text-sm shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{job.title || "Untitled role"}</p>
                  <p className="text-slate-600">{job.company} · {job.location}</p>
                  <p className="mt-1 text-slate-500">
                    {job.match_total !== null && <span className="font-semibold text-blue-700">{job.match_total}% match · </span>}
                    {job.salary && `${job.salary} · `}
                    {job.posted}
                  </p>
                </div>
                <button
                  disabled={saving === job.id || saved.has(job.id)}
                  onClick={() => void save(job)}
                  className="rounded-md bg-slate-800 px-3 py-1.5 text-white hover:bg-slate-900 disabled:opacity-40"
                >
                  {saved.has(job.id) ? "Saved ✓" : saving === job.id ? "Saving…" : "Save as application"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {jobs !== null && jobs.length === 0 && !loading && !error && (
        <EmptyState title="No jobs" hint="That search has no active jobs to import." />
      )}
    </div>
  );
}
