import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, CalendarClock, Compass, FileText } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Dashboard } from "../types";
import { ActionCard, CardSkeleton, EmptyState, StatusBadge } from "../components/ui";
import { AnimatedNumber } from "../components/AnimatedNumber";

function Hero({ name, hasActivity }: { name: string; hasActivity: boolean }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <section className="reveal relative overflow-hidden rounded-xl border border-blue-100 dark:border-blue-900 bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-800 px-6 py-8 text-white shadow-sm sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(28rem 12rem at 85% 10%, rgba(255,255,255,0.14), transparent 70%), radial-gradient(24rem 12rem at 10% 110%, rgba(45,212,191,0.22), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
          backgroundSize: "2rem 2rem",
          maskImage: "radial-gradient(32rem 16rem at 70% 0%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(32rem 16rem at 70% 0%, black, transparent 75%)",
        }}
      />
      <div className="relative">
        <p className="text-sm font-medium text-blue-200">Your career, in one place</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          {greeting}, {name}
        </h1>
        <p className="mt-1 text-sm text-blue-100">
          {hasActivity ? "Your job search is moving forward." : "Let's find your first opportunity."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/discover-jobs"
            className="btn-shine inline-flex items-center gap-1.5 rounded-md bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-blue-800 dark:text-blue-300 hover:bg-blue-50"
          >
            <Compass size={16} aria-hidden="true" />
            Discover jobs
          </Link>
          <Link
            to="/applications"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            <Briefcase size={16} aria-hidden="true" />
            View applications
          </Link>
        </div>
      </div>
    </section>
  );
}

