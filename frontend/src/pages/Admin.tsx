import { Fragment, useCallback, useEffect, useState } from "react";
import { Plus, ShieldAlert } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { isAdmin } from "../auth/permissions";
import type { Role } from "../types";
import { ConfirmModal, EmptyState, FieldError, PageHeader, RowSkeleton, inputCls } from "../components/ui";

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
  updated_at?: string;
}

interface ManagedUserDetail extends ManagedUser {
  counts: { applications: number; interviews: number; notes: number; resumes: number; sessions: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PAGE_LIMIT = 20;

function consequenceText(d: ManagedUserDetail): string {
  const c = d.counts;
  const parts = [
    `${c.applications} application${c.applications === 1 ? "" : "s"}`,
    `${c.interviews} interview${c.interviews === 1 ? "" : "s"}`,
    `${c.notes} note${c.notes === 1 ? "" : "s"}`,
    `${c.resumes} resume file${c.resumes === 1 ? "" : "s"}`,
  ];
  return `This permanently deletes ${d.email} and all of their data: ${parts.join(", ")}. This cannot be undone.`;
}

export function AdminPage({ notify }: { notify: (m: string) => void }) {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const [items, setItems] = useState<ManagedUser[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<ManagedUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ManagedUserDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { search?: string; role?: string; page?: number }) => {
    const s = opts?.search ?? search;
    const r = opts?.role ?? roleFilter;
    const p = opts?.page ?? page;
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(p), limit: String(PAGE_LIMIT) });
      if (s.trim()) q.set("search", s.trim());
      if (r) q.set("role", r);
      const d = await api.get<{ items: ManagedUser[]; pagination?: Pagination }>(`/api/admin/users?${q}`);
      setItems(d.items ?? []);
      setPagination(d.pagination ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, page]);

