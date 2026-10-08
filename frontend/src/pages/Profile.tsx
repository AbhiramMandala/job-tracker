import { useNavigate } from "react-router-dom";
import { KeyRound, LogOut, ShieldCheck, User } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { describePermissions } from "../auth/permissions";
import { PageHeader } from "../components/ui";

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <PageHeader title="Profile" description="Your account, role, and sign-in security." />

      <section aria-label="Account" className="reveal rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <User size={16} aria-hidden="true" className="text-slate-500 dark:text-slate-400" /> Account
        </h2>
        <dl className="mt-2 text-sm">
          <div className="flex justify-between gap-2 border-b border-slate-100 py-2 dark:border-slate-800"><dt className="text-slate-500 dark:text-slate-400">Name</dt><dd className="min-w-0 truncate">{user?.name || "—"}</dd></div>
          <div className="flex justify-between gap-2 border-b border-slate-100 py-2 dark:border-slate-800"><dt className="text-slate-500 dark:text-slate-400">Email</dt><dd className="min-w-0 truncate">{user?.email}</dd></div>
          <div className="flex justify-between gap-2 py-2"><dt className="text-slate-500 dark:text-slate-400">Member since</dt><dd>{user?.created_at.slice(0, 10)}</dd></div>
        </dl>
      </section>

      <section aria-label="Role and permissions" className="reveal rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" style={{ "--reveal-delay": "60ms" } as React.CSSProperties}>
        <h2 className="flex items-center gap-1.5 font-semibold">
          <ShieldCheck size={16} aria-hidden="true" className="text-slate-500 dark:text-slate-400" /> Role &amp; permissions
        </h2>
        <p className="mt-2 text-sm">
          <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-950 px-2.5 py-0.5 text-xs font-semibold capitalize text-blue-800 dark:text-blue-300">
            {user?.role ?? "student"}
          </span>
        </p>
        <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
          {describePermissions(user?.role).map((d) => (
            <li key={d}>• {d}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
          Permissions are enforced by the server on every request — this page only describes them.
        </p>
      </section>

      <section aria-label="Sign-in security" className="reveal rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" style={{ "--reveal-delay": "120ms" } as React.CSSProperties}>
        <h2 className="flex items-center gap-1.5 font-semibold">
          <KeyRound size={16} aria-hidden="true" className="text-slate-500 dark:text-slate-400" /> Sign-in &amp; security
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          You&apos;re signed in with a secure server-side session (7-day expiry). Your password is
          stored only as a one-way hash — never in plain text, never in this browser.
        </p>
        <button
          onClick={() => void signOut()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          <LogOut size={15} aria-hidden="true" /> Sign out on this device
        </button>
      </section>
    </div>
  );
}
