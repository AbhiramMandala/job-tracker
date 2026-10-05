import { useState } from "react";
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

export function DiscoverPage({ notify }: { notify: (m: string) => void }) {
  const [searchId, setSearchId] = useState("");
  const [jobs, setJobs] = useState<JobSetuJob[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  const load = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setJobs(null);
    if (!searchId.trim() || !/^\d+$/.test(searchId.trim())) {
      setError("Enter the numeric search ID from your JobSetu results page.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${JOBSETU_URL}/api/jobs?search_id=${encodeURIComponent(searchId.trim())}`);
      if (res.status === 404) {
        setError("Search not found in JobSetu. Check the search ID.");
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
      <h1 className="text-2xl font-bold">Discover via JobSetu</h1>
      <p className="text-sm text-slate-600">
        Pull a JobSetu search into your tracker. Run a search in JobSetu first, then paste its numeric
        search ID below. Source: <code className="rounded bg-slate-100 px-1">{JOBSETU_URL}</code>
      </p>

      <form onSubmit={load} className="flex max-w-md gap-2">
        <input
          aria-label="JobSetu search ID"
          placeholder="e.g. 3"
          inputMode="numeric"
          className={inputCls}
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
        />
        <button className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Load jobs
        </button>
      </form>

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
