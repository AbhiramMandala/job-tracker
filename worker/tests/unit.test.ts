import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, newId, newToken, sha256Hex } from "../src/utils/crypto";
import {
  validateApplication,
  validateInterview,
  validateLogin,
  validateNote,
  validateRegister,
  validateResumeFile,
} from "../src/validation/schemas";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct-horse-123");
    expect(hash).toContain("pbkdf2$");
    expect(hash).not.toContain("correct-horse-123");
    expect(await verifyPassword("correct-horse-123", hash)).toBe(true);
  });

  it("rejects wrong passwords", async () => {
    const hash = await hashPassword("right-password");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("uses unique salts", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("tokens and ids", () => {
  it("generates unique ids and tokens", () => {
    expect(newId()).not.toBe(newId());
    expect(newToken()).not.toBe(newToken());
    expect(newToken()).toHaveLength(64);
  });

  it("sha256 is deterministic", async () => {
    expect(await sha256Hex("abc")).toBe(await sha256Hex("abc"));
    expect(await sha256Hex("abc")).not.toBe(await sha256Hex("abd"));
  });
});

describe("auth validation", () => {
  it("accepts valid registration", () => {
    expect(validateRegister({ email: "a@b.com", password: "password123", name: "Al" })).toEqual([]);
  });
  it("rejects bad email and short password", () => {
    const errs = validateRegister({ email: "nope", password: "short" });
    expect(errs.length).toBeGreaterThanOrEqual(2);
  });
  it("requires password on login", () => {
    expect(validateLogin({ email: "a@b.com", password: "" }).length).toBeGreaterThan(0);
    expect(validateLogin({ email: "a@b.com", password: "x" })).toEqual([]);
  });
});

describe("application validation", () => {
  const valid = { company: "Google", job_title: "SWE", application_date: "2026-01-05" };
  it("accepts minimal valid input", () => {
    expect(validateApplication(valid)).toEqual([]);
  });
  it("rejects missing required fields", () => {
    const errs = validateApplication({ company: "", job_title: "", application_date: "bad" });
    expect(errs.map((e) => e.field)).toEqual(expect.arrayContaining(["company", "job_title", "application_date"]));
  });
  it("rejects invalid status and job_type", () => {
    expect(validateApplication({ ...valid, status: "NOPE" }).length).toBe(1);
    expect(validateApplication({ ...valid, job_type: "NOPE" }).length).toBe(1);
  });
  it("allows partial updates", () => {
    expect(validateApplication({ status: "OFFER" }, true)).toEqual([]);
  });
});

describe("interview and note validation", () => {
  it("requires application_id and scheduled_at", () => {
    expect(validateInterview({}).length).toBeGreaterThan(0);
    expect(validateInterview({ application_id: "a", scheduled_at: "2026-02-01T10:00:00Z" })).toEqual([]);
  });
  it("rejects bad interview type", () => {
    expect(
      validateInterview({ application_id: "a", scheduled_at: "2026-02-01T10:00:00Z", interview_type: "NOPE" }).length,
    ).toBe(1);
  });
  it("validates notes", () => {
    expect(validateNote({ application_id: "a", content: "hello" })).toEqual([]);
    expect(validateNote({ application_id: "", content: "" }).length).toBe(2);
  });
});

describe("resume validation", () => {
  it("accepts pdf under limit", () => {
    expect(validateResumeFile("resume.pdf", "application/pdf", 1024)).toEqual([]);
  });
  it("rejects invalid mime", () => {
    expect(validateResumeFile("evil.exe", "application/x-msdownload", 100).length).toBeGreaterThan(0);
  });
  it("rejects oversized file", () => {
    expect(validateResumeFile("big.pdf", "application/pdf", 50 * 1024 * 1024).length).toBeGreaterThan(0);
  });
  it("rejects path traversal filenames", () => {
    expect(validateResumeFile("../secret", "application/pdf", 100).length).toBeGreaterThan(0);
  });
});

