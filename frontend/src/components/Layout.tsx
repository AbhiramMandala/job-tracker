import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Briefcase,
  CalendarClock,
  Compass,
  FileText,
  Home,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";

const NAV = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/applications", label: "Applications", icon: Briefcase },
  { to: "/interviews", label: "Interviews", icon: CalendarClock },
  { to: "/resumes", label: "Resumes", icon: FileText },
  { to: "/discover-jobs", label: "Discover Jobs", icon: Compass },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
            <Link to="/home" className="flex items-center gap-2 text-lg font-bold tracking-tight text-blue-800 dark:text-blue-300">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-700 text-sm font-extrabold text-white">
                JT
              </span>
              JobTracker
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={toggle}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 px-0 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
            </button>
            <span className="hidden items-center gap-2 text-slate-600 dark:text-slate-400 sm:inline-flex" title={user?.email}>
              <span aria-hidden="true" className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                {initial}
              </span>
              <span className="max-w-44 truncate">{user?.name || user?.email}</span>
            </span>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <LogOut size={15} aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside
          className={`${open ? "block" : "hidden"} w-52 shrink-0 md:block`}
          aria-label="Sidebar navigation"
        >
          <nav className="space-y-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-sm">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`
                }
              >
                <n.icon size={17} aria-hidden="true" className="shrink-0" />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <p className="mt-3 hidden px-1 text-xs leading-relaxed text-slate-400 dark:text-slate-500 md:block">
            Discover → Save → Apply → Track. Powered by JobSetu intelligence.
          </p>
        </aside>

        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

