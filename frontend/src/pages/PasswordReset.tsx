import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { FieldError, inputCls } from "../components/ui";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Enter your account email.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/auth/forgot-password", { email: email.trim() });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-md px-4 sm:mt-16">
      <div className="reveal rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8" style={{ "--reveal-delay": "60ms" } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-700 text-sm font-extrabold text-white">JT</span>
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Your career, in one place</span>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Reset password</h1>
        {done ? (
          <div role="status" className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <p>If an account exists for <span className="font-medium">{email.trim()}</span>, a reset link was generated.</p>
            <p>Local development: find the link in the Worker terminal output (the server log), then open it to choose a new password. Links expire after 1 hour and work once.</p>
            <Link to="/sign-in" className="inline-block font-medium text-blue-700 dark:text-blue-400 underline">Back to Sign in</Link>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Enter your account email and we&apos;ll generate a one-time reset link.</p>
            <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
              <div>
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <input id="email" type="email" autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <FieldError message={error ?? undefined} />
              <button disabled={busy} className="btn-shine w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              Remembered it? <Link to="/sign-in" className="font-medium text-blue-700 dark:text-blue-400 underline">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const params = new URLSearchParams(window.location.search);
  const selector = params.get("selector") ?? "";
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const linkValid = /^[0-9a-f]{32}$/.test(selector) && /^[0-9a-f]{64}$/.test(token);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/auth/reset-password", { selector, token, new_password: password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-md px-4 sm:mt-16">
      <div className="reveal rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8" style={{ "--reveal-delay": "60ms" } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-700 text-sm font-extrabold text-white">JT</span>
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Your career, in one place</span>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Choose a new password</h1>
        {done ? (
          <div role="status" className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <p>Password updated. All other sessions were signed out.</p>
            <Link to="/sign-in" className="inline-block font-medium text-blue-700 dark:text-blue-400 underline">Sign in with your new password</Link>
          </div>
        ) : !linkValid ? (
          <div role="alert" className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <p>This reset link is incomplete. Open the full link from the server output, or request a new one.</p>
            <Link to="/forgot-password" className="inline-block font-medium text-blue-700 dark:text-blue-400 underline">Request a new link</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
            <div>
              <label htmlFor="new-password" className="text-sm font-medium">New password (8+ chars)</label>
              <input id="new-password" type="password" autoComplete="new-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label htmlFor="confirm-password" className="text-sm font-medium">Confirm password</label>
              <input id="confirm-password" type="password" autoComplete="new-password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <FieldError message={error ?? undefined} />
            <button disabled={busy} className="btn-shine w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
