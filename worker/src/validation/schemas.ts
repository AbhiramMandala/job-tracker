import { APPLICATION_STATUSES, INTERVIEW_TYPES, JOB_TYPES } from "../types";

export interface ValidationError {
  field: string;
  message: string;
}

function isNonEmptyString(v: unknown, maxLen = 500): boolean {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen;
}

function isOptionalString(v: unknown, maxLen = 5000): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.length <= maxLen);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

function isValidDate(v: unknown): boolean {
  if (typeof v !== "string" || !v) return false;
  const t = Date.parse(v);
  return !Number.isNaN(t);
}

function isValidUrl(v: string): boolean {
  if (!v) return true; // optional
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateRegister(body: any): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!body || typeof body !== "object") return [{ field: "body", message: "Invalid JSON body" }];
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) errs.push({ field: "email", message: "Valid email is required" });
  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128)
    errs.push({ field: "password", message: "Password must be 8-128 characters" });
  if (body.name !== undefined && (typeof body.name !== "string" || body.name.length > 120))
    errs.push({ field: "name", message: "Name must be at most 120 characters" });
  return errs;
}

export function validateLogin(body: any): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!body || typeof body !== "object") return [{ field: "body", message: "Invalid JSON body" }];
  if (!isValidEmail(String(body.email ?? "").trim().toLowerCase()))
    errs.push({ field: "email", message: "Valid email is required" });
  if (typeof body.password !== "string" || body.password.length === 0)
    errs.push({ field: "password", message: "Password is required" });
  return errs;
}

export function validateApplication(body: any, partial = false): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!body || typeof body !== "object") return [{ field: "body", message: "Invalid JSON body" }];
  const need = (f: string) => !partial || body[f] !== undefined;

  if (need("company") && !isNonEmptyString(body.company, 200))
    errs.push({ field: "company", message: "Company is required (max 200 chars)" });
  if (need("job_title") && !isNonEmptyString(body.job_title, 200))
    errs.push({ field: "job_title", message: "Job title is required (max 200 chars)" });
  if (body.location !== undefined && !isOptionalString(body.location, 200))
    errs.push({ field: "location", message: "Location too long" });
  if (body.job_url !== undefined && (typeof body.job_url !== "string" || body.job_url.length > 2000 || !isValidUrl(body.job_url)))
    errs.push({ field: "job_url", message: "Job URL must be a valid http(s) URL" });
  if (body.job_type !== undefined && !(JOB_TYPES as readonly string[]).includes(body.job_type))
    errs.push({ field: "job_type", message: `job_type must be one of ${JOB_TYPES.join(", ")}` });
  if (body.salary !== undefined && !isOptionalString(body.salary, 100))
    errs.push({ field: "salary", message: "Salary too long" });
  if (need("application_date") && !isValidDate(body.application_date))
    errs.push({ field: "application_date", message: "Valid application_date is required (ISO date)" });
  if (body.status !== undefined && !(APPLICATION_STATUSES as readonly string[]).includes(body.status))
    errs.push({ field: "status", message: `status must be one of ${APPLICATION_STATUSES.join(", ")}` });
  if (body.notes !== undefined && !isOptionalString(body.notes, 10000))
    errs.push({ field: "notes", message: "Notes too long" });
  if (body.contact_person !== undefined && !isOptionalString(body.contact_person, 200))
    errs.push({ field: "contact_person", message: "Contact person too long" });
  if (body.contact_email !== undefined && body.contact_email !== "" && !isValidEmail(String(body.contact_email)))
    errs.push({ field: "contact_email", message: "Contact email must be valid" });
  if (body.follow_up_date !== undefined && body.follow_up_date !== null && body.follow_up_date !== "" && !isValidDate(body.follow_up_date))
    errs.push({ field: "follow_up_date", message: "follow_up_date must be a valid date or empty" });
  if (body.follow_up_reminder !== undefined && !(body.follow_up_reminder === 0 || body.follow_up_reminder === 1 || body.follow_up_reminder === true || body.follow_up_reminder === false))
    errs.push({ field: "follow_up_reminder", message: "follow_up_reminder must be boolean-ish" });
  if (body.follow_up_notes !== undefined && !isOptionalString(body.follow_up_notes, 5000))
    errs.push({ field: "follow_up_notes", message: "Follow-up notes too long" });
  if (body.resume_id !== undefined && body.resume_id !== null && body.resume_id !== "" && typeof body.resume_id !== "string")
    errs.push({ field: "resume_id", message: "resume_id must be a string id or empty" });
  return errs;
}