  useEffect(() => {
    if (!admin) {
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void load({ page: 1 });
  };

  const openDetail = async (u: ManagedUser) => {
    if (detail?.id === u.id) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const d = await api.get<ManagedUserDetail>(`/api/admin/users/${u.id}`);
      setDetail(d);
      setEditingName(d.name);
      setFormError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
    } finally {
      setDetailLoading(false);
    }
  };

  const createUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    const role = String(form.get("role") ?? "student");
    setFormError(null);
    setBusy(true);
    try {
      const created = await api.post<ManagedUser>("/api/admin/users", { email, password, name, role });
      setShowCreate(false);
      setItems((prev) => [created, ...prev]);
      notify(`Created ${created.email}.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    if (!detail || editingName === null) return;
    setFormError(null);
    setBusy(true);
    try {
      const updated = await api.put<ManagedUser>(`/api/admin/users/${detail.id}`, { name: editingName });
      setDetail({ ...detail, ...updated });
      setItems((prev) => prev.map((x) => (x.id === detail.id ? { ...x, ...updated } : x)));
      notify(`Updated ${detail.email}.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const setRole = async (u: ManagedUser, role: Role) => {
    if (u.id === user?.id) return; // server also rejects self-change
    setBusy(true);
    try {
      await api.put(`/api/admin/users/${u.id}/role`, { role });
      setItems((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
      if (detail?.id === u.id) setDetail({ ...detail, role });
      notify(`${u.email} is now ${role}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const requestDelete = async (u: ManagedUser) => {
    if (detail?.id === u.id) {
      setDeleting(detail);
      return;
    }
    setDetailLoading(true);
    try {
      const d = await api.get<ManagedUserDetail>(`/api/admin/users/${u.id}`);
      setDetail(d);
      setEditingName(d.name);
      setDeleting(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
    } finally {
      setDetailLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`/api/admin/users/${deleting.id}`);
      setItems((prev) => prev.filter((x) => x.id !== deleting.id));
      if (detail?.id === deleting.id) setDetail(null);
      setDeleting(null);
      notify(`Deleted ${deleting.email} and all of their data.`);
    } catch (err) {
      setDeleting(null);
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  if (!admin && !loading) {
    return (
      <div className="space-y-3">
        <PageHeader title="Admin" description="User and role management." />
        <EmptyState
          icon={ShieldAlert}
          title="Admin access required"
          body="Your account doesn't have administrative permissions. Contact an administrator if you need access."
          action={{ to: "/home", label: "Back to home" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title={`Admin${pagination && pagination.total > 0 ? ` (${pagination.total})` : ""}`}
        description="Users, roles, and access."
        actions={
          <button
            onClick={() => { setShowCreate((v) => !v); setFormError(null); }}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            <Plus size={16} aria-hidden="true" /> New user
          </button>
        }
      />

      {showCreate && (
        <form onSubmit={createUser} className="reveal grid gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm sm:grid-cols-2" aria-label="Create user">
          <input name="email" aria-label="Email" placeholder="Email" maxLength={254} className={inputCls} autoComplete="off" />
          <input name="name" aria-label="Name" placeholder="Name (optional)" maxLength={120} className={inputCls} autoComplete="off" />
          <input name="password" aria-label="Initial password" placeholder="Initial password (8+ chars)" type="password" autoComplete="new-password" className={inputCls} />
          <div className="flex gap-2">
            <select name="role" aria-label="Role" className={inputCls} defaultValue="student">
              <option value="student">student</option>
              <option value="admin">admin</option>
            </select>
            <button disabled={busy} className="shrink-0 rounded-md bg-slate-800 dark:bg-slate-200 px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-900 dark:hover:bg-slate-100 disabled:opacity-40">
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
          {formError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">{formError}</p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">Share the initial password with the user out-of-band. They can change it anytime via Forgot password.</p>
        </form>
      )}

      <form onSubmit={applyFilters} className="reveal flex flex-wrap gap-2" aria-label="Filter users">
        <input aria-label="Search users" placeholder="Search name or email…" className={`${inputCls} max-w-xs flex-1`} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter by role" className="w-auto rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          <option value="student">student</option>
          <option value="admin">admin</option>
        </select>
        <button className="rounded-md bg-slate-800 dark:bg-slate-200 px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-900 dark:hover:bg-slate-100">Filter</button>
      </form>

      {loading ? (
        <RowSkeleton rows={5} />
      ) : error ? (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-400" role="alert">
          {error} <button className="underline" onClick={() => void load()}>Try again</button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState art="pipeline" title="No users found" body="No users match these filters — or create the first user above." />
      ) : (
        <div className="reveal overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((u) => (
                <Fragment key={u.id}>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2">
                      <button onClick={() => void openDetail(u)} className="text-left font-medium text-blue-700 dark:text-blue-400 hover:underline" aria-expanded={detail?.id === u.id}>
                        {u.name || "—"}
                      </button>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{u.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-2">
                      {u.id === user?.id ? (
                        <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-950 px-2.5 py-0.5 text-xs font-semibold capitalize text-blue-800 dark:text-blue-300">
                          {u.role} (you)
                        </span>
                      ) : (
                        <select
                          aria-label={`Role for ${u.email}`}
                          className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm disabled:opacity-40"
                          value={u.role}
                          disabled={busy}
                          onChange={(e) => void setRole(u, e.target.value as Role)}
                        >
                          <option value="student">student</option>
                          <option value="admin">admin</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {u.id !== user?.id && (
                        <button
                          onClick={() => void requestDelete(u)}
                          className="rounded-md border border-red-300 dark:border-red-700 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                  {detail?.id === u.id && (
                    <tr key={`${u.id}-detail`} className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <td colSpan={4} className="px-4 py-3">
                        {detailLoading ? (
                          <p className="text-sm text-slate-500">Loading…</p>
                        ) : (
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                            <span className="text-slate-600 dark:text-slate-400">
                              {detail.counts.applications} applications · {detail.counts.interviews} interviews · {detail.counts.notes} notes · {detail.counts.resumes} resumes · {detail.counts.sessions} sessions
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <label htmlFor={`name-${u.id}`} className="text-slate-500 dark:text-slate-400">Name</label>
                              <input
                                id={`name-${u.id}`}
                                className="w-40 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                                value={editingName ?? ""}
                                onChange={(e) => setEditingName(e.target.value)}
                              />
                              <button
                                disabled={busy}
                                onClick={() => void saveName()}
                                className="rounded-md bg-slate-800 dark:bg-slate-200 px-3 py-1 text-sm font-semibold text-white dark:text-slate-900 disabled:opacity-40"
                              >
                                Save name
                              </button>
                            </span>
                            {formError && <span role="alert" className="text-sm text-red-600 dark:text-red-400">{formError}</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination !== null && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            disabled={page <= 1}
            onClick={() => { const p = page - 1; setPage(p); void load({ page: p }); }}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-slate-600 dark:text-slate-400">Page {pagination.page} of {pagination.totalPages} ({pagination.total} users)</span>
          <button
            disabled={page >= pagination.totalPages}
            onClick={() => { const p = page + 1; setPage(p); void load({ page: p }); }}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title={`Delete ${deleting.email}?`}
          body={consequenceText(deleting)}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}
