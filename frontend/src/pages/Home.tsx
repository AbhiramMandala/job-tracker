import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Dashboard } from "../types";
import { EmptyState, Spinner, StatusBadge } from "../components/ui";

const ACTIONS = [
  {
    to: "/discover-jobs",
    title: "Discover Jobs",
    body: "Find new opportunities using JobSetu's search and evidence.",
  },
  {
    to: "/applications",
    title: "My Applications",
    body: "Track jobs you've saved and applied to.",
  },
  {
    to: "/interviews",
    title: "Interviews",
    body: "Manage upcoming interviews and preparation.",
  },
  {
    to: "/resumes",
    title: "Resumes",
    body: "Manage resumes and connect them to applications.",
  },
];

function Pipeline({ totals }: { totals: Dashboard["totals"] }) {
  const steps = [
    { label: "Saved", value: totals.saved },
    { label: "Applied", value: totals.applied },
    { label: "Interview", value: totals.interviewing },
    { label: "Offer", value: totals.offers },
  ];
  return (
    <section aria-label="Your pipeline" className="rounded-lg bg-white p-4 shadow-sm">
      <h2 className="font-semibold">Your pipeline</h2>
      <ol className="mt-3 flex items-stretch gap-2 text-center">
        {steps.map((s, i) => (
          <li key={s.label} className="flex flex-1 items-stretch gap-2">
            <div className="flex-1 rounded-md bg-slate-50 px-2 py-3">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="self-center text-slate-300">→</span>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-slate-500">
        Discovered → Saved → Applied → Interview → Offer. Rejected: {totals.rejected}.
      </p>
    </section>
  );
}

export function HomePage() {
  const { user } = useAuth();
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

  const firstName = user?.name?.split(" ")[0] || "there";
  const overdueNext = data.overdueFollowUps[0];
  const nextApp =
    data.recentApplications.find((a) => a.status === "SAVED") ?? data.recentApplications[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-slate-600">What do you want to do?</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="rounded-lg bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <p className="font-semibold text-blue-700">{a.title} →</p>
            <p className="mt-1 text-sm text-slate-600">{a.body}</p>
          </Link>
        ))}
      </div>

      <Pipeline totals={data.totals} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Next action" className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Next action</h2>
          {!overdueNext && !nextApp ? (
            <p className="mt-2 text-sm text-slate-500">
              Nothing yet. <Link to="/discover-jobs" className="text-blue-700 underline">Find jobs</Link> to get started.
            </p>
          ) : overdueNext ? (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-amber-900">⚠ Follow up with {overdueNext.company}</p>
              <p className="text-amber-700">Due: {overdueNext.follow_up_date}</p>
              <Link to={`/applications/${overdueNext.id}`} className="text-blue-700 underline">Open application →</Link>
            </div>
          ) : nextApp ? (
            <div className="mt-2 rounded-md border border-slate-200 p-3 text-sm">
              <p className="font-medium">{nextApp.company} — {nextApp.job_title}</p>
              <div className="mt-1"><StatusBadge status={nextApp.status} /></div>
              <Link to={`/applications/${nextApp.id}`} className="text-blue-700 underline">Open application →</Link>
            </div>
          ) : null}
        </section>

        <section aria-label="Upcoming interviews" className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Upcoming</h2>
          <div className="mt-2 space-y-2 text-sm">
            {data.upcomingInterviews.length === 0 && (
              <p className="text-slate-500">No interviews scheduled.</p>
            )}
            {data.upcomingInterviews.slice(0, 3).map((i) => (
              <p key={i.id}>
                <span className="font-medium">{i.company}</span> · {i.interview_type} ·{" "}
                {new Date(i.scheduled_at).toLocaleString()}
              </p>
            ))}
            <Link to="/interviews" className="inline-block text-blue-700 underline">Manage interviews →</Link>
          </div>
        </section>
      </div>

      <section aria-label="Continue where you left off" className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Continue where you left off</h2>
        <div className="mt-3 space-y-2">
          {data.recentApplications.length === 0 && (
            <EmptyState title="No applications yet" hint="Discover jobs, then save the ones you like." />
          )}
          {data.recentApplications.slice(0, 3).map((a) => (
            <Link key={a.id} to={`/applications/${a.id}`} className="flex items-center justify-between rounded-md border border-slate-200 p-2 text-sm hover:bg-slate-50">
              <span className="font-medium">{a.company} — {a.job_title}</span>
              <StatusBadge status={a.status} />
            </Link>
          ))}
        </div>
        {data.recentApplications.length > 0 && (
          <Link to="/applications" className="mt-3 inline-block text-sm text-blue-700 underline">
            View all applications →
          </Link>
        )}
      </section>
    </div>
  );
}
