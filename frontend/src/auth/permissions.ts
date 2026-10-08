import type { Permission, Role } from "../types";

/** Client-side mirror of the server permission catalog (worker/src/authz.ts).
 *  UX only — every permission is re-checked by the backend. Never rely on
 *  these helpers for authorization. */
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

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  student: [
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
  ],
  admin: [...PERMISSIONS],
};

export function hasPermission(role: Role | undefined, perm: Permission): boolean {
  if (!role) return false;
  return (ROLE_PERMISSIONS[role] ?? []).includes(perm);
}

export function isAdmin(role: Role | undefined): boolean {
  return role === "admin";
}

/** Human-readable permission summaries for the profile page. */
export function describePermissions(role: Role | undefined): string[] {
  if (role === "admin") return ["Manage your own tracker data", "Manage users and roles", "Full administrative access"];
  return ["Manage your own tracker data", "Track applications, interviews, and resumes", "No administrative access"];
}
