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

        <div aria-hidden="true" className="float-soft mx-auto -mt-2 max-w-2xl px-2">
          <svg viewBox="0 0 520 150" className="w-full drop-shadow-xl" role="presentation">
            <defs>
              <linearGradient id="hero-card" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="1" stopColor="#eff6ff" />
              </linearGradient>
              <linearGradient id="hero-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#1d4ed8" />
                <stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <rect x="40" y="18" width="440" height="44" rx="10" fill="url(#hero-card)" opacity="0.97" />
            <circle cx="70" cy="40" r="10" fill="url(#hero-ring)" opacity="0.9" />
            <rect x="88" y="33" width="150" height="8" rx="4" fill="#cbd5e1" />
            <rect x="88" y="45" width="100" height="6" rx="3" fill="#e2e8f0" />
            <rect x="380" y="29" width="74" height="22" rx="6" fill="#1d4ed8" />
            <rect x="60" y="76" width="400" height="56" rx="10" fill="url(#hero-card)" />
            <circle cx="92" cy="104" r="14" fill="none" stroke="#e2e8f0" strokeWidth="5" />
            <circle cx="92" cy="104" r="14" fill="none" stroke="url(#hero-ring)" strokeWidth="5" strokeLinecap="round" strokeDasharray="62 100" pathLength="100" transform="rotate(-90 92 104)" />
            <rect x="116" y="90" width="130" height="9" rx="4.5" fill="#334155" />
            <rect x="116" y="104" width="180" height="7" rx="3.5" fill="#cbd5e1" />
            <rect x="116" y="116" width="120" height="7" rx="3.5" fill="#e2e8f0" />
            <rect x="360" y="94" width="84" height="20" rx="10" fill="#dcfce7" />
            <circle cx="372" cy="104" r="5" fill="#16a34a" />
            <rect x="380" y="101" width="52" height="6" rx="3" fill="#16a34a" opacity="0.7" />
            <circle cx="150" cy="140" r="3" fill="#3b82f6" />
            <circle cx="260" cy="142" r="3" fill="#3b82f6" opacity="0.6" />
            <circle cx="370" cy="140" r="3" fill="#3b82f6" opacity="0.8" />
          </svg>
        </div>

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

