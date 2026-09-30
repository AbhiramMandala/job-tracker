import type { AuthUser, Env } from "../types";
import { fail, json, readJson } from "../utils/response";
import { newId } from "../utils/crypto";
import { validateApplication } from "../validation/schemas";
import { APPLICATION_STATUSES, JOB_TYPES } from "../types";

function toBoolInt(v: unknown): number {
  return v === true || v === 1 || v === "1" ? 1 : 0;
}

function rowToApp(r: any): any {
  if (!r) return r;
  return { ...r, follow_up_reminder: Number(r.follow_up_reminder ?? 0) };
}

export async function listApplications(req: Request, env: Env, user: AuthUser): Promise<Response> {
  const url = new URL(req.url);
  const q = (k: string) => url.searchParams.get(k) ?? "";

  const search = q("search").trim().slice(0, 200);
  const status = q("status").trim();
  const jobType = q("job_type").trim() || q("jobType").trim();
  const dateFrom = q("date_from").trim() || q("dateFrom").trim();
  const dateTo = q("date_to").trim() || q("dateTo").trim();
  const sort = q("sort") === "oldest" ? "oldest" : "newest";
  const page = Math.max(1, Number(q("page")) || 1);
  const rawLimit = Number(q("limit")) || 12;
  const limit = Math.min(100, Math.max(1, rawLimit));
  const offset = (page - 1) * limit;

  const where: string[] = ["user_id = ?"];
  const binds: unknown[] = [user.id];

  if (status) {
    if (!(APPLICATION_STATUSES as readonly string[]).includes(status))
      return fail("VALIDATION_ERROR", "Invalid status filter", 400);
    where.push("status = ?");
    binds.push(status);
  }
  if (jobType) {
    if (!(JOB_TYPES as readonly string[]).includes(jobType))
      return fail("VALIDATION_ERROR", "Invalid job_type filter", 400);
    where.push("job_type = ?");
    binds.push(jobType);
  }
  if (search) {
    where.push("(company LIKE ? OR job_title LIKE ?)");
    binds.push(`%${search}%`, `%${search}%`);
  }
  if (dateFrom) {
    if (Number.isNaN(Date.parse(dateFrom))) return fail("VALIDATION_ERROR", "Invalid date_from", 400);
    where.push("application_date >= ?");
    binds.push(dateFrom);
  }
  if (dateTo) {
    if (Number.isNaN(Date.parse(dateTo))) return fail("VALIDATION_ERROR", "Invalid date_to", 400);
    where.push("application_date <= ?");
    binds.push(dateTo);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql = sort === "oldest" ? "application_date ASC, created_at ASC" : "application_date DESC, created_at DESC";

  const countRow = await env.DB.prepare(`SELECT COUNT(*) as total FROM applications ${whereSql}`)
    .bind(...binds)
    .first<{ total: number }>();
  const total = Number(countRow?.total ?? 0);

  const { results } = await env.DB.prepare(
    `SELECT * FROM applications ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`,
  )
    .bind(...binds, limit, offset)
    .all();

  return json({
    items: (results ?? []).map(rowToApp),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function createApplication(req: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = await readJson<any>(req);
  const errs = validateApplication(body ?? {});
  if (errs.length) return fail("VALIDATION_ERROR", "Invalid application data", 400, errs);

  if (body.resume_id) {
    const r = await env.DB.prepare(`SELECT id FROM resumes WHERE id = ? AND user_id = ? LIMIT 1`)
      .bind(String(body.resume_id), user.id)
      .first();
    if (!r) return fail("VALIDATION_ERROR", "resume_id does not belong to you", 400);
  }

  const id = newId();
  const now = new Date().toISOString();
  const row = {
    id,
    user_id: user.id,
    company: String(body.company).trim(),
    job_title: String(body.job_title).trim(),
    location: String(body.location ?? ""),
    job_url: String(body.job_url ?? ""),
    job_type: body.job_type ?? "FULL_TIME",
    salary: String(body.salary ?? ""),
    application_date: String(body.application_date),
    status: body.status ?? "SAVED",
    notes: String(body.notes ?? ""),
    contact_person: String(body.contact_person ?? ""),
    contact_email: String(body.contact_email ?? ""),
    follow_up_date: body.follow_up_date ? String(body.follow_up_date) : null,
    follow_up_reminder: toBoolInt(body.follow_up_reminder),
    follow_up_notes: String(body.follow_up_notes ?? ""),
    resume_id: body.resume_id ? String(body.resume_id) : null,
    created_at: now,
    updated_at: now,
  };
  await env.DB.prepare(
    `INSERT INTO applications (id, user_id, company, job_title, location, job_url, job_type, salary, application_date, status, notes, contact_person, contact_email, follow_up_date, follow_up_reminder, follow_up_notes, resume_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      row.id, row.user_id, row.company, row.job_title, row.location, row.job_url, row.job_type,
      row.salary, row.application_date, row.status, row.notes, row.contact_person, row.contact_email,
      row.follow_up_date, row.follow_up_reminder, row.follow_up_notes, row.resume_id, row.created_at, row.updated_at,
    )
    .run();
  // Invalidate dashboard cache.
  if (env.CACHE) await env.CACHE.delete(`dashboard:${user.id}`).catch(() => {});
  return json(rowToApp(row), 201);
}

export async function getApplication(req: Request, env: Env, user: AuthUser, id: string): Promise<Response> {
  const row = await env.DB.prepare(`SELECT * FROM applications WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(id, user.id)
    .first();
  if (!row) return fail("NOT_FOUND", "Application not found", 404);
  const interviews = await env.DB.prepare(
    `SELECT * FROM interviews WHERE application_id = ? AND user_id = ? ORDER BY scheduled_at ASC`,
  )
    .bind(id, user.id)
    .all();
  const noteItems = await env.DB.prepare(
    `SELECT * FROM notes WHERE application_id = ? AND user_id = ? ORDER BY created_at DESC`,
  )
    .bind(id, user.id)
    .all();
  return json({ ...rowToApp(row), interviews: interviews.results ?? [], note_items: noteItems.results ?? [] });
}

export async function updateApplication(req: Request, env: Env, user: AuthUser, id: string): Promise<Response> {
  const existing = await env.DB.prepare(`SELECT * FROM applications WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(id, user.id)
    .first<any>();
  if (!existing) return fail("NOT_FOUND", "Application not found", 404);

  const body = await readJson<any>(req);
  const errs = validateApplication(body ?? {}, true);
  if (errs.length) return fail("VALIDATION_ERROR", "Invalid application data", 400, errs);

  if (body.resume_id) {
    const r = await env.DB.prepare(`SELECT id FROM resumes WHERE id = ? AND user_id = ? LIMIT 1`)
      .bind(String(body.resume_id), user.id)
      .first();
    if (!r) return fail("VALIDATION_ERROR", "resume_id does not belong to you", 400);
  }

  const merged = {
    company: body.company !== undefined ? String(body.company).trim() : existing.company,
    job_title: body.job_title !== undefined ? String(body.job_title).trim() : existing.job_title,
    location: body.location !== undefined ? String(body.location) : existing.location,
    job_url: body.job_url !== undefined ? String(body.job_url) : existing.job_url,
    job_type: body.job_type ?? existing.job_type,
    salary: body.salary !== undefined ? String(body.salary) : existing.salary,
    application_date: body.application_date ?? existing.application_date,
    status: body.status ?? existing.status,
    notes: body.notes !== undefined ? String(body.notes) : existing.notes,
    contact_person: body.contact_person !== undefined ? String(body.contact_person) : existing.contact_person,
    contact_email: body.contact_email !== undefined ? String(body.contact_email) : existing.contact_email,
    follow_up_date: body.follow_up_date !== undefined ? (body.follow_up_date ? String(body.follow_up_date) : null) : existing.follow_up_date,
    follow_up_reminder: body.follow_up_reminder !== undefined ? toBoolInt(body.follow_up_reminder) : existing.follow_up_reminder,
    follow_up_notes: body.follow_up_notes !== undefined ? String(body.follow_up_notes) : existing.follow_up_notes,
    resume_id: body.resume_id !== undefined ? (body.resume_id ? String(body.resume_id) : null) : existing.resume_id,
    updated_at: new Date().toISOString(),
  };

  await env.DB.prepare(
    `UPDATE applications SET company=?, job_title=?, location=?, job_url=?, job_type=?, salary=?, application_date=?, status=?, notes=?, contact_person=?, contact_email=?, follow_up_date=?, follow_up_reminder=?, follow_up_notes=?, resume_id=?, updated_at=? WHERE id=? AND user_id=?`,
  )
    .bind(
      merged.company, merged.job_title, merged.location, merged.job_url, merged.job_type, merged.salary,
      merged.application_date, merged.status, merged.notes, merged.contact_person, merged.contact_email,
      merged.follow_up_date, merged.follow_up_reminder, merged.follow_up_notes, merged.resume_id,
      merged.updated_at, id, user.id,
    )
    .run();
  if (env.CACHE) await env.CACHE.delete(`dashboard:${user.id}`).catch(() => {});
  const row = await env.DB.prepare(`SELECT * FROM applications WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(id, user.id)
    .first();
  return json(rowToApp(row));
}

export async function deleteApplication(req: Request, env: Env, user: AuthUser, id: string): Promise<Response> {
  const existing = await env.DB.prepare(`SELECT id FROM applications WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(id, user.id)
    .first();
  if (!existing) return fail("NOT_FOUND", "Application not found", 404);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM interviews WHERE application_id = ? AND user_id = ?`).bind(id, user.id),
    env.DB.prepare(`DELETE FROM notes WHERE application_id = ? AND user_id = ?`).bind(id, user.id),
    env.DB.prepare(`DELETE FROM applications WHERE id = ? AND user_id = ?`).bind(id, user.id),
  ]);
  if (env.CACHE) await env.CACHE.delete(`dashboard:${user.id}`).catch(() => {});
  return json({ ok: true });
}


