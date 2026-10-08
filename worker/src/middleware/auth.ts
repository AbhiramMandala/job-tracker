import type { AuthUser, Env } from "../types";
import { bearerToken } from "../utils/cookies";
import { sha256Hex } from "../utils/crypto";

export const SESSION_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

export async function getSessionUser(req: Request, env: Env): Promise<AuthUser | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  // The role column exists after migration 0004; fall back to the pre-RBAC
  // select on older databases (role defaults to student).
  let row: { id: string; email: string; name: string; role?: string; created_at: string; expires_at: string } | null;
  try {
    row = await env.DB.prepare(
      `SELECT u.id, u.email, u.name, u.role, u.created_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? LIMIT 1`,
    )
      .bind(tokenHash)
      .first<{ id: string; email: string; name: string; role: string; created_at: string; expires_at: string }>();
  } catch {
    row = await env.DB.prepare(
      `SELECT u.id, u.email, u.name, u.created_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? LIMIT 1`,
    )
      .bind(tokenHash)
      .first<{ id: string; email: string; name: string; created_at: string; expires_at: string }>();
  }
  if (!row) return null;
  if (Date.parse(row.expires_at) < Date.now()) {
    await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(tokenHash).run().catch(() => {});
    return null;
  }
  const role = row.role === "admin" ? "admin" : "student";
  return { id: row.id, email: row.email, name: row.name, role, created_at: row.created_at };
}

export async function requireAuth(
  req: Request,
  env: Env,
): Promise<{ user: AuthUser } | { response: Response }> {
  const { fail } = await import("../utils/response");
  const user = await getSessionUser(req, env);
  if (!user) return { response: fail("UNAUTHORIZED", "Authentication required", 401) };
  return { user };
}

// Simple sliding-window rate limiter backed by KV (falls back to allow when KV missing).
export async function rateLimit(
  req: Request,
  env: Env,
  key: string,
  limit = 60,
  windowSec = 60,
): Promise<boolean> {
  try {
    if (!env.CACHE) return true;
    const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
    const k = `rl:${key}:${ip}`;
    const raw = await env.CACHE.get(k);
    const count = raw ? Number(raw) : 0;
    if (count >= limit) return false;
    if (count === 0) await env.CACHE.put(k, "1", { expirationTtl: windowSec });
    else {
      // Best-effort increment; KV has no atomic incr.
      await env.CACHE.put(k, String(count + 1), { expirationTtl: windowSec });
    }
    return true;
  } catch {
    return true;
  }
}

