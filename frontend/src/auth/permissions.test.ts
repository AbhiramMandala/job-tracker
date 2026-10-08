import { describe, expect, it } from "vitest";
import { describePermissions, hasPermission, isAdmin } from "./permissions";

describe("frontend permission helpers (UX only — backend enforces)", () => {
  it("identifies admins", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("student")).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it("grants students tracker permissions but not management", () => {
    expect(hasPermission("student", "applications.create")).toBe(true);
    expect(hasPermission("student", "interviews.read")).toBe(true);
    expect(hasPermission("student", "jobs.discover")).toBe(true);
    expect(hasPermission("student", "users.manage")).toBe(false);
    expect(hasPermission("student", "admin.access")).toBe(false);
    expect(hasPermission(undefined, "applications.read")).toBe(false);
  });

  it("grants admins management permissions", () => {
    expect(hasPermission("admin", "users.manage")).toBe(true);
    expect(hasPermission("admin", "admin.access")).toBe(true);
    expect(hasPermission("admin", "applications.delete")).toBe(true);
  });

  it("describes permissions without leaking internals", () => {
    expect(describePermissions("student")).toContain("No administrative access");
    expect(describePermissions("admin")).toContain("Manage users and roles");
  });
});
