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
  Settings,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const NAV = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/applications", label: "Applications", icon: Briefcase },
  { to: "/interviews", label: "Interviews", icon: CalendarClock },
  { to: "/resumes", label: "Resumes", icon: FileText },
  { to: "/discover-jobs", label: "Discover Jobs", icon: Compass },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout({ children, toast }: { children: ReactNode; toast: string | null }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  const onLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
            <Link to="/home" className="flex items-center gap-2 text-lg font-bold tracking-tight text-blue-800">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-700 text-sm font-extrabold text-white">
                JT
              </span>
              JobTracker
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden items-center gap-2 text-slate-600 sm:inline-flex" title={user?.email}>
              <span aria-hidden="true" className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                {initial}
              </span>
              <span className="max-w-44 truncate">{user?.name || user?.email}</span>
            </span>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
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
          <nav className="space-y-1 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"
                  }`
                }
              >
                <n.icon size={17} aria-hidden="true" className="shrink-0" />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <p className="mt-3 hidden px-1 text-xs leading-relaxed text-slate-400 md:block">
            Discover → Save → Apply → Track. Powered by JobSetu intelligence.
          </p>
        </aside>

        <main className="min-w-0 flex-1">
          {toast && (
            <div className="reveal mb-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800" role="status">
              <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">✓</span>
              {toast}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
