import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../services/api";
import type { Application } from "../types";
import { EmptyState, PageHeader, PrimaryLink, RowSkeleton, StatusBadge, inputCls } from "../components/ui";

const STATUSES = ["", "SAVED", "APPLIED", "OA", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"];
const JOB_TYPES = ["", "FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT", "REMOTE"];

export function ApplicationsPage({ notify }: { notify: (m: string) => void }) {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const search = params.get("search") ?? "";
  const status = params.get("status") ?? "";
  const jobType = params.get("job_type") ?? "";
  const sort = params.get("sort") ?? "newest";
  const page = Number(params.get("page") ?? "1");

  const [draft, setDraft] = useState({ search, status, job_type: jobType, sort });

  useEffect(() => {
    setDraft({ search, status, job_type: jobType, sort });
  }, [search, status, jobType, sort]);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (status) q.set("status", status);
    if (jobType) q.set("job_type", jobType);
    q.set("sort", sort);
    q.set("page", String(page));
    q.set("limit", "12");
    api
      .get<{ items: Application[]; pagination: { total: number } }>(`/api/applications?${q}`)
      .then((d) => {
        setItems(d.items);
        setTotal(d.pagination.total);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [search, status, jobType, sort, page, retry]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setParams({ search: draft.search, status: draft.status, job_type: draft.job_type, sort: draft.sort, page: "1" });
  };

  const totalPages = Math.max(1, Math.ceil(total / 12));
  void notify;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Applications${total > 0 ? ` (${total})` : ""}`}
        description="Your career pipeline — every saved, applied, and interviewed role."
        actions={
          <PrimaryLink to="/applications/new">
            <Plus size={16} aria-hidden="true" /> New application
          </PrimaryLink>
        }
      />

      <form onSubmit={applyFilters} className="reveal grid gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm sm:grid-cols-5">
        <input aria-label="Search" placeholder="Company or title…" className={inputCls} value={draft.search} onChange={(e) => setDraft({ ...draft, search: e.target.value })} />
        <select aria-label="Status" className={inputCls} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s === "" ? "All statuses" : s}</option>
          ))}
        </select>
        <select aria-label="Job type" className={inputCls} value={draft.job_type} onChange={(e) => setDraft({ ...draft, job_type: e.target.value })}>
          {JOB_TYPES.map((s) => (
            <option key={s} value={s}>{s === "" ? "All types" : s}</option>
          ))}
        </select>
        <select aria-label="Sort" className={inputCls} value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: e.target.value })}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
        <button className="rounded-md bg-slate-800 dark:bg-slate-200 px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-900 dark:hover:bg-slate-100">Filter</button>
      </form>

      {loading ? (
        <RowSkeleton rows={6} />
      ) : error ? (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-400" role="alert">
          We couldn't load your applications. Your data is safe.{" "}
          <button className="underline" onClick={() => { setError(null); setLoading(true); setRetry((r) => r + 1); }}>Try again</button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          art="pipeline"
          title="No applications match"
          body="Try clearing the filters — or find your next opportunity with JobSetu."
          action={{ to: "/discover-jobs", label: "Discover jobs" }}
        />
      ) : (
        <div className="reveal overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <td className="px-4 py-2 font-medium">
                    <Link to={`/applications/${a.id}`} className="text-blue-700 dark:text-blue-400 hover:underline">{a.company}</Link>
                  </td>
                  <td className="px-4 py-2">{a.job_title}</td>
                  <td className="px-4 py-2">
                    <span className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={a.status} />
                      {a.notes?.startsWith("Imported from JobSetu") && (
                        <span title="Discovered in JobSetu" className="inline-flex items-center rounded-full bg-teal-100 dark:bg-teal-950 px-2 py-0.5 text-xs font-semibold text-teal-800 dark:text-teal-300">
                          JobSetu
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{a.application_date?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <button
          disabled={page <= 1}
          onClick={() => setParams({ search, status, job_type: jobType, sort, page: String(page - 1) })}
          className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1 disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="text-slate-600 dark:text-slate-400">Page {page} of {totalPages}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => setParams({ search, status, job_type: jobType, sort, page: String(page + 1) })}
          className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1 disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}