export function validateInterview(body: any, partial = false): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!body || typeof body !== "object") return [{ field: "body", message: "Invalid JSON body" }];
  const need = (f: string) => !partial || body[f] !== undefined;
  if (!partial && (typeof body.application_id !== "string" || !body.application_id))
    errs.push({ field: "application_id", message: "application_id is required" });
  if (body.interview_type !== undefined && !(INTERVIEW_TYPES as readonly string[]).includes(body.interview_type))
    errs.push({ field: "interview_type", message: `interview_type must be one of ${INTERVIEW_TYPES.join(", ")}` });
  if (need("scheduled_at") && !isValidDate(body.scheduled_at))
    errs.push({ field: "scheduled_at", message: "Valid scheduled_at is required" });
  if (body.interviewer !== undefined && !isOptionalString(body.interviewer, 200))
    errs.push({ field: "interviewer", message: "Interviewer too long" });
  if (body.meeting_url !== undefined && (typeof body.meeting_url !== "string" || body.meeting_url.length > 2000 || !isValidUrl(body.meeting_url)))
    errs.push({ field: "meeting_url", message: "Meeting URL must be valid http(s)" });
  if (body.notes !== undefined && !isOptionalString(body.notes, 10000))
    errs.push({ field: "notes", message: "Notes too long" });
  if (body.result !== undefined && !isOptionalString(body.result, 2000))
    errs.push({ field: "result", message: "Result too long" });
  return errs;
}

export function validateNote(body: any): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!body || typeof body !== "object") return [{ field: "body", message: "Invalid JSON body" }];
  if (typeof body.application_id !== "string" || !body.application_id)
    errs.push({ field: "application_id", message: "application_id is required" });
  if (!isNonEmptyString(body.content, 10000))
    errs.push({ field: "content", message: "Content is required (max 10000 chars)" });
  return errs;
}

export const ALLOWED_RESUME_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB

/** Parse an optional JobSetu provenance reference `{ job_id }` as sent by
 *  GET /api/jobs/{id}/tracker-export. Returns the positive integer id, or
 *  null when the value is absent or malformed (callers 400 on malformed). */
export function parseJobsetuJobId(value: unknown): number | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const id = (value as Record<string, unknown>).job_id;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return null;
  return id;
}

export function validateResumeFile(filename: string, mime: string, size: number): ValidationError[] {
  const errs: ValidationError[] = [];
  // Reject traversal / path separators on the raw input before sanitization.
  if (/(\.\.|[\\/]|\0)/.test(filename)) errs.push({ field: "filename", message: "Invalid filename" });
  const clean = filename.replace(/\\/g, "/").split("/").pop() ?? "";
  if (!clean || clean.length > 255 || clean === "." || clean === "..")
    errs.push({ field: "filename", message: "Invalid filename" });
  if (/\.\.|\0/.test(clean)) errs.push({ field: "filename", message: "Invalid filename" });
  if (!(ALLOWED_RESUME_MIMES as readonly string[]).includes(mime))
    errs.push({ field: "content_type", message: `Only ${ALLOWED_RESUME_MIMES.join(", ")} allowed` });
  if (!Number.isFinite(size) || size <= 0 || size > MAX_RESUME_BYTES)
    errs.push({ field: "size", message: `File must be 1 byte - ${MAX_RESUME_BYTES} bytes` });
  return errs;
}


