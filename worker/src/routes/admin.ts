import type { AuthUser, Env } from "../types";
import { fail, json, readJson, log } from "../utils/response";
import { isRole } from "../types";
import { hashPassword, newId } from "../utils/crypto";
import { emailFieldError } from "../validation/schemas";

/** Public user shape — never password hashes, tokens, or secrets. */
function publicUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? "",
    role: u.role === "admin" ? "admin" : "student",
    created_at: u.created_at,
    updated_at: u.updated_at ?? u.created_at,
  };
}

/** GET /api/admin/users — admin-only user list (no password hashes).
 *  Supports ?search=&role=&page=&limit= (limit max 100, default 50). */
export async function listUsers(req: Request, env: Env, _user: AuthUser): Promise<Response> {
  const url = new URL(req.url);
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 200);
  const roleFilter = (url.searchParams.get("role") ?? "").trim();
  if (roleFilter && !isRole(roleFilter)) return fail("VALIDATION_ERROR", "role must be student or admin", 400);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "50") || 50));
  const offset = (page - 1) * limit;

  try {
    const where: string[] = [];
    const binds: unknown[] = [];
    if (search) {
      where.push("(email LIKE ? OR name LIKE ?)");
      binds.push(`%${search}%`, `%${search}%`);
    }
    if (roleFilter) {
      where.push("role = ?");
      binds.push(roleFilter);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM users ${whereSql}`)
      .bind(...binds)
      .first<{ total: number }>();
    const total = Number(totalRow?.total ?? 0);
    const { results } = await env.DB.prepare(
      `SELECT id, email, name, role, created_at, updated_at FROM users ${whereSql} ORDER BY created_at ASC LIMIT ? OFFSET ?`,
    )
      .bind(...binds, limit, offset)
      .all();
    return json({
      items: ((results ?? []) as any[]).map(publicUser),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch {
    // Pre-RBAC database without the role column.
    const r = await env.DB.prepare(`SELECT id, email, name, created_at FROM users ORDER BY created_at ASC LIMIT 200`).all();
    const rows = ((r.results ?? []) as any[]).map((u) => ({ ...u, role: "student" }));
    return json({ items: rows.map(publicUser), pagination: { page: 1, limit: 200, total: rows.length, totalPages: 1 } });
  }
}

/** GET /api/admin/users/:id — detail with non-sensitive usage counts. */
export async function getUser(_req: Request, env: Env, _user: AuthUser, id: string): Promise<Response> {
  const row = await env.DB.prepare(`SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<any>();
  if (!row) return fail("NOT_FOUND", "User not found", 404);
  const count = async (table: string, extra = "") => {
    const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ? ${extra}`)
      .bind(id)
      .first<{ n: number }>()
      .catch(() => ({ n: 0 }));
    return Number(r?.n ?? 0);
  };
  // Table names are fixed literals, never user input.
  const [applications, interviews, notes, resumes, sessions] = await Promise.all([
    count("applications"),
    count("interviews"),
    count("notes"),
    count("resumes"),
    count("sessions"),
  ]);
  return json({ ...publicUser(row), counts: { applications, interviews, notes, resumes, sessions } });
}

async function adminCount(env: Env): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = ?`)
    .bind("admin")
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/** Shared guard for role demotions. Returns an error Response or null. */
async function denyUnsafeDemotion(env: Env, actorId: string, targetId: string, newRole: string): Promise<Response | null> {
  if (targetId === actorId) return fail("VALIDATION_ERROR", "You cannot change your own role", 400);
  if (newRole !== "admin") {
    const target = await env.DB.prepare(`SELECT role FROM users WHERE id = ? LIMIT 1`).bind(targetId).first<{ role: string }>();
    if (removesLastAdmin(await adminCount(env), target?.role ?? null, false))
      return fail("CONFLICT", "Cannot demote the last administrator", 409);
  }
  return null;
}

/**
 * True when an operation would leave zero administrators: the target
 * currently is one, the headcount is already at one, and the target does
 * not keep admin rights. Pure helper so the safeguard itself is
 * unit-testable; through the API it is defense-in-depth (a second admin
 * must exist to even reach the check).
 */
export function removesLastAdmin(adminCount: number, targetRole: string | null, targetKeepsAdmin: boolean): boolean {
  return !targetKeepsAdmin && targetRole === "admin" && adminCount <= 1;
}

/** POST /api/admin/users {email, password, name?, role?} — create a user. */
export async function createUser(req: Request, env: Env, _user: AuthUser): Promise<Response> {
  const body = await readJson<{ email?: unknown; password?: unknown; name?: unknown; role?: unknown }>(req);
  if (!body || typeof body !== "object") return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  const emailErr = emailFieldError(body.email);
  if (emailErr) return fail("VALIDATION_ERROR", emailErr.message, 400, [emailErr]);
  const email = String(body.email).trim().toLowerCase();
  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128)
    return fail("VALIDATION_ERROR", "Password must be 8-128 characters", 400, [{ field: "password", message: "Password must be 8-128 characters" }]);
  if (body.name !== undefined && (typeof body.name !== "string" || body.name.length > 120))
    return fail("VALIDATION_ERROR", "Name must be at most 120 characters", 400, [{ field: "name", message: "Name must be at most 120 characters" }]);
  const role = body.role === undefined ? "student" : body.role;
  if (!isRole(role)) return fail("VALIDATION_ERROR", "role must be student or admin", 400);

  const existing = await env.DB.prepare(`SELECT id FROM users WHERE email = ? LIMIT 1`).bind(email).first();
  if (existing) return fail("CONFLICT", "Email already registered", 409);

  const id = newId();
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, email, await hashPassword(body.password), String(body.name ?? "").slice(0, 120), role, now, now)
      .run();
  } catch {
    return fail("INTERNAL_ERROR", "User management requires migration 0004", 500);
  }
  log(req, env, "admin created user", email, role);
  const row = await env.DB.prepare(`SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<any>();
  return json(publicUser(row), 201);
}

/** PUT /api/admin/users/:id {name?, role?} — update name and/or role. */
export async function updateUser(req: Request, env: Env, user: AuthUser, id: string): Promise<Response> {
  const body = await readJson<{ name?: unknown; role?: unknown }>(req);
  if (!body || typeof body !== "object") return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  const existing = await env.DB.prepare(`SELECT id FROM users WHERE id = ? LIMIT 1`).bind(id).first();
  if (!existing) return fail("NOT_FOUND", "User not found", 404);

  const sets: string[] = [];
  const binds: unknown[] = [];
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.length > 120)
      return fail("VALIDATION_ERROR", "Name must be at most 120 characters", 400);
    sets.push("name = ?");
    binds.push(body.name);
  }
  if (body.role !== undefined) {
    if (!isRole(body.role)) return fail("VALIDATION_ERROR", "role must be student or admin", 400);
    const denied = await denyUnsafeDemotion(env, user.id, id, body.role).catch(() => null);
    if (denied) return denied;
    sets.push("role = ?");
    binds.push(body.role);
  }
  if (!sets.length) return fail("VALIDATION_ERROR", "Nothing to update", 400);
  sets.push("updated_at = ?");
  binds.push(new Date().toISOString());
  try {
    await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...binds, id).run();
  } catch {
    return fail("INTERNAL_ERROR", "User management requires migration 0004", 500);
  }
  if (env.CACHE) await env.CACHE.delete(`dashboard:${id}`).catch(() => {});
  log(req, env, "admin updated user", id, sets.join(","));
  const row = await env.DB.prepare(`SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<any>();
  return json(publicUser(row));
}

