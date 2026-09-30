import type { AuthUser, Env } from "../types";
import { fail, json } from "../utils/response";
import { newId } from "../utils/crypto";
import { ALLOWED_RESUME_MIMES, MAX_RESUME_BYTES, validateResumeFile } from "../validation/schemas";

function sanitizeFilename(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "resume";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 200) || "resume";
}

// POST /api/resumes — multipart/form-data with `file` (+ optional `application_id`)
export async function uploadResume(req: Request, env: Env, user: AuthUser): Promise<Response> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data"))
    return fail("VALIDATION_ERROR", "Expected multipart/form-data with a 'file' field", 400);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("VALIDATION_ERROR", "Could not parse multipart body", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("VALIDATION_ERROR", "'file' is required", 400);

  const originalName = sanitizeFilename(file.name || "resume");
  const mime = file.type || "application/octet-stream";
  const size = file.size;
  const errs = validateResumeFile(originalName, mime, size);
  if (errs.length) return fail("VALIDATION_ERROR", "Invalid file", 400, errs);

  // Extra sniff: extension allow-list as defense-in-depth.
  const ext = originalName.split(".").pop()?.toLowerCase();
  if (!["pdf", "doc", "docx", "txt"].includes(ext ?? ""))
    return fail("VALIDATION_ERROR", "Only .pdf, .doc, .docx, .txt allowed", 400);

  const id = newId();
  const r2Key = `${user.id}/${id}-${originalName}`;
  const buf = new Uint8Array(await file.arrayBuffer());

  try {
    await env.RESUMES.put(r2Key, buf, {
      httpMetadata: { contentType: mime },
      customMetadata: { userId: user.id, filename: originalName },
    });
  } catch (e) {
    return fail("STORAGE_ERROR", "Failed to store file", 500);
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO resumes (id, user_id, filename, content_type, size, r2_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, user.id, originalName, mime, size, r2Key, now)
    .run();

  const applicationId = form.get("application_id");
  if (typeof applicationId === "string" && applicationId) {
    // Associate if the application belongs to the user (ignore otherwise).
    await env.DB.prepare(`UPDATE applications SET resume_id = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
      .bind(id, now, applicationId, user.id)
      .run()
      .catch(() => {});
  }

  return json({ id, user_id: user.id, filename: originalName, content_type: mime, size, r2_key: r2Key, created_at: now }, 201);
}

export async function listResumes(req: Request, env: Env, user: AuthUser): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, user_id, filename, content_type, size, r2_key, created_at FROM resumes WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
  )
    .bind(user.id)
    .all();
  return json({ items: results ?? [] });
}

// GET /api/resumes/:id/download — streams the file from R2 after ownership check.
// GET /api/resumes/:id — metadata.
export async function getResume(req: Request, env: Env, user: AuthUser, id: string, download: boolean): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT id, user_id, filename, content_type, size, r2_key, created_at FROM resumes WHERE id = ? AND user_id = ? LIMIT 1`,
  )
    .bind(id, user.id)
    .first<any>();
  if (!row) return fail("NOT_FOUND", "Resume not found", 404);
  if (!download) return json(row);

  const obj = await env.RESUMES.get(row.r2_key);
  if (!obj) return fail("NOT_FOUND", "File missing from storage", 404);
  const headers = new Headers();
  headers.set("content-type", row.content_type);
  headers.set("content-disposition", `attachment; filename="${row.filename.replace(/"/g, "")}"`);
  return new Response(obj.body, { headers });
}

export async function deleteResume(req: Request, env: Env, user: AuthUser, id: string): Promise<Response> {
  const row = await env.DB.prepare(`SELECT r2_key FROM resumes WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(id, user.id)
    .first<{ r2_key: string }>();
  if (!row) return fail("NOT_FOUND", "Resume not found", 404);
  await env.RESUMES.delete(row.r2_key).catch(() => {});
  await env.DB.prepare(`UPDATE applications SET resume_id = NULL WHERE resume_id = ? AND user_id = ?`).bind(id, user.id).run().catch(() => {});
  await env.DB.prepare(`DELETE FROM resumes WHERE id = ? AND user_id = ?`).bind(id, user.id).run();
  return json({ ok: true });
}

export { ALLOWED_RESUME_MIMES, MAX_RESUME_BYTES };


