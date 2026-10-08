import type { Env } from "../types";
import { fail, json, readJson, log } from "../utils/response";
import { hashPassword, newId, newToken, sha256Hex, verifyPassword } from "../utils/crypto";
import { clearSessionCookie, sessionCookie } from "../utils/cookies";
import { validateLogin, validateRegister } from "../validation/schemas";
import { getSessionUser, SESSION_TTL_SEC } from "../middleware/auth";

function isSecure(req: Request): boolean {
  return new URL(req.url).protocol === "https:";
}

export async function handleRegister(req: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: string; password?: string; name?: string }>(req);
  const errs = validateRegister(body ?? {});
  if (errs.length) return fail("VALIDATION_ERROR", "Invalid registration data", 400, errs);
  const email = String(body!.email).trim().toLowerCase();
  const name = String(body!.name ?? "").slice(0, 120);

  const existing = await env.DB.prepare(`SELECT id FROM users WHERE email = ? LIMIT 1`).bind(email).first();
  if (existing) return fail("CONFLICT", "Email already registered", 409);

  const password_hash = await hashPassword(body!.password!);
  const id = newId();
  const now = new Date().toISOString();
  // The role column may not exist on databases that have not applied
  // migration 0004 yet; default to student either way.
  try {
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'student', ?, ?)`,
    )
      .bind(id, email, password_hash, name, now, now)
      .run();
  } catch {
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, email, password_hash, name, now, now)
      .run();
  }

  const token = newToken();
  const tokenHash = await sha256Hex(token);
  const expires = new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(newId(), id, tokenHash, expires, now)
    .run();

  log(req, env, "register", email);
  const headers = { "Set-Cookie": sessionCookie(token, SESSION_TTL_SEC, isSecure(req)) };
  return json({ user: { id, email, name, role: "student", created_at: now }, token }, 201, headers);
}

export async function handleLogin(req: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: string; password?: string }>(req);
  const errs = validateLogin(body ?? {});
  if (errs.length) return fail("VALIDATION_ERROR", "Invalid login data", 400, errs);
  const email = String(body!.email).trim().toLowerCase();

  // The role column exists after migration 0004; fall back to the
  // pre-RBAC select on older databases (role defaults to student).
  let row: { id: string; email: string; name: string; password_hash: string; created_at: string; role?: string } | null;
  try {
    row = await env.DB.prepare(
      `SELECT id, email, name, password_hash, role, created_at FROM users WHERE email = ? LIMIT 1`,
    )
      .bind(email)
      .first<{ id: string; email: string; name: string; password_hash: string; role: string; created_at: string }>();
  } catch {
    row = await env.DB.prepare(`SELECT id, email, name, password_hash, created_at FROM users WHERE email = ? LIMIT 1`)
      .bind(email)
      .first<{ id: string; email: string; name: string; password_hash: string; created_at: string }>();
  }
  // Generic message to avoid user enumeration.
  if (!row) return fail("UNAUTHORIZED", "Invalid email or password", 401);
  const ok = await verifyPassword(body!.password!, row.password_hash);
  if (!ok) return fail("UNAUTHORIZED", "Invalid email or password", 401);
  const role: "student" | "admin" = row.role === "admin" ? "admin" : "student";

  const token = newToken();
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(newId(), row.id, tokenHash, expires, now)
    .run();

  log(req, env, "login", email);
  const headers = { "Set-Cookie": sessionCookie(token, SESSION_TTL_SEC, isSecure(req)) };
  return json(
    { user: { id: row.id, email: row.email, name: row.name, role, created_at: row.created_at }, token },
    200,
    headers,
  );
}

export async function handleLogout(req: Request, env: Env): Promise<Response> {
  const { bearerToken } = await import("../utils/cookies");
  const token = bearerToken(req);
  if (token) {
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(tokenHash).run().catch(() => {});
  }
  const headers = { "Set-Cookie": clearSessionCookie(isSecure(req)) };
  return json({ ok: true }, 200, headers);
}

export async function handleMe(req: Request, env: Env): Promise<Response> {
  const user = await getSessionUser(req, env);
  if (!user) return fail("UNAUTHORIZED", "Authentication required", 401);
  return json({ user });
}


