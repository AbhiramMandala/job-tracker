import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { PageHeader } from "../components/ui";

export function SettingsPage() {
  const { theme, toggle } = useTheme();
  const apiUrl = import.meta.env.VITE_API_URL || "(same origin / dev proxy)";

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <PageHeader title="Settings" description="Preferences and integration status." />

      <section aria-label="Preferences" className="reveal rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="font-semibold">Preferences</h2>
        <div className="mt-2 flex items-center justify-between gap-2 text-sm">
          <p className="text-slate-600 dark:text-slate-400">
            Theme <span className="text-slate-400 dark:text-slate-500">(saved in this browser)</span>
          </p>
          <button
            onClick={toggle}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Dashboard stats refresh from the server and are cached briefly; your data always lives in the database.
        </p>
      </section>

      <section aria-label="Connection" className="reveal rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" style={{ "--reveal-delay": "60ms" } as React.CSSProperties}>
        <h2 className="font-semibold">Connection</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          API base URL: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{apiUrl}</code>
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          This app connects directly to your JobTracker API — no separate services needed.
        </p>
      </section>
    </div>
  );
}
