import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import type { Dashboard } from "../types";
import { EmptyState, Spinner, StatusBadge } from "../components/ui";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Dashboard>("/api/dashboard")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (error) return <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!data) return <Spinner />;

  const max = Math.max(1, ...data.byStatus.map((b) => b.count));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/applications/new" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          + New application
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={data.totals.total} />
        <StatCard label="Applied" value={data.totals.applied} />
        <StatCard label="Interviewing" value={data.totals.interviewing} />
        <StatCard label="Offers" value={data.totals.offers} />
        <StatCard label="Rejected" value={data.totals.rejected} />
        <StatCard label="Saved" value={data.totals.saved} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Applications by status</h2>
          <div className="mt-3 space-y-2">
            {data.byStatus.length === 0 && <p className="text-sm text-slate-500">No applications yet.</p>}
            {data.byStatus.map((b) => (
              <div key={b.status} className="flex items-center gap-2 text-sm">
                <span className="w-24 font-medium">{b.status}</span>
                <div className="h-2 flex-1 rounded bg-slate-100">
                  <div className="h-2 rounded bg-blue-500" style={{ width: `${(b.count / max) * 100}%` }} />
                </div>
                <span className="w-8 text-right">{b.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Upcoming interviews</h2>
          <div className="mt-3 space-y-2">
            {data.upcomingInterviews.length === 0 && <p className="text-sm text-slate-500">Nothing scheduled.</p>}
            {data.upcomingInterviews.map((i) => (
              <div key={i.id} className="rounded-md border border-slate-200 p-2 text-sm">
                <p className="font-medium">{i.company} — {i.job_title}</p>
                <p className="text-slate-600">{i.interview_type} · {new Date(i.scheduled_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {data.overdueFollowUps.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">⚠ Overdue follow-ups</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.overdueFollowUps.map((f) => (
              <li key={f.id}>
                <Link to={`/applications/${f.id}`} className="text-amber-900 underline">
                  Follow up with {f.company}
                </Link>{" "}
                <span className="text-amber-700">· Due: {f.follow_up_date}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Recent applications</h2>
        <div className="mt-3 space-y-2">
          {data.recentApplications.length === 0 && (
            <EmptyState title="No applications yet" hint="Add your first application to get started." />
          )}
          {data.recentApplications.map((a) => (
            <Link key={a.id} to={`/applications/${a.id}`} className="flex items-center justify-between rounded-md border border-slate-200 p-2 text-sm hover:bg-slate-50">
              <span className="font-medium">{a.company} — {a.job_title}</span>
              <StatusBadge status={a.status} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
