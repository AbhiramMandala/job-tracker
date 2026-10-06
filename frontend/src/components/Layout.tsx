import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const NAV = [
  { to: "/home", label: "Home" },
  { to: "/applications", label: "Applications" },
  { to: "/interviews", label: "Interviews" },
  { to: "/resumes", label: "Resumes" },
  { to: "/discover-jobs", label: "Discover Jobs" },
  { to: "/settings", label: "Settings" },
];

export function Layout({ children, toast }: { children: ReactNode; toast: string | null }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md border border-slate-300 px-2 py-1 text-sm md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <Link to="/home" className="text-lg font-bold text-blue-700">
              JobTracker
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">{user?.email}</span>
            <button
              onClick={onLogout}
              className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
            >
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
          <nav className="space-y-1 rounded-lg bg-white p-3 shadow-sm">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm font-medium ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          {toast && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800" role="status">
              {toast}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
