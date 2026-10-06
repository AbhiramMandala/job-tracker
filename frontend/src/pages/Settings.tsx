import { Moon, Sun } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";

export function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const apiUrl = import.meta.env.VITE_API_URL || "(same origin / dev proxy)";

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <section className="rounded-lg bg-white dark:bg-slate-900 p-4 shadow-sm">
        <h2 className="font-semibold">Appearance</h2>
        <div className="mt-2 flex items-center justify-between text-sm">
          <p className="text-slate-600 dark:text-slate-400">
            Theme <span className="text-slate-400 dark:text-slate-500">(saved in this browser)</span>
          </p>
          <button
            onClick={toggle}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 dark:border-slate-600 dark:hover:bg-slate-800"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </section>
      <section className="rounded-lg bg-white dark:bg-slate-900 p-4 shadow-sm">
        <h2 className="font-semibold">Account</h2>
        <dl className="mt-2 text-sm">
          <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-2"><dt className="text-slate-500 dark:text-slate-400">Name</dt><dd>{user?.name || "—"}</dd></div>
          <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-2"><dt className="text-slate-500 dark:text-slate-400">Email</dt><dd>{user?.email}</dd></div>
          <div className="flex justify-between py-2"><dt className="text-slate-500 dark:text-slate-400">Member since</dt><dd>{user?.created_at.slice(0, 10)}</dd></div>
        </dl>
      </section>
      <section className="rounded-lg bg-white dark:bg-slate-900 p-4 shadow-sm">
        <h2 className="font-semibold">Configuration</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">API base URL: <code className="rounded bg-slate-100 dark:bg-slate-800 px-1">{apiUrl}</code></p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Sessions persist via Bearer token in localStorage plus an HttpOnly cookie set by the Worker.
          Dashboard stats are cached in KV for 60s; D1 is the source of truth.
        </p>
      </section>
    </div>
  );
}

