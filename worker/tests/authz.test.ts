import { describe, expect, it } from "vitest";
import { can, denyIfCannot, denyIfNoPermission, hasPermission, isAdmin, ROLE_PERMISSIONS } from "../src/authz";
import type { AuthUser } from "../src/types";

const student: AuthUser = { id: "u1", email: "s@x.com", name: "Stu", role: "student", created_at: "" };
const admin: AuthUser = { id: "a1", email: "a@x.com", name: "Admin", role: "admin", created_at: "" };

describe("RBAC permission sets", () => {
  it("grants students own-resource permissions only", () => {
    expect(hasPermission(student, "applications.create")).toBe(true);
    expect(hasPermission(student, "applications.read")).toBe(true);
    expect(hasPermission(student, "users.manage")).toBe(false);
    expect(hasPermission(student, "admin.access")).toBe(false);
    expect(isAdmin(student)).toBe(false);
  });

  it("grants admins everything students have plus management", () => {
    for (const p of ROLE_PERMISSIONS.student) expect(hasPermission(admin, p)).toBe(true);
    expect(hasPermission(admin, "users.manage")).toBe(true);
    expect(hasPermission(admin, "admin.access")).toBe(true);
    expect(isAdmin(admin)).toBe(true);
  });

  it("denies with a 403 response object", async () => {
    const denied = denyIfNoPermission(student, "users.manage");
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(403);
    expect(denyIfNoPermission(student, "applications.read")).toBeNull();
  });

  it("grants discovery to students and admins", () => {
    expect(hasPermission(student, "jobs.discover")).toBe(true);
    expect(hasPermission(admin, "jobs.discover")).toBe(true);
    expect(denyIfNoPermission(student, "jobs.discover")).toBeNull();
  });
});

describe("PBAC ownership policies", () => {
  it("lets students read/update/delete only their own resources", () => {
    expect(can(student, "read", { user_id: "u1" })).toBe(true);
    expect(can(student, "update", { user_id: "u1" })).toBe(true);
    expect(can(student, "delete", { user_id: "u1" })).toBe(true);
    expect(can(student, "read", { user_id: "other" })).toBe(false);
    expect(can(student, "update", { user_id: "other" })).toBe(false);
    expect(can(student, "delete", { user_id: "other" })).toBe(false);
  });

  it("lets admins act on any resource but reserves user management", () => {
    expect(can(admin, "read", { user_id: "other" })).toBe(true);
    expect(can(admin, "delete", { user_id: "other" })).toBe(true);
    expect(can(admin, "manage-users", null)).toBe(true);
    expect(can(student, "manage-users", null)).toBe(false);
  });

  it("denies cross-user access with a 403 response object", () => {
    expect(denyIfCannot(student, "read", { user_id: "other" })!.status).toBe(403);
    expect(denyIfCannot(student, "read", { user_id: "u1" })).toBeNull();
  });
});
