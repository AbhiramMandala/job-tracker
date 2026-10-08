export interface Env {
  DB: D1Database;
  RESUMES: R2Bucket;
  CACHE?: KVNamespace;
  SESSION_SECRET: string;
  FRONTEND_ORIGIN?: string;
  /** SerpApi key for native job discovery. Server-side only — never sent
   *  to the browser. Unset = live discovery unavailable (generic 503). */
  SERPAPI_API_KEY?: string;
}

export type Role = "student" | "admin";

export const ROLES: readonly Role[] = ["student", "admin"] as const;

export function isRole(v: unknown): v is Role {
  return v === "student" || v === "admin";
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
}

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

/** Central permission catalog. Own-resource permissions are enforced
 *  together with a user_id ownership check (PBAC); role permissions alone
 *  never grant access to another user's rows. */
export const PERMISSIONS = [
  "applications.read",
  "applications.create",
  "applications.update",
  "applications.delete",
  "interviews.read",
  "interviews.create",
  "interviews.update",
  "interviews.delete",
  "notes.read",
  "notes.create",
  "notes.update",
  "notes.delete",
  "resumes.read",
  "resumes.create",
  "resumes.delete",
  "jobs.discover",
  "users.read",
  "users.manage",
  "admin.access",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const APPLICATION_STATUSES = [
  "SAVED",
  "APPLIED",
  "OA",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
] as const;

export const JOB_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "INTERNSHIP",
  "CONTRACT",
  "REMOTE",
] as const;

export const INTERVIEW_TYPES = [
  "PHONE",
  "OA",
  "TECHNICAL",
  "HR",
  "BEHAVIORAL",
  "FINAL",
] as const;

export function nowIso(): string {
  return new Date().toISOString();
}
