export interface Env {
  DB: D1Database;
  RESUMES: R2Bucket;
  CACHE?: KVNamespace;
  SESSION_SECRET: string;
  FRONTEND_ORIGIN?: string;
  JOBSETU_ORIGIN?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

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
