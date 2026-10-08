import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const PRODUCT = [
  { to: "/discover", label: "Discover Jobs" },
  { to: "/applications", label: "Applications" },
  { to: "/interviews", label: "Interviews" },
  { to: "/resumes", label: "Resumes" },
];

const ACCOUNT_AUTHED = [
  { to: "/home", label: "Home" },
  { to: "/profile", label: "Profile" },
  { to: "/settings", label: "Settings" },
];

const ACCOUNT_PUBLIC = [
  { to: "/sign-in", label: "Sign in" },
  { to: "/sign-up", label: "Sign up" },
];

export function Footer() {
  // The footer renders inside the authenticated app shell, so account links
  // always reflect the signed-in state — never Sign in/Sign up next to Logout.
  const { user } = useAuth();
  const account = user ? ACCOUNT_AUTHED : ACCOUNT_PUBLIC;
  return (
    <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold tracking-tight text-blue-800 dark:text-blue-300">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-700 text-xs font-extrabold text-white">
              JT
            </span>
            JobTracker
          </p>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Track applications, interviews, and resumes in one career workspace.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Product</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {PRODUCT.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Account">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Account</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {account.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-800">
        <p className="mx-auto max-w-6xl px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} JobTracker. Your data stays in your account.
        </p>
      </div>
    </footer>
  );
}