/** PUT /api/admin/users/:id/role {role} — promote/demote (never self, never last admin). */
export async function setUserRole(req: Request, env: Env, user: AuthUser, id: string): Promise<Response> {
  const body = await readJson<{ role?: unknown }>(req);
  if (!isRole(body?.role)) return fail("VALIDATION_ERROR", "role must be student or admin", 400);
  const existing = await env.DB.prepare(`SELECT id FROM users WHERE id = ? LIMIT 1`).bind(id).first();
  if (!existing) return fail("NOT_FOUND", "User not found", 404);
  const denied = await denyUnsafeDemotion(env, user.id, id, body.role).catch(() =>
    fail("INTERNAL_ERROR", "Role management requires migration 0004", 500),
  );
  if (denied) return denied;
  try {
    await env.DB.prepare(`UPDATE users SET role = ?, updated_at = ? WHERE id = ?`)
      .bind(body.role, new Date().toISOString(), id)
      .run();
  } catch {
    return fail("INTERNAL_ERROR", "Role management requires migration 0004", 500);
  }
  // Invalidate any cached dashboard for the affected user.
  if (env.CACHE) await env.CACHE.delete(`dashboard:${id}`).catch(() => {});
  log(req, env, "admin set role", id, body.role);
  return json({ ok: true, id, role: body.role });
}

/** DELETE /api/admin/users/:id — delete a user and all of their data. */
export async function deleteUser(req: Request, env: Env, user: AuthUser, id: string): Promise<Response> {
  const existing = await env.DB.prepare(`SELECT id, email, role FROM users WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<{ id: string; email: string; role: string }>();
  if (!existing) return fail("NOT_FOUND", "User not found", 404);
  if (id === user.id) return fail("VALIDATION_ERROR", "You cannot delete your own account", 400);
  if (removesLastAdmin(await adminCount(env).catch(() => 2), existing.role, false))
    return fail("CONFLICT", "Cannot delete the last administrator", 409);

  // R2 files are NOT cascade-deleted by D1 — remove them explicitly first.
  const { results } = await env.DB.prepare(`SELECT r2_key FROM resumes WHERE user_id = ? LIMIT 500`)
    .bind(id)
    .all<{ r2_key: string }>()
    .catch(() => ({ results: [] as { r2_key: string }[] }));
  for (const r of results ?? []) {
    await env.RESUMES.delete(r.r2_key).catch(() => {});
  }
  await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();
  if (env.CACHE) await env.CACHE.delete(`dashboard:${id}`).catch(() => {});
  log(req, env, "admin deleted user", existing.email);
  return json({ ok: true, id });
}