function Pipeline({ totals }: { totals: Dashboard["totals"] }) {
  const steps = [
    { label: "Saved", value: totals.saved },
    { label: "Applied", value: totals.applied },
    { label: "Interview", value: totals.interviewing },
    { label: "Offer", value: totals.offers },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <section aria-label="Your pipeline" className="reveal rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm" style={{ "--reveal-delay": "60ms" } as React.CSSProperties}>
      <h2 className="font-semibold">Your pipeline</h2>
      <ol className="mt-3 flex items-stretch gap-1.5 text-center sm:gap-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex min-w-0 flex-1 items-stretch gap-1.5 sm:gap-2">
            <div className="min-w-0 flex-1 rounded-md bg-slate-50 dark:bg-slate-800 px-1 py-3 sm:px-2">
              <p className="text-2xl font-extrabold tabular-nums"><AnimatedNumber value={s.value} label={`${s.label}: ${s.value}`} /></p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
              <div className="mx-auto mt-2 h-1 w-full max-w-20 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                <div className="h-1 rounded bg-blue-600" style={{ width: `${(s.value / max) * 100}%` }} />
              </div>
            </div>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="self-center text-slate-300 dark:text-slate-400">→</span>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Discovered → Saved → Applied → Interview → Offer
        {totals.rejected > 0 && ` · Rejected: ${totals.rejected}`}
      </p>
    </section>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    api
      .get<Dashboard>("/api/dashboard")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [retry]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-6 text-center">
        <p className="font-semibold text-red-800 dark:text-red-300">We couldn't load your workspace.</p>
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">Your data is safe.</p>
        <button
          onClick={() => { setError(null); setRetry((r) => r + 1); }}
          className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4" aria-label="Loading workspace">
        <div className="skeleton h-44 w-full rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      </div>
    );
  }

  const firstName = user?.name?.split(" ")[0] || "there";
  const overdueNext = data.overdueFollowUps[0];
  const nextApp =
    data.recentApplications.find((a) => a.status === "SAVED") ?? data.recentApplications[0];

  return (
    <div className="space-y-5">
      <Hero name={firstName} hasActivity={data.totals.total > 0} />

      <div className="grid gap-3 sm:grid-cols-2">
        <ActionCard to="/discover-jobs" icon={Compass} title="Discover Jobs" body="Find verified opportunities through JobSetu." cta="Explore jobs" delay={40} />
        <ActionCard to="/applications" icon={Briefcase} title="My Applications" body="Track jobs you've saved and applied to." cta="Open pipeline" delay={80} />
        <ActionCard to="/interviews" icon={CalendarClock} title="Interviews" body="Manage upcoming interviews and preparation." cta="View schedule" delay={120} />
        <ActionCard to="/resumes" icon={FileText} title="Resumes" body="Manage resumes and link them to applications." cta="Manage files" delay={160} />
      </div>

      <Pipeline totals={data.totals} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Next action" className="reveal rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm" style={{ "--reveal-delay": "100ms" } as React.CSSProperties}>
          <h2 className="font-semibold">Next action</h2>
          {!overdueNext && !nextApp ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Nothing yet. <Link to="/discover-jobs" className="text-blue-700 dark:text-blue-400 underline">Find jobs</Link> to get started.
            </p>
          ) : overdueNext ? (
            <div className="mt-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-3 text-sm">
              <p className="font-semibold text-amber-900 dark:text-amber-200">⚠ Follow up with {overdueNext.company}</p>
              <p className="text-amber-700 dark:text-amber-300">Due: {overdueNext.follow_up_date}</p>
              <Link to={`/applications/${overdueNext.id}`} className="mt-1 inline-block font-medium text-blue-700 dark:text-blue-400 underline">Open application →</Link>
            </div>
          ) : nextApp ? (
            <div className="mt-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm">
              <p className="font-semibold">{nextApp.company} — {nextApp.job_title}</p>
              <div className="mt-1.5"><StatusBadge status={nextApp.status} /></div>
              <Link to={`/applications/${nextApp.id}`} className="mt-1 inline-block font-medium text-blue-700 dark:text-blue-400 underline">Continue →</Link>
            </div>
          ) : null}
        </section>

        <section aria-label="Upcoming interviews" className="reveal rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm" style={{ "--reveal-delay": "140ms" } as React.CSSProperties}>
          <h2 className="font-semibold">Upcoming</h2>
          <div className="mt-2 space-y-2 text-sm">
            {data.upcomingInterviews.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400">No interviews scheduled. They'll appear here once an application reaches the interview stage.</p>
            )}
            {data.upcomingInterviews.slice(0, 3).map((i) => (
              <div key={i.id} className="rounded-md border border-slate-200 dark:border-slate-700 p-2">
                <p className="font-medium">{i.company} — {i.job_title}</p>
                <p className="text-slate-600 dark:text-slate-400">{i.interview_type} · {new Date(i.scheduled_at).toLocaleString()}</p>
              </div>
            ))}
            <Link to="/interviews" className="inline-block font-medium text-blue-700 dark:text-blue-400 underline">Manage interviews →</Link>
          </div>
        </section>
      </div>

      <section aria-label="Continue where you left off" className="reveal rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm" style={{ "--reveal-delay": "180ms" } as React.CSSProperties}>
        <h2 className="font-semibold">Continue where you left off</h2>
        <div className="mt-3 space-y-2">
          {data.recentApplications.length === 0 && (
            <EmptyState
              art="pipeline"
              title="Your pipeline is empty"
              body="Find your next opportunity with JobSetu, then save the ones you like."
              action={{ to: "/discover-jobs", label: "Discover jobs" }}
            />
          )}
          {data.recentApplications.slice(0, 3).map((a) => (
            <Link key={a.id} to={`/applications/${a.id}`} className="lift flex items-center justify-between gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm shadow-sm hover:shadow-md">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{a.company}</span>
                <span className="block truncate text-slate-600 dark:text-slate-400">{a.job_title}</span>
              </span>
              <StatusBadge status={a.status} />
            </Link>
          ))}
        </div>
        {data.recentApplications.length > 0 && (
          <Link to="/applications" className="mt-3 inline-block text-sm font-medium text-blue-700 dark:text-blue-400 underline">
            View all applications →
          </Link>
        )}
      </section>
    </div>
  );
}

