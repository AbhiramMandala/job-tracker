import type { AuthUser, Env } from "../types";
import { fail, json, readJson } from "../utils/response";
import { newId } from "../utils/crypto";
import { validateInterview, validateNote } from "../validation/schemas";

// ---- Interviews ----
export async function listInterviews(req: Request, env: Env, user: AuthUser): Promise<Response> {
  const url = new URL(req.url);
  const applicationId = url.searchParams.get("application_id") ?? url.searchParams.get("applicationId") ?? "";
  const upcoming = url.searchParams.get("upcoming");
  let sql = `SELECT i.*, a.company, a.job_title FROM interviews i JOIN applications a ON a.id = i.application_id WHERE i.user_id = ?`;
  const binds: unknown[] = [user.id];
  if (applicationId) {
    sql += ` AND i.application_id = ?`;
    binds.push(applicationId);
  }
  if (upcoming === "true") {
    sql += ` AND i.scheduled_at >= ?`;
    binds.push(new Date().toISOString());
  }
  sql += ` ORDER BY i.scheduled_at ASC LIMIT 200`;
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return json({ items: results ?? [] });
}

export async function createInterview(req: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = await readJson<any>(req);
  const errs = validateInterview(body ?? {});
  if (errs.length) return fail("VALIDATION_ERROR", "Invalid interview data", 400, errs);
  // Ownership check: application must belong to user.
  const app = await env.DB.prepare(`SELECT id FROM applications WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(String(body.application_id), user.id)
    .first();
  if (!app) return fail("NOT_FOUND", "Application not found", 404);

  const id = newId();
  const now = new Date().toISOString();
  const row = {
    id,
    user_id: user.id,
    application_id: String(body.application_id),
    interview_type: body.interview_type ?? "TECHNICAL",
    scheduled_at: String(body.scheduled_at),
    interviewer: String(body.interviewer ?? ""),
    meeting_url: String(body.meeting_url ?? ""),
    notes: String(body.notes ?? ""),
    result: String(body.result ?? ""),
    created_at: now,
    updated_at: now,
  };
  await env.DB.prepare(
    `INSERT INTO interviews (id, user_id, application_id, interview_type, scheduled_at, interviewer, meeting_url, notes, result, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(row.id, row.user_id, row.application_id, row.interview_type, row.scheduled_at, row.interviewer, row.meeting_url, row.notes, row.result, row.created_at, row.updated_at)
    .run();
  if (env.CACHE) await env.CACHE.delete(`dashboard:${user.id}`).catch(() => {});
  return json(row, 201);
}

export async function updateInterview(req: Request, env: Env, user: AuthUser, id: string): Promise<Response> {
  const existing = await env.DB.prepare(`SELECT * FROM interviews WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(id, user.id)
    .first<any>();
  if (!existing) return fail("NOT_FOUND", "Interview not found", 404);
  const body = await readJson<any>(req);
  const errs = validateInterview(body ?? {}, true);
  if (errs.length) return fail("VALIDATION_ERROR", "Invalid interview data", 400, errs);
  const merged = {
    interview_type: body.interview_type ?? existing.interview_type,
    scheduled_at: body.scheduled_at ?? existing.scheduled_at,
    interviewer: body.interviewer !== undefined ? String(body.interviewer) : existing.interviewer,
    meeting_url: body.meeting_url !== undefined ? String(body.meeting_url) : existing.meeting_url,
    notes: body.notes !== undefined ? String(body.notes) : existing.notes,
    result: body.result !== undefined ? String(body.result) : existing.result,
    updated_at: new Date().toISOString(),
  };
  await env.DB.prepare(
    `UPDATE interviews SET interview_type=?, scheduled_at=?, interviewer=?, meeting_url=?, notes=?, result=?, updated_at=? WHERE id=? AND user_id=?`,
  )
    .bind(merged.interview_type, merged.scheduled_at, merged.interviewer, merged.meeting_url, merged.notes, merged.result, merged.updated_at, id, user.id)
    .run();
  if (env.CACHE) await env.CACHE.delete(`dashboard:${user.id}`).catch(() => {});
  const row = await env.DB.prepare(`SELECT * FROM interviews WHERE id = ? AND user_id = ? LIMIT 1`).bind(id, user.id).first();
  return json(row);
}

export async function deleteInterview(req: Request, env: Env, user: AuthUser, id: string): Promise<Response> {
  const existing = await env.DB.prepare(`SELECT id FROM interviews WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(id, user.id)
    .first();
  if (!existing) return fail("NOT_FOUND", "Interview not found", 404);
  await env.DB.prepare(`DELETE FROM interviews WHERE id = ? AND user_id = ?`).bind(id, user.id).run();
  if (env.CACHE) await env.CACHE.delete(`dashboard:${user.id}`).catch(() => {});
  return json({ ok: true });
}

// ---- Notes ----
export async function listNotes(req: Request, env: Env, user: AuthUser): Promise<Response> {
  const url = new URL(req.url);
  const applicationId = url.searchParams.get("application_id") ?? "";
  if (!applicationId) return fail("VALIDATION_ERROR", "application_id query param required", 400);
  // Verify ownership of the application.
  const app = await env.DB.prepare(`SELECT id FROM applications WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(applicationId, user.id)
    .first();
  if (!app) return fail("NOT_FOUND", "Application not found", 404);
  const { results } = await env.DB.prepare(
    `SELECT * FROM notes WHERE application_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 200`,
  )
    .bind(applicationId, user.id)
    .all();
  return json({ items: results ?? [] });
}

export async function createNote(req: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = await readJson<any>(req);
  const errs = validateNote(body ?? {});
  if (errs.length) return fail("VALIDATION_ERROR", "Invalid note data", 400, errs);
  const app = await env.DB.prepare(`SELECT id FROM applications WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(String(body.application_id), user.id)
    .first();
  if (!app) return fail("NOT_FOUND", "Application not found", 404);
  const id = newId();
  const now = new Date().toISOString();
  const row = { id, user_id: user.id, application_id: String(body.application_id), content: String(body.content), created_at: now, updated_at: now };
  await env.DB.prepare(`INSERT INTO notes (id, user_id, application_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(row.id, row.user_id, row.application_id, row.content, row.created_at, row.updated_at)
    .run();
  return json(row, 201);
}

export async function updateNote(req: Request, env: Env, user: AuthUser, id: string): Promise<Response> {
  const existing = await env.DB.prepare(`SELECT * FROM notes WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(id, user.id)
    .first<any>();
  if (!existing) return fail("NOT_FOUND", "Note not found", 404);
  const body = await readJson<any>(req);
  const content = String(body?.content ?? "").trim();
  if (!content || content.length > 10000) return fail("VALIDATION_ERROR", "Content is required (max 10000 chars)", 400);
  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE notes SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
    .bind(content, now, id, user.id)
    .run();
  const row = await env.DB.prepare(`SELECT * FROM notes WHERE id = ? AND user_id = ? LIMIT 1`).bind(id, user.id).first();
  return json(row);
}

export async function deleteNote(req: Request, env: Env, user: AuthUser, id: string): Promise<Response> {
  const existing = await env.DB.prepare(`SELECT id FROM notes WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(id, user.id)
    .first();
  if (!existing) return fail("NOT_FOUND", "Note not found", 404);
  await env.DB.prepare(`DELETE FROM notes WHERE id = ? AND user_id = ?`).bind(id, user.id).run();
  return json({ ok: true });
}


