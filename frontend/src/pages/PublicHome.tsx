import { Link, Navigate } from "react-router-dom";
import { Briefcase, Compass, Moon, Sun } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { Spinner } from "../components/ui";

const STEPS = [
  { title: "Discover jobs", body: "Search verified opportunities powered by JobSetu intelligence." },
  { title: "Save what fits", body: "Keep the right roles in one pipeline — never a spreadsheet." },
  { title: "Track to offer", body: "Follow applications, interviews, and resumes to the finish line." },
];

export function PublicHomePage() {
  const { user, loading } = useAuth();
  const { theme, toggle } = useTheme();
  if (loading) return <Spinner />;
  if (user) return <Navigate to="/home" replace />;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <span className="flex items-center gap-2 text-lg font-bold tracking-tight text-blue-800 dark:text-blue-300">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-700 text-sm font-extrabold text-white">
            JT
          </span>
          JobTracker
        </span>
        <nav className="flex items-center gap-2 text-sm" aria-label="Account">
          <button
            onClick={toggle}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </button>
          <Link to="/sign-in" className="rounded-md px-3 py-1.5 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
            Sign in
          </Link>
          <Link to="/sign-up" className="rounded-md bg-blue-700 px-4 py-1.5 font-semibold text-white hover:bg-blue-800">
            Sign up
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="reveal relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-800 px-6 py-14 text-center text-white sm:px-12 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(30rem 14rem at 50% 0%, rgba(255,255,255,0.14), transparent 70%), radial-gradient(26rem 14rem at 50% 115%, rgba(45,212,191,0.20), transparent 70%)",
            }}
          />
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-200">Job Tracker</p>
            <h1 className="mx-auto mt-2 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Your career, in one place.
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-base text-blue-100">
              Discover jobs. Track applications. Prepare for interviews. Manage resumes.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/sign-up" className="btn-shine inline-flex items-center gap-1.5 rounded-md bg-white dark:bg-slate-900 px-6 py-2.5 text-sm font-semibold text-blue-800 dark:text-blue-300 hover:bg-blue-50">
                Sign up
              </Link>
              <Link to="/sign-in" className="inline-flex items-center gap-1.5 rounded-md border border-white/40 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <section aria-label="How it works" className="mt-10 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="reveal rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm" style={{ "--reveal-delay": `${i * 60}ms` } as React.CSSProperties}>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-400">Step {i + 1}</p>
              <h2 className="mt-1 font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s.body}</p>
            </div>
          ))}
        </section>

        <section className="reveal mt-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center shadow-sm">
          <p className="inline-flex items-center gap-2 font-semibold">
            <Compass size={18} aria-hidden="true" className="text-blue-700 dark:text-blue-400" />
            Discovery powered by JobSetu
            <Briefcase size={18} aria-hidden="true" className="text-blue-700 dark:text-blue-400" />
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-400">
            Every listing carries evidence-backed verification and match context — then flows
            straight into your application pipeline.
          </p>
        </section>
      </main>
    </div>
  );
}

