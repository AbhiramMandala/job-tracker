import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
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
  ShieldCheck,
  Sun,
  User,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { isAdmin } from "../auth/permissions";
import { Footer } from "./Footer";

const NAV = [
  { to: "/home", label: "Home", icon: Home, end: true },
  { to: "/discover", label: "Discover Jobs", icon: Compass, end: false },
  { to: "/applications", label: "Applications", icon: Briefcase, end: false },
  { to: "/interviews", label: "Interviews", icon: CalendarClock, end: false },
  { to: "/resumes", label: "Resumes", icon: FileText, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
];

const TITLES: Record<string, string> = {
  "/home": "Home",
  "/discover": "Discover Jobs",
  "/applications": "Applications",
  "/interviews": "Interviews",
  "/resumes": "Resumes",
  "/settings": "Settings",
  "/profile": "Profile",
  "/admin": "Admin",
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/applications/")) return "Application";
  return "JobTracker";
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();
  const admin = isAdmin(user?.role);

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  const close = useCallback(() => {
    setOpen(false);
    toggleBtnRef.current?.focus();
  }, []);

  // Drawer behavior on every breakpoint: Escape closes, body scroll locks,
  // focus moves into the drawer and returns to the toggle on close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  // Background content is inert while the drawer is open (no interaction,
  // hidden from assistive tech); focus returns to the toggle on close.
  useEffect(() => {
    const el = contentRef.current;
    if (el) (el as HTMLElement & { inert?: boolean }).inert = open;
  }, [open ]);

  // Close the drawer on route change (e.g. link click).
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
          <button
            ref={toggleBtnRef}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="app-nav"
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
          <Link to="/home" className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-blue-800 dark:text-blue-300">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-700 text-sm font-extrabold text-white">
              JT
            </span>
            <span className="hidden min-[420px]:inline">JobTracker</span>
          </Link>
          <p className="min-w-0 flex-1 truncate px-1 text-sm font-medium text-slate-500 dark:text-slate-400" aria-live="polite">
            {titleFor(location.pathname)}
          </p>
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <button
              onClick={toggle}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 px-0 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
            </button>
            <Link
              to="/profile"
              aria-label="Open your profile"
              title={user?.email}
              className="inline-flex items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span aria-hidden="true" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                {initial}
              </span>
              <span className="hidden max-w-32 truncate text-slate-600 dark:text-slate-400 lg:inline">{user?.name || user?.email}</span>
            </Link>
            <button
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
            >
              <LogOut size={15} aria-hidden="true" />
              <span className="hidden sm:inline sm:pl-1.5">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Drawer backdrop: dims the page and blocks interaction. */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[2px]"
          onClick={close}
          aria-hidden="true"
          data-testid="nav-backdrop"
        />
      )}

      <div ref={contentRef} className="mx-auto w-full max-w-6xl flex-1 px-4 py-4">
        <main className="min-w-0">
          {children}
        </main>
      </div>

      {/* Navigation drawer (all breakpoints — no permanent sidebar). */}
      <div
        id="app-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        className={[
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-slate-900 p-3 pt-4 shadow-xl",
          "transition-transform duration-150 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="flex items-center gap-2 text-base font-bold text-blue-800 dark:text-blue-300">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-700 text-xs font-extrabold text-white">JT</span>
            JobTracker
          </span>
          <button
            ref={closeBtnRef}
            onClick={close}
            aria-label="Close navigation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <nav className="space-y-1 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-sm" style={{ maxHeight: "calc(100dvh - 7rem)" }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`
              }
            >
              <n.icon size={17} aria-hidden="true" className="shrink-0" />
              {n.label}
            </NavLink>
          ))}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`
            }
          >
            <User size={17} aria-hidden="true" className="shrink-0" />
            Profile
          </NavLink>
          {admin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`
              }
            >
              <ShieldCheck size={17} aria-hidden="true" className="shrink-0" />
              Admin
            </NavLink>
          )}
          <button
            onClick={() => { void onLogout(); close(); }}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <LogOut size={17} aria-hidden="true" className="shrink-0" />
            Logout
          </button>
        </nav>
        <p className="mt-3 px-1 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          Save → Apply → Track.
        </p>
      </div>

      <Footer />
    </div>
  );
}
