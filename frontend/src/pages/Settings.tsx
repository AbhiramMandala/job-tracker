import { useAuth } from "../hooks/useAuth";

export function SettingsPage() {
  const { user } = useAuth();
  const apiUrl = import.meta.env.VITE_API_URL || "(same origin / dev proxy)";

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Account</h2>
        <dl className="mt-2 text-sm">
          <div className="flex justify-between border-b border-slate-100 py-2"><dt className="text-slate-500">Name</dt><dd>{user?.name || "—"}</dd></div>
          <div className="flex justify-between border-b border-slate-100 py-2"><dt className="text-slate-500">Email</dt><dd>{user?.email}</dd></div>
          <div className="flex justify-between py-2"><dt className="text-slate-500">Member since</dt><dd>{user?.created_at.slice(0, 10)}</dd></div>
        </dl>
      </section>
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Configuration</h2>
        <p className="mt-2 text-sm text-slate-600">API base URL: <code className="rounded bg-slate-100 px-1">{apiUrl}</code></p>
        <p className="mt-2 text-sm text-slate-600">
          Sessions persist via Bearer token in localStorage plus an HttpOnly cookie set by the Worker.
          Dashboard stats are cached in KV for 60s; D1 is the source of truth.
        </p>
      </section>
    </div>
  );
}
