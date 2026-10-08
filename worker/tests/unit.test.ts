import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, newId, newToken, sha256Hex } from "../src/utils/crypto";
import { corsHeaders } from "../src/utils/response";
import {
  parseProviderRef,
  validateApplication,
  validateDiscoverSearch,
  validateInterview,
  validateLogin,
  validateNote,
  validateRegister,
  validateResumeFile,
} from "../src/validation/schemas";
import { normalizeSerpApiJob } from "../src/routes/discover";
import { removesLastAdmin } from "../src/routes/admin";
import { rateLimit } from "../src/middleware/auth";

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
  it("uses exact email messages and normalizes case/whitespace", () => {
    expect(validateRegister({ email: "", password: "password123" })).toEqual([
      { field: "email", message: "Email is required." },
    ]);
    expect(validateRegister({ email: "   ", password: "password123" })).toEqual([
      { field: "email", message: "Email is required." },
    ]);
    for (const bad of ["abc", "abc@", "abc@domain", "@domain.com", "abc domain@gmail.com", "abc@@gmail.com"]) {
      expect(validateRegister({ email: bad, password: "password123" })).toEqual([
        { field: "email", message: "Please enter a valid email address." },
      ]);
    }
    expect(validateRegister({ email: "  User@Example.com  ", password: "password123" })).toEqual([]);
  });
  it("requires password on login", () => {
    expect(validateLogin({ email: "a@b.com", password: "" }).length).toBeGreaterThan(0);
    expect(validateLogin({ email: "a@b.com", password: "x" })).toEqual([]);
  });
});

describe("discover + provider validation", () => {
  it("requires search keywords within length limits", () => {
    expect(validateDiscoverSearch({}).errs).not.toHaveLength(0);
    expect(validateDiscoverSearch({ role: "  " }).errs.map((e) => e.field)).toContain("role");
    const { errs, input } = validateDiscoverSearch({ role: " python ", location: "Hyd", experience: "Fresher" });
    expect(errs).toEqual([]);
    expect(input).toEqual({ role: "python", location: "Hyd", experience: "Fresher" });
  });
  it("parses provider provenance strictly", () => {
    expect(parseProviderRef({ name: "serpapi", job_id: "abc" })).toEqual({ name: "serpapi", job_id: "abc" });
    for (const bad of [null, "x", [], {}, { name: "", job_id: "a" }, { name: "s", job_id: "" }, { name: "s", job_id: 5 }]) {
      expect(parseProviderRef(bad)).toBeNull();
    }
  });
  it("normalizes SerpApi jobs defensively", () => {
    expect(normalizeSerpApiJob(null)).toBeNull();
    expect(normalizeSerpApiJob({})).toBeNull();
    const full = normalizeSerpApiJob({
      title: "Dev", company_name: "Acme", location: "Hyd", description: "x",
      via: "LinkedIn", job_id: "j1",
      detected_extensions: { posted_at: "today", schedule_type: "Full-time", salary: "$1", work_from_home: true },
      apply_options: [{ link: "https://example.com/a" }, { link: "javascript:evil()" }],
    });
    expect(full).toMatchObject({ id: "j1", employment_type: "FULL_TIME", remote: true, apply_url: "https://example.com/a" });
    const bare = normalizeSerpApiJob({ title: "T", apply_options: [{ link: "data:x" }] })!;
    expect(typeof bare.id).toBe("string");
    expect(bare.apply_url).toBe("");
    expect(bare.remote).toBeNull();
  });
});

describe("rate limiting", () => {
  it("allows under the limit, blocks at it, and fails open without KV", async () => {
    expect(await rateLimit(new Request("https://x/"), { DB: null } as any, "k", 2, 60)).toBe(true);
    const store = new Map<string, string>();
    const env = { CACHE: { get: async (k: string) => store.get(k) ?? null, put: async (k: string, v: string) => { store.set(k, v); } } } as any;
    const req = new Request("https://x/", { headers: { "CF-Connecting-IP": "1.2.3.4" } });
    expect(await rateLimit(req, env, "k", 2, 60)).toBe(true);
    expect(await rateLimit(req, env, "k", 2, 60)).toBe(true);
    expect(await rateLimit(req, env, "k", 2, 60)).toBe(false);
  });
});

describe("last-admin safeguard", () => {
  it("blocks only operations that would leave zero admins", () => {
    expect(removesLastAdmin(1, "admin", false)).toBe(true);
    expect(removesLastAdmin(2, "admin", false)).toBe(false);
    expect(removesLastAdmin(1, "student", false)).toBe(false);
    expect(removesLastAdmin(1, "admin", true)).toBe(false);
    expect(removesLastAdmin(0, "admin", false)).toBe(true);
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

describe("CORS", () => {
  const req = (origin: string) => new Request("https://example.com/api/applications", { headers: { Origin: origin } });
  it("no longer allow-lists provider origins", () => {
    const h = corsHeaders(req("http://127.0.0.1:8000"), { FRONTEND_ORIGIN: "http://localhost:5173" }) as Record<string, string>;
    expect(h["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
  });
  it("echoes the configured frontend origin", () => {
    const h = corsHeaders(req("http://localhost:5173"), { FRONTEND_ORIGIN: "http://localhost:5173" }) as Record<string, string>;
    expect(h["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
  });
  it("does not reflect arbitrary origins", () => {
    const h = corsHeaders(req("https://evil.example"), { FRONTEND_ORIGIN: "http://localhost:5173" }) as Record<string, string>;
    expect(h["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
  });
});

