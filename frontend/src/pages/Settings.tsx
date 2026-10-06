import { useNavigate } from "react-router-dom";
import { LogOut, Moon, ShieldCheck, Sun, User } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { PageHeader } from "../components/ui";

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL || "(same origin / dev proxy)";

  const signOut = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Settings" description="Your profile, security, and preferences." />

      <section aria-label="Profile" className="reveal rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <User size={16} aria-hidden="true" className="text-slate-500 dark:text-slate-400" /> Profile
        </h2>
        <dl className="mt-2 text-sm">
          <div className="flex justify-between border-b border-slate-100 py-2 dark:border-slate-800"><dt className="text-slate-500 dark:text-slate-400">Name</dt><dd>{user?.name || "—"}</dd></div>
          <div className="flex justify-between border-b border-slate-100 py-2 dark:border-slate-800"><dt className="text-slate-500 dark:text-slate-400">Email</dt><dd>{user?.email}</dd></div>
          <div className="flex justify-between py-2"><dt className="text-slate-500 dark:text-slate-400">Member since</dt><dd>{user?.created_at.slice(0, 10)}</dd></div>
        </dl>
      </section>

      <section aria-label="Security" className="reveal rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" style={{ "--reveal-delay": "60ms" } as React.CSSProperties}>
        <h2 className="flex items-center gap-1.5 font-semibold">
          <ShieldCheck size={16} aria-hidden="true" className="text-slate-500 dark:text-slate-400" /> Security
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          You're signed in with a secure server-side session (7-day expiry). Your password is
          stored only as a one-way hash — never in plain text, never in this browser.
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          API base URL: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{apiUrl}</code>
        </p>
        <button
          onClick={() => void signOut()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          <LogOut size={15} aria-hidden="true" /> Sign out everywhere on this device
        </button>
      </section>

      <section aria-label="Preferences" className="reveal rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" style={{ "--reveal-delay": "120ms" } as React.CSSProperties}>
        <h2 className="font-semibold">Preferences</h2>
        <div className="mt-2 flex items-center justify-between text-sm">
          <p className="text-slate-600 dark:text-slate-400">
            Theme <span className="text-slate-400 dark:text-slate-500">(saved in this browser)</span>
          </p>
          <button
            onClick={toggle}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
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
    </div>
  );
}
