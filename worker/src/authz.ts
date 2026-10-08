import type { AuthUser, Permission, Role } from "./types";
import { fail } from "./utils/response";

/**
 * RBAC + PBAC authorization layer.
 *
 * - RBAC: each role maps to a fixed permission set (`ROLE_PERMISSIONS`).
 * - PBAC: ownership policies (`can`) evaluate role + action + resource.
 *   A student may act only on resources they own; an admin bypasses
 *   ownership but still needs the relevant permission.
 *
 * Route handlers should use `denyIfNoPermission` / `denyIfCannot` and
 * return the resulting 403 response, keeping checks out of SQL code.
 */

const STUDENT_PERMISSIONS: readonly Permission[] = [
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
];

const ADMIN_PERMISSIONS: readonly Permission[] = [
  ...STUDENT_PERMISSIONS,
  "users.read",
  "users.manage",
  "admin.access",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  student: STUDENT_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
};

export function hasPermission(user: Pick<AuthUser, "role">, perm: Permission): boolean {
  return (ROLE_PERMISSIONS[user.role] ?? []).includes(perm);
}

export function isAdmin(user: Pick<AuthUser, "role">): boolean {
  return user.role === "admin";
}

/** A resource owned by a user (every user-scoped row carries user_id). */
export interface OwnedResource {
  user_id: string;
}

export type PolicyAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "manage-users";

/**
 * Policy decision: can `user` perform `action` on `resource`?
 * - `resource` null = collection-level action (create/manage).
 * - Admins pass any ownership check; students must own the resource.
 */
export function can(
  user: Pick<AuthUser, "id" | "role">,
  action: PolicyAction,
  resource: OwnedResource | null,
): boolean {
  if (action === "manage-users") return isAdmin(user);
  if (action === "create") return true; // creation is always own-scoped; permission checked separately
  if (!resource) return false;
  if (isAdmin(user)) return true;
  return resource.user_id === user.id;
}

/** 403 response when `user` lacks `perm`, else null (request may proceed). */
export function denyIfNoPermission(user: AuthUser, perm: Permission): Response | null {
  if (!hasPermission(user, perm)) return fail("FORBIDDEN", "You do not have permission", 403);
  return null;
}

/** 403 response when policy denies `action` on `resource`, else null. */
export function denyIfCannot(
  user: AuthUser,
  action: PolicyAction,
  resource: OwnedResource | null,
): Response | null {
  if (!can(user, action, resource)) return fail("FORBIDDEN", "Access denied", 403);
  return null;
}
