import type { Env } from "../types";
import { fail, json, readJson, log } from "../utils/response";
import { hashPassword, newId, newToken, sha256Hex } from "../utils/crypto";
import { validateForgotPassword, validateResetPassword } from "../validation/schemas";

export const RESET_TTL_SEC = 60 * 60; // 1 hour
const GENERIC_FAILURE = "Invalid or expired reset link";

/** Constant-time hex comparison (mirrors verifyPassword). */
function tokensEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * POST /api/auth/forgot-password {email}
 * Always returns ok (no account enumeration). When the account exists, a
 * single-use 1-hour token is stored (SHA-256 hash only) and the reset link is
 * written to the server log — visible in the `wrangler dev` terminal locally
 * and in Workers Logs when deployed (both account-private). Plug in an email
 * provider here for production delivery.
 */
export async function handleForgotPassword(req: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: string }>(req);
  const errs = validateForgotPassword(body ?? {});
  if (errs.length) return fail("VALIDATION_ERROR", "Invalid request", 400, errs);
  const email = String(body!.email).trim().toLowerCase();

  // Best-effort purge of stale tokens.
  await env.DB.prepare(`DELETE FROM password_resets WHERE expires_at <= ?`)
    .bind(new Date().toISOString())
    .run()
    .catch(() => {});

  const user = await env.DB.prepare(`SELECT id, email FROM users WHERE email = ? LIMIT 1`)
    .bind(email)
    .first<{ id: string; email: string }>();
  if (user) {
    const selector = newToken().slice(0, 32);
    const token = newToken();
    const tokenHash = await sha256Hex(token);
    const now = new Date();
    const expires = new Date(now.getTime() + RESET_TTL_SEC * 1000).toISOString();
    // One outstanding token per request; older ones for this user are revoked.
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM password_resets WHERE user_id = ?`).bind(user.id),
      env.DB.prepare(
        `INSERT INTO password_resets (id, user_id, selector, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(newId(), user.id, selector, tokenHash, expires, now.toISOString()),
    ]);
    const origin = (env.FRONTEND_ORIGIN ?? "http://localhost:5173").replace(/\/+$/, "");
    log(req, env, `password reset link for ${email}: ${origin}/reset-password?selector=${selector}&token=${token}`);
  }
  return json({ ok: true });
}

/**
 * POST /api/auth/reset-password {selector, token, new_password}
 * All failure modes return the same generic message (no oracle for
 * account/reset existence). On success all sessions are revoked.
 */
export async function handleResetPassword(req: Request, env: Env): Promise<Response> {
  const body = await readJson<{ selector?: unknown; token?: unknown; new_password?: unknown }>(req);
  const errs = validateResetPassword(body ?? {});
  if (errs.length) return fail("VALIDATION_ERROR", GENERIC_FAILURE, 400);

  const row = await env.DB.prepare(`SELECT id, user_id, token_hash, expires_at FROM password_resets WHERE selector = ? LIMIT 1`)
    .bind(String(body!.selector))
    .first<{ id: string; user_id: string; token_hash: string; expires_at: string }>();
  if (!row) return fail("VALIDATION_ERROR", GENERIC_FAILURE, 400);
  if (Date.parse(row.expires_at) < Date.now()) {
    await env.DB.prepare(`DELETE FROM password_resets WHERE id = ?`).bind(row.id).run().catch(() => {});
    return fail("VALIDATION_ERROR", GENERIC_FAILURE, 400);
  }
  const presented = await sha256Hex(String(body!.token));
  if (!tokensEqual(presented, row.token_hash)) return fail("VALIDATION_ERROR", GENERIC_FAILURE, 400);

  const password_hash = await hashPassword(String(body!.new_password));
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).bind(password_hash, now, row.user_id),
    env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(row.user_id),
    env.DB.prepare(`DELETE FROM password_resets WHERE user_id = ?`).bind(row.user_id),
  ]);
  log(req, env, "password reset completed");
  return json({ ok: true });
}
