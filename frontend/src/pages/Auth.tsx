import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { FieldError, inputCls } from "../components/ui";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-md px-4 sm:mt-16">
      <div className="reveal rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" style={{ "--reveal-delay": "60ms" } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-700 text-sm font-extrabold text-white">JT</span>
          <span className="text-sm font-semibold text-slate-500">Your career, in one place</span>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">Pick up your job search where you left off.</p>
        <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
          <div>
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" type="email" autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input id="password" type="password" autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <FieldError message={error ?? undefined} />
          <button disabled={busy} className="btn-shine w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          No account? <Link to="/sign-up" className="font-medium text-blue-700 underline">Register</Link>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("Enter a valid email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await register(email.trim(), password, name.trim());
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-md px-4 sm:mt-16">
      <div className="reveal rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" style={{ "--reveal-delay": "60ms" } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-700 text-sm font-extrabold text-white">JT</span>
          <span className="text-sm font-semibold text-slate-500">Your career, in one place</span>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Create account</h1>
        <p className="mt-1 text-sm text-slate-600">Discover jobs, track applications, prepare for interviews.</p>
        <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
          <div>
            <label htmlFor="name" className="text-sm font-medium">Name</label>
            <input id="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">Password (8+ chars)</label>
            <input id="password" type="password" autoComplete="new-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <FieldError message={error ?? undefined} />
          <button disabled={busy} className="btn-shine w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            {busy ? "Creating…" : "Register"}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          Have an account? <Link to="/sign-in" className="font-medium text-blue-700 underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}


