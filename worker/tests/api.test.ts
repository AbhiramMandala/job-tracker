import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import app from "../src/index";
import type { Env } from "../src/types";

// Minimal in-memory D1 mock supporting the queries used by the worker.
type Row = Record<string, any>;

class MockStmt {
  constructor(private db: MockD1, private sql: string) {}
  private params: unknown[] = [];
  bind(...params: unknown[]): MockStmt {
    const s = new MockStmt(this.db, this.sql);
    s.params = params;
    return s;
  }
  async first<T = Row>(): Promise<T | null> {
    const all = await this.all<T>();
    return (all.results[0] as T) ?? null;
  }
  async all<T = Row>(): Promise<{ results: T[] }> {
    return { results: this.db.query<T>(this.sql, this.params) };
  }
  async run(): Promise<{ success: boolean }> {
    this.db.query(this.sql, this.params);
    return { success: true };
  }
}

class MockD1 {
  tables: Record<string, Row[]> = {
    users: [],
    sessions: [],
    applications: [],
    interviews: [],
    notes: [],
    resumes: [],
    password_resets: [],
    discover_searches: [],
  };
  prepare(sql: string): MockStmt {
    return new MockStmt(this, sql);
  }
  batch(stmts: MockStmt[]): Promise<unknown[]> {
    return Promise.all(stmts.map((s) => s.run()));
  }

  query<T>(sql: string, params: unknown[]): T[] {
    const q = sql.replace(/\s+/g, " ").trim();
    const T = this.tables;
    const like = (v: string, pattern: string) => {
      const p = String(pattern).replace(/%/g, "");
      return String(v ?? "").toLowerCase().includes(p.toLowerCase());
    };

    // INSERTs
    if (q.startsWith("INSERT INTO users")) {
      if (q.includes(", role,")) {
        if (params.length === 7) {
          // Admin create: role is a bound parameter.
          const [id, email, password_hash, name, role, created_at, updated_at] = params as any[];
          if (T.users.some((u) => u.email === email)) throw new Error("UNIQUE constraint failed: users.email");
          T.users.push({ id, email, password_hash, name, role, created_at, updated_at });
          return [];
        }
        const [id, email, password_hash, name, created_at, updated_at] = params as any[];
        if (T.users.some((u) => u.email === email)) throw new Error("UNIQUE constraint failed: users.email");
        T.users.push({ id, email, password_hash, name, role: "student", created_at, updated_at });
        return [];
      }
      const [id, email, password_hash, name, created_at, updated_at] = params as any[];
      if (T.users.some((u) => u.email === email)) throw new Error("UNIQUE constraint failed: users.email");
      T.users.push({ id, email, password_hash, name, role: "student", created_at, updated_at });
      return [];
    }
    if (q.startsWith("INSERT INTO sessions")) {
      const [id, user_id, token_hash, expires_at, created_at] = params as any[];
      T.sessions.push({ id, user_id, token_hash, expires_at, created_at });
      return [];
    }
    if (q.startsWith("INSERT INTO applications")) {
      const [id, user_id, company, job_title, location, job_url, job_type, salary, application_date, status, notes, contact_person, contact_email, follow_up_date, follow_up_reminder, follow_up_notes, resume_id, jobsetu_job_id, provider, provider_job_id, created_at, updated_at] = params as any[];
      T.applications.push({ id, user_id, company, job_title, location, job_url, job_type, salary, application_date, status, notes, contact_person, contact_email, follow_up_date, follow_up_reminder, follow_up_notes, resume_id, jobsetu_job_id, provider, provider_job_id, created_at, updated_at });
      return [];
    }
    if (q.startsWith("INSERT INTO interviews")) {
      const [id, user_id, application_id, interview_type, scheduled_at, interviewer, meeting_url, notes, result, created_at, updated_at] = params as any[];
      T.interviews.push({ id, user_id, application_id, interview_type, scheduled_at, interviewer, meeting_url, notes, result, created_at, updated_at });
      return [];
    }
    if (q.startsWith("INSERT INTO notes")) {
      const [id, user_id, application_id, content, created_at, updated_at] = params as any[];
      T.notes.push({ id, user_id, application_id, content, created_at, updated_at });
      return [];
    }
    if (q.startsWith("INSERT INTO resumes")) {
      const [id, user_id, filename, content_type, size, r2_key, created_at] = params as any[];
      T.resumes.push({ id, user_id, filename, content_type, size, r2_key, created_at });
      return [];
    }

    // SELECT user by email
    if (q.includes("FROM users WHERE email")) {
      return T.users.filter((u) => u.email === params[0]) as unknown as T[];
    }
    if (q.includes("SELECT id FROM users WHERE email")) {
      return T.users.filter((u) => u.email === params[0]).map((u) => ({ id: u.id })) as unknown as T[];
    }
    // Session join
    if (q.includes("FROM sessions s JOIN users u")) {
      const s = T.sessions.find((x) => x.token_hash === params[0]);
      if (!s) return [];
      const u = T.users.find((x) => x.id === s.user_id);
      if (!u) return [];
      return [{ id: u.id, email: u.email, name: u.name, role: u.role ?? "student", created_at: u.created_at, expires_at: s.expires_at }] as unknown as T[];
    }
    // Admin user management
    if (q.startsWith("SELECT id, email, name, role, created_at FROM users")) {
      return T.users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role ?? "student", created_at: u.created_at })) as unknown as T[];
    }
    if (q.startsWith("SELECT id, email, name, created_at FROM users ORDER BY")) {
      return T.users.map((u) => ({ id: u.id, email: u.email, name: u.name, created_at: u.created_at })) as unknown as T[];
    }
    if (q.startsWith("SELECT COUNT(*) AS total FROM users")) {
      let rows = [...T.users];
      let i = 0;
      if (q.includes("LIKE ?")) {
        const p = params[i++] as string; const p2 = params[i++] as string;
        rows = rows.filter((u) => like(u.email, p) || like(u.name, p2));
      }
      if (q.includes("role = ?")) rows = rows.filter((u) => (u.role ?? "student") === params[i++]);
      return [{ total: rows.length }] as unknown as T[];
    }
    if (q.startsWith("SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?")) {
      return T.users.filter((u) => u.id === params[0]) as unknown as T[];
    }
    if (q.startsWith("SELECT id, email, name, role, created_at, updated_at FROM users")) {
      let rows = [...T.users];
      let i = 0;
      if (q.includes("LIKE ?")) {
        const p = params[i++] as string; const p2 = params[i++] as string;
        rows = rows.filter((u) => like(u.email, p) || like(u.name, p2));
      }
      if (q.includes("role = ?")) rows = rows.filter((u) => (u.role ?? "student") === params[i++]);
      const limit = params[params.length - 2] as number;
      const offset = params[params.length - 1] as number;
      return rows.slice(offset, offset + limit).map((u) => ({
        id: u.id, email: u.email, name: u.name, role: u.role ?? "student",
        created_at: u.created_at, updated_at: u.updated_at ?? u.created_at,
      })) as unknown as T[];
    }
    if (q.startsWith("SELECT id, email, role FROM users WHERE id = ?")) {
      return T.users.filter((u) => u.id === params[0]).map((u) => ({ id: u.id, email: u.email, role: u.role ?? "student" })) as unknown as T[];
    }
    if (q.startsWith("SELECT role FROM users WHERE id = ?")) {
      return T.users.filter((u) => u.id === params[0]).map((u) => ({ role: u.role ?? "student" })) as unknown as T[];
    }
    if (q.startsWith("SELECT COUNT(*) AS n FROM users WHERE role = ?")) {
      return [{ n: T.users.filter((u) => (u.role ?? "student") === params[0]).length }] as unknown as T[];
    }
    if (q.startsWith("SELECT COUNT(*) AS n FROM ")) {
      const table = q.split("FROM ")[1]!.split(" ")[0]!;
      const rows = (T[table] ?? []).filter((r) => r.user_id === params[0]);
      return [{ n: rows.length }] as unknown as T[];
    }
    if (q.startsWith("SELECT r2_key FROM resumes WHERE user_id = ?")) {
      return T.resumes.filter((r) => r.user_id === params[0]).map((r) => ({ r2_key: r.r2_key })) as unknown as T[];
    }
    if (q.startsWith("DELETE FROM users WHERE id = ?")) {
      const id = params[0];
      T.users = T.users.filter((u) => u.id !== id);
      // Mirror ON DELETE CASCADE for user-owned rows.
      for (const t of ["sessions", "applications", "interviews", "notes", "resumes", "password_resets", "discover_searches"]) {
        T[t] = (T[t] ?? []).filter((r) => r.user_id !== id);
      }
      return [];
    }
    if (q.startsWith("SELECT id FROM users WHERE id = ?")) {
      return T.users.filter((u) => u.id === params[0]).map((u) => ({ id: u.id })) as unknown as T[];
    }
    if (q.startsWith("UPDATE users SET") && q.includes("updated_at = ? WHERE id = ?")) {
      // Generic single-row user update: parse SET columns and zip binds.
      const setPart = q.split("SET ")[1]!.split(" WHERE ")[0]!;
      const cols = setPart.split(",").map((c) => c.trim().split(" ")[0]);
      const id = params[params.length - 1];
      const u = T.users.find((x) => x.id === id);
      if (u) cols.forEach((c, i) => { (u as any)[c!] = params[i]; });
      return [];
    }
    if (q.startsWith("UPDATE users SET role = ?")) {
      const u = T.users.find((x) => x.id === params[2]);
      if (u) { u.role = params[0]; u.updated_at = params[1]; }
      return [];
    }
    if (q.startsWith("DELETE FROM sessions WHERE token_hash")) {
      T.sessions = T.sessions.filter((x) => x.token_hash !== params[0]);
      return [];
    }
    if (q.startsWith("DELETE FROM sessions WHERE user_id")) {
      T.sessions = T.sessions.filter((x) => x.user_id !== params[0]);
      return [];
    }
    if (q.startsWith("UPDATE users SET password_hash = ?")) {
      const u = T.users.find((x) => x.id === params[2]);
      if (u) { u.password_hash = params[0]; u.updated_at = params[1]; }
      return [];
    }
    // Password resets
    if (q.startsWith("DELETE FROM password_resets WHERE expires_at <=")) {
      T.password_resets = T.password_resets.filter((x) => !(x.expires_at <= (params[0] as string)));
      return [];
    }
    if (q.startsWith("DELETE FROM password_resets WHERE user_id")) {
      T.password_resets = T.password_resets.filter((x) => x.user_id !== params[0]);
      return [];
    }
    if (q.startsWith("DELETE FROM password_resets WHERE id = ?")) {
      T.password_resets = T.password_resets.filter((x) => x.id !== params[0]);
      return [];
    }
    if (q.startsWith("INSERT INTO password_resets")) {
      const [id, user_id, selector, token_hash, expires_at, created_at] = params as any[];
      T.password_resets.push({ id, user_id, selector, token_hash, expires_at, created_at });
      return [];
    }
    if (q.startsWith("SELECT id, user_id, token_hash, expires_at FROM password_resets WHERE selector")) {
      return T.password_resets.filter((x) => x.selector === params[0]) as unknown as T[];
    }
    // Applications
    if (q.startsWith("SELECT * FROM applications WHERE id = ? AND user_id")) {
      return T.applications.filter((a) => a.id === params[0] && a.user_id === params[1]) as unknown as T[];
    }
    if (q.startsWith("SELECT id FROM applications WHERE id = ? AND user_id")) {
      return T.applications.filter((a) => a.id === params[0] && a.user_id === params[1]).map((a) => ({ id: a.id })) as unknown as T[];
    }
    if (q.startsWith("SELECT id FROM applications WHERE user_id = ? AND jobsetu_job_id = ?")) {
      return T.applications.filter((a) => a.user_id === params[0] && a.jobsetu_job_id === params[1]).map((a) => ({ id: a.id })) as unknown as T[];
    }
    if (q.startsWith("SELECT id FROM applications WHERE user_id = ? AND provider = ? AND provider_job_id = ?")) {
      return T.applications.filter((a) => a.user_id === params[0] && a.provider === params[1] && a.provider_job_id === params[2]).map((a) => ({ id: a.id })) as unknown as T[];
    }
    // Discover searches
    if (q.startsWith("INSERT INTO discover_searches")) {
      const [id, user_id, role, location, experience, job_count, results_json, created_at] = params as any[];
      T.discover_searches.push({ id, user_id, role, location, experience, job_count, results_json, created_at });
      return [];
    }
    if (q.startsWith("SELECT id, role, location, experience, job_count, created_at FROM discover_searches WHERE user_id")) {
      return [...T.discover_searches].filter((s) => s.user_id === params[0]).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 20) as unknown as T[];
    }
    if (q.startsWith("SELECT id, results_json FROM discover_searches WHERE id = ? AND user_id")) {
      return T.discover_searches.filter((s) => s.id === params[0] && s.user_id === params[1]) as unknown as T[];
    }
    if (q.startsWith("SELECT COUNT(*) as total FROM applications")) {
      let rows = T.applications.filter((a) => a.user_id === params[0]);
      let i = 1;
      if (q.includes("status = ?")) { rows = rows.filter((a) => a.status === params[i++]); }
      if (q.includes("job_type = ?")) { rows = rows.filter((a) => a.job_type === params[i++]); }
      if (q.includes("LIKE ?")) {
        const p1 = params[i++] as string; const p2 = params[i++] as string;
        rows = rows.filter((a) => like(a.company, p1) || like(a.job_title, p2));
      }
      if (q.includes("application_date >=")) { const f = params[i++] as string; rows = rows.filter((a) => a.application_date >= f); }
      if (q.includes("application_date <=")) { const f = params[i++] as string; rows = rows.filter((a) => a.application_date <= f); }
      return [{ total: rows.length }] as unknown as T[];
    }
    if (q.startsWith("SELECT * FROM applications") || q.startsWith("SELECT id, company, job_title, follow_up_date")) {
      let rows = T.applications.filter((a) => a.user_id === params[0]);
      let i = 1;
      if (q.includes("status = ?")) { rows = rows.filter((a) => a.status === params[i++]); }
      if (q.includes("job_type = ?")) { rows = rows.filter((a) => a.job_type === params[i++]); }
      if (q.includes("LIKE ?")) {
        const p1 = params[i++] as string; const p2 = params[i++] as string;
        rows = rows.filter((a) => like(a.company, p1) || like(a.job_title, p2));
      }
      if (q.includes("application_date >=")) { const f = params[i++] as string; rows = rows.filter((a) => a.application_date >= f); }
      if (q.includes("application_date <=")) { const f = params[i++] as string; rows = rows.filter((a) => a.application_date <= f); }
      if (q.includes("ORDER BY created_at DESC LIMIT 5")) {
        rows = [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 5);
        return rows as unknown as T[];
      }
      if (q.includes("follow_up_reminder = 1")) {
        const today = params[1] as string;
        const overdue = q.includes("substr(follow_up_date, 1, 10) < ?");
        rows = rows.filter((a) => Number(a.follow_up_reminder) === 1 && a.follow_up_date && !["REJECTED", "WITHDRAWN", "OFFER"].includes(a.status));
        rows = rows.filter((a) => overdue ? String(a.follow_up_date).slice(0, 10) < today : String(a.follow_up_date).slice(0, 10) >= today);
        return rows.slice(0, 10) as unknown as T[];
      }
      const oldest = q.includes("application_date ASC");
      rows = [...rows].sort((a, b) => oldest ? (a.application_date > b.application_date ? 1 : -1) : (a.application_date < b.application_date ? 1 : -1));
      const limit = params[params.length - 2] as number;
      const offset = params[params.length - 1] as number;
      return rows.slice(offset, offset + limit) as unknown as T[];
    }
    if (q.includes("SELECT status, COUNT(*)")) {
      const map = new Map<string, number>();
      for (const a of T.applications.filter((x) => x.user_id === params[0])) map.set(a.status, (map.get(a.status) ?? 0) + 1);
      return [...map.entries()].map(([status, count]) => ({ status, count })) as unknown as T[];
    }
    if (q.startsWith("SELECT COUNT(*) AS discovered FROM applications")) {
      const n = T.applications.filter((a) => a.user_id === params[0] && a.jobsetu_job_id != null).length;
      return [{ discovered: n }] as unknown as T[];
    }
    if (q.startsWith("UPDATE applications SET company")) {
      const [company, job_title, location, job_url, job_type, salary, application_date, status, notes, contact_person, contact_email, follow_up_date, follow_up_reminder, follow_up_notes, resume_id, updated_at, id, user_id] = params as any[];
      const a = T.applications.find((x) => x.id === id && x.user_id === user_id);
      if (a) Object.assign(a, { company, job_title, location, job_url, job_type, salary, application_date, status, notes, contact_person, contact_email, follow_up_date, follow_up_reminder, follow_up_notes, resume_id, updated_at });
      return [];
    }
    if (q.startsWith("UPDATE applications SET resume_id = NULL")) {
      for (const a of T.applications.filter((x) => x.resume_id === params[0] && x.user_id === params[1])) a.resume_id = null;
      return [];
    }
    if (q.startsWith("UPDATE applications SET resume_id = ?")) {
      const a = T.applications.find((x) => x.id === params[2] && x.user_id === params[3]);
      if (a) { a.resume_id = params[0]; a.updated_at = params[1]; }
      return [];
    }
    if (q.startsWith("DELETE FROM applications")) {
      T.applications = T.applications.filter((a) => !(a.id === params[0] && a.user_id === params[1]));
      return [];
    }
    if (q.startsWith("DELETE FROM interviews WHERE application_id")) {
      T.interviews = T.interviews.filter((x) => !(x.application_id === params[0] && x.user_id === params[1]));
      return [];
    }
    if (q.startsWith("DELETE FROM notes WHERE application_id")) {
      T.notes = T.notes.filter((x) => !(x.application_id === params[0] && x.user_id === params[1]));
      return [];
    }
    // Interviews
    if (q.includes("FROM interviews i") && q.includes("JOIN applications")) {
      let rows = T.interviews.filter((x) => x.user_id === params[0]);
      let i = 1;
      if (q.includes("i.application_id = ?")) { rows = rows.filter((x) => x.application_id === params[i++]); }
      if (q.includes("i.scheduled_at >=")) { const f = params[i++] as string; rows = rows.filter((x) => x.scheduled_at >= f); }
      rows = [...rows].sort((a, b) => (a.scheduled_at > b.scheduled_at ? 1 : -1));
      return rows.map((r) => {
        const a = T.applications.find((x) => x.id === r.application_id);
        return { ...r, company: a?.company ?? "", job_title: a?.job_title ?? "" };
      }) as unknown as T[];
    }
    if (q.includes("FROM interviews WHERE id = ? AND user_id")) {
      return T.interviews.filter((x) => x.id === params[0] && x.user_id === params[1]) as unknown as T[];
    }
    if (q.includes("FROM interviews WHERE application_id")) {
      return T.interviews.filter((x) => x.application_id === params[0] && x.user_id === params[1]) as unknown as T[];
    }
    if (q.startsWith("UPDATE interviews SET")) {
      const [interview_type, scheduled_at, interviewer, meeting_url, notes, result, updated_at, id, user_id] = params as any[];
      const r = T.interviews.find((x) => x.id === id && x.user_id === user_id);
      if (r) Object.assign(r, { interview_type, scheduled_at, interviewer, meeting_url, notes, result, updated_at });
      return [];
    }
    if (q.startsWith("DELETE FROM interviews WHERE id")) {
      T.interviews = T.interviews.filter((x) => !(x.id === params[0] && x.user_id === params[1]));
      return [];
    }
    // Notes
    if (q.includes("FROM notes WHERE application_id")) {
      return T.notes.filter((x) => x.application_id === params[0] && x.user_id === params[1]) as unknown as T[];
    }
    if (q.includes("FROM notes WHERE id = ? AND user_id")) {
      return T.notes.filter((x) => x.id === params[0] && x.user_id === params[1]) as unknown as T[];
    }
    if (q.startsWith("UPDATE notes SET content")) {
      const r = T.notes.find((x) => x.id === params[2] && x.user_id === params[3]);
      if (r) { r.content = params[0]; r.updated_at = params[1]; }
      return [];
    }
    if (q.startsWith("DELETE FROM notes WHERE id")) {
      T.notes = T.notes.filter((x) => !(x.id === params[0] && x.user_id === params[1]));
      return [];
    }
    // Resumes
    if (q.includes("FROM resumes WHERE id = ? AND user_id")) {
      return T.resumes.filter((x) => x.id === params[0] && x.user_id === params[1]) as unknown as T[];
    }
    if (q.includes("FROM resumes WHERE user_id")) {
      return T.resumes.filter((x) => x.user_id === params[0]) as unknown as T[];
    }
    if (q.startsWith("SELECT id FROM resumes WHERE")) {
      return T.resumes.filter((x) => x.id === params[0] && x.user_id === params[1]).map((x) => ({ id: x.id })) as unknown as T[];
    }
    if (q.startsWith("DELETE FROM resumes")) {
      T.resumes = T.resumes.filter((x) => !(x.id === params[0] && x.user_id === params[1]));
      return [];
    }
    throw new Error(`Unhandled mock query: ${sql} :: ${JSON.stringify(params)}`);
  }
}

class MockR2 {
  store = new Map<string, { body: Uint8Array; contentType: string }>();
  async put(key: string, body: Uint8Array, opts?: any): Promise<void> {
    this.store.set(key, { body, contentType: opts?.httpMetadata?.contentType ?? "application/octet-stream" });
  }
  async get(key: string): Promise<{ body: Uint8Array } | null> {
    const v = this.store.get(key);
    return v ? { body: v.body } : null;
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function makeEnv(): Env & { __db: MockD1; __r2: MockR2 } {
  const db = new MockD1() as unknown as D1Database;
  const r2 = new MockR2() as unknown as R2Bucket;
  return { DB: db, RESUMES: r2, SESSION_SECRET: "test-secret", FRONTEND_ORIGIN: "http://localhost:5173", __db: db as unknown as MockD1, __r2: r2 as unknown as MockR2 };
}

async function api(env: Env, method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData)) headers["content-type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await (app.fetch as any)(
    new Request(`https://example.com${path}`, {
      method,
      headers,
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    }),
    env,
    {} as ExecutionContext,
  );
  return { status: res.status, json: await res.json().catch(() => null) };
}

describe("auth flow", () => {
  let env: ReturnType<typeof makeEnv>;
  beforeEach(() => {
    env = makeEnv();
  });

  it("registers, persists session via /me, and logs out", async () => {
    const reg = await api(env, "POST", "/api/auth/register", { email: "Stu@Test.com", password: "password123", name: "Stu" });
    expect(reg.status).toBe(201);
    expect(reg.json.data.user.email).toBe("stu@test.com");
    expect(reg.json.data.user).not.toHaveProperty("password_hash");
    const token = reg.json.data.token as string;
    expect(token).toBeTruthy();

    const me = await api(env, "GET", "/api/auth/me", undefined, token);
    expect(me.status).toBe(200);
    expect(me.json.data.user.email).toBe("stu@test.com");

    const out = await api(env, "POST", "/api/auth/logout", undefined, token);
    expect(out.status).toBe(200);
    const me2 = await api(env, "GET", "/api/auth/me", undefined, token);
    expect(me2.status).toBe(401);
  });

  it("rejects duplicate registration and invalid passwords", async () => {
    await api(env, "POST", "/api/auth/register", { email: "a@b.com", password: "password123" });
    const dup = await api(env, "POST", "/api/auth/register", { email: "a@b.com", password: "password123" });
    expect(dup.status).toBe(409);

    const badLogin = await api(env, "POST", "/api/auth/login", { email: "a@b.com", password: "wrongpass1" });
    expect(badLogin.status).toBe(401);
    expect(badLogin.json.error.code).toBe("UNAUTHORIZED");

    const goodLogin = await api(env, "POST", "/api/auth/login", { email: "a@b.com", password: "password123" });
    expect(goodLogin.status).toBe(200);
  });

  it("blocks unauthenticated API access", async () => {
    for (const [m, p] of [["GET", "/api/applications"], ["GET", "/api/dashboard"], ["GET", "/api/interviews"]] as const) {
      const r = await api(env, m, p);
      expect(r.status).toBe(401);
    }
  });

  it("serves a public service index at /", async () => {
    const r = await api(env, "GET", "/");
    expect(r.status).toBe(200);
    expect(r.json.data.service).toBe("student-job-tracker-api");
  });
});

describe("password reset flow", () => {
  let env: ReturnType<typeof makeEnv>;
  beforeEach(async () => {
    env = makeEnv();
    await api(env, "POST", "/api/auth/register", { email: "f@x.com", password: "password123" });
  });

  async function seedReset(userId: string, rawToken: string, expiresAt: string) {
    const { sha256Hex } = await import("../src/utils/crypto");
    env.__db.tables.password_resets.push({
      id: "pr1",
      user_id: userId,
      selector: "a".repeat(32),
      token_hash: await sha256Hex(rawToken),
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });
  }

  it("returns ok without enumerating unknown accounts", async () => {
    const r = await api(env, "POST", "/api/auth/forgot-password", { email: "nobody@x.com" });
    expect(r.status).toBe(200);
    expect(r.json.data.ok).toBe(true);
    expect(env.__db.tables.password_resets).toHaveLength(0);
  });

  it("creates a hashed single-use token for known accounts", async () => {
    const r = await api(env, "POST", "/api/auth/forgot-password", { email: "f@x.com" });
    expect(r.status).toBe(200);
    expect(env.__db.tables.password_resets).toHaveLength(1);
    const row = env.__db.tables.password_resets[0];
    expect(row.selector).toMatch(/^[0-9a-f]{32}$/);
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    // Second request revokes the first (one outstanding token).
    await api(env, "POST", "/api/auth/forgot-password", { email: "f@x.com" });
    expect(env.__db.tables.password_resets).toHaveLength(1);
  });

  it("resets the password, revokes sessions, and burns the token", async () => {
    const userId = env.__db.tables.users[0].id as string;
    const raw = "b".repeat(64);
    await seedReset(userId, raw, new Date(Date.now() + 3600000).toISOString());
    const oldSessions = env.__db.tables.sessions.length;
    expect(oldSessions).toBeGreaterThan(0);

    const r = await api(env, "POST", "/api/auth/reset-password", {
      selector: "a".repeat(32),
      token: raw,
      new_password: "newpassword123",
    });
    expect(r.status).toBe(200);
    // Sessions revoked, token single-use.
    expect(env.__db.tables.sessions).toHaveLength(0);
    expect(env.__db.tables.password_resets).toHaveLength(0);
    // New password works, old one does not.
    expect((await api(env, "POST", "/api/auth/login", { email: "f@x.com", password: "newpassword123" })).status).toBe(200);
    expect((await api(env, "POST", "/api/auth/login", { email: "f@x.com", password: "password123" })).status).toBe(401);
    // Replaying the same link fails.
    await seedReset(userId, raw, new Date(Date.now() + 3600000).toISOString());
    await api(env, "POST", "/api/auth/reset-password", { selector: "a".repeat(32), token: raw, new_password: "anotherpass1" });
    const replay = await api(env, "POST", "/api/auth/reset-password", { selector: "a".repeat(32), token: raw, new_password: "thirdpass12" });
    expect(replay.status).toBe(400);
  });

  it("rejects bad tokens, expired links, and weak passwords uniformly", async () => {
    const userId = env.__db.tables.users[0].id as string;
    await seedReset(userId, "c".repeat(64), new Date(Date.now() + 3600000).toISOString());
    const wrong = await api(env, "POST", "/api/auth/reset-password", { selector: "a".repeat(32), token: "d".repeat(64), new_password: "newpassword123" });
    expect(wrong.status).toBe(400);
    expect(wrong.json.error.message).toBe("Invalid or expired reset link");

    env.__db.tables.password_resets.length = 0;
    await seedReset(userId, "c".repeat(64), new Date(Date.now() - 1000).toISOString());
    expect((await api(env, "POST", "/api/auth/reset-password", { selector: "a".repeat(32), token: "c".repeat(64), new_password: "newpassword123" })).status).toBe(400);

    expect((await api(env, "POST", "/api/auth/reset-password", { selector: "bad", token: "bad", new_password: "short" })).status).toBe(400);
    expect((await api(env, "POST", "/api/auth/forgot-password", { email: "not-an-email" })).status).toBe(400);
  });
});

describe("applications CRUD + ownership + filtering", () => {
  let env: ReturnType<typeof makeEnv>;
  let tokenA = "";
  let tokenB = "";
  beforeEach(async () => {
    env = makeEnv();
    tokenA = (await api(env, "POST", "/api/auth/register", { email: "a@x.com", password: "password123" })).json.data.token;
    tokenB = (await api(env, "POST", "/api/auth/register", { email: "b@x.com", password: "password123" })).json.data.token;
  });

  it("creates, reads, updates, deletes", async () => {
    const created = await api(env, "POST", "/api/applications", { company: "Google", job_title: "SWE Intern", application_date: "2026-01-10", status: "APPLIED" }, tokenA);
    expect(created.status).toBe(201);
    const id = created.json.data.id as string;

    const got = await api(env, "GET", `/api/applications/${id}`, undefined, tokenA);
    expect(got.status).toBe(200);
    expect(got.json.data.company).toBe("Google");

    const upd = await api(env, "PUT", `/api/applications/${id}`, { status: "INTERVIEW" }, tokenA);
    expect(upd.status).toBe(200);
    expect(upd.json.data.status).toBe("INTERVIEW");

    const del = await api(env, "DELETE", `/api/applications/${id}`, undefined, tokenA);
    expect(del.status).toBe(200);
    const gone = await api(env, "GET", `/api/applications/${id}`, undefined, tokenA);
    expect(gone.status).toBe(404);
  });

  it("enforces ownership (cannot access other user's app by id)", async () => {
    const created = await api(env, "POST", "/api/applications", { company: "Meta", job_title: "SWE", application_date: "2026-01-10" }, tokenA);
    const id = created.json.data.id as string;
    expect((await api(env, "GET", `/api/applications/${id}`, undefined, tokenB)).status).toBe(404);
    expect((await api(env, "PUT", `/api/applications/${id}`, { status: "OFFER" }, tokenB)).status).toBe(404);
    expect((await api(env, "DELETE", `/api/applications/${id}`, undefined, tokenB)).status).toBe(404);
  });

  it("validates input and filters/sorts/paginates at API level", async () => {
    const bad = await api(env, "POST", "/api/applications", { company: "", job_title: "" }, tokenA);
    expect(bad.status).toBe(400);
    expect(bad.json.error.code).toBe("VALIDATION_ERROR");

    await api(env, "POST", "/api/applications", { company: "Google", job_title: "Backend", application_date: "2026-01-01", status: "APPLIED", job_type: "FULL_TIME" }, tokenA);
    await api(env, "POST", "/api/applications", { company: "Amazon", job_title: "Frontend", application_date: "2026-02-01", status: "SAVED", job_type: "INTERNSHIP" }, tokenA);

    const search = await api(env, "GET", "/api/applications?search=goog", undefined, tokenA);
    expect(search.json.data.items).toHaveLength(1);

    const byStatus = await api(env, "GET", "/api/applications?status=SAVED", undefined, tokenA);
    expect(byStatus.json.data.items.every((x: any) => x.status === "SAVED")).toBe(true);

    const page = await api(env, "GET", "/api/applications?limit=1&page=2", undefined, tokenA);
    expect(page.json.data.items).toHaveLength(1);
    expect(page.json.data.pagination.total).toBe(2);
  });

  it("dashboard aggregates stats and follow-ups", async () => {
    await api(env, "POST", "/api/applications", { company: "Late Co", job_title: "Dev", application_date: "2026-01-01", status: "APPLIED", follow_up_date: "2020-01-01", follow_up_reminder: true }, tokenA);
    await api(env, "POST", "/api/applications", { company: "Qloron", job_title: "Dev", application_date: "2026-01-02", status: "SAVED", jobsetu: { job_id: 7 } }, tokenA);
    const dash = await api(env, "GET", "/api/dashboard", undefined, tokenA);
    expect(dash.status).toBe(200);
    expect(dash.json.data.totals.total).toBe(2);
    expect(dash.json.data.overdueFollowUps).toHaveLength(1);
    expect(dash.json.data.discoveryImports).toBe(1);
  });
});

describe("JobSetu duplicate prevention", () => {
  let env: ReturnType<typeof makeEnv>;
  let token = "";
  beforeEach(async () => {
    env = makeEnv();
    token = (await api(env, "POST", "/api/auth/register", { email: "dup@test.com", password: "password123" })).json.data.token;
  });

  it("rejects duplicate JobSetu job_id for same user", async () => {
    const first = await api(env, "POST", "/api/applications", {
      company: "Qloron",
      job_title: "Python Backend Developer",
      application_date: "2026-10-05",
      status: "SAVED",
      jobsetu: { job_id: 123 }
    }, token);
    expect(first.status).toBe(201);

    const dup = await api(env, "POST", "/api/applications", {
      company: "Qloron",
      job_title: "Python Backend Developer",
      application_date: "2026-10-05",
      status: "OFFER",
      jobsetu: { job_id: 123 }
    }, token);
    expect(dup.status).toBe(409);
    expect(dup.json.error.code).toBe("CONFLICT");
  });

  it("allows same JobSetu job_id for different users", async () => {
    const token2 = (await api(env, "POST", "/api/auth/register", { email: "other@test.com", password: "password123" })).json.data.token;

    const first = await api(env, "POST", "/api/applications", {
      company: "Qloron",
      job_title: "Python Backend Developer",
      application_date: "2026-10-05",
      status: "SAVED",
      jobsetu: { job_id: 123 }
    }, token);
    expect(first.status).toBe(201);

    const second = await api(env, "POST", "/api/applications", {
      company: "Qloron",
      job_title: "Python Backend Developer",
      application_date: "2026-10-05",
      status: "SAVED",
      jobsetu: { job_id: 123 }
    }, token2);
    expect(second.status).toBe(201);
  });

  it("allows different JobSetu job_ids for same user", async () => {
    const first = await api(env, "POST", "/api/applications", {
      company: "Qloron",
      job_title: "Python Backend Developer",
      application_date: "2026-10-05",
      status: "SAVED",
      jobsetu: { job_id: 123 }
    }, token);
    expect(first.status).toBe(201);

    const second = await api(env, "POST", "/api/applications", {
      company: "Qloron",
      job_title: "Python Backend Developer",
      application_date: "2026-10-05",
      status: "OFFER",
      jobsetu: { job_id: 456 }
    }, token);
    expect(second.status).toBe(201);
  });

  it("rejects invalid jobsetu reference", async () => {
    const res = await api(env, "POST", "/api/applications", {
      company: "Test",
      job_title: "Dev",
      application_date: "2026-10-05",
      jobsetu: { job_id: "invalid" }
    }, token);
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("interviews, notes, resumes", () => {
  let env: ReturnType<typeof makeEnv>;
  let token = "";
  let appId = "";
  beforeEach(async () => {
    env = makeEnv();
    token = (await api(env, "POST", "/api/auth/register", { email: "c@x.com", password: "password123" })).json.data.token;
    appId = (await api(env, "POST", "/api/applications", { company: "Netflix", job_title: "SWE", application_date: "2026-03-01" }, token)).json.data.id;
  });

  it("manages interviews scoped to owned applications", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const created = await api(env, "POST", "/api/interviews", { application_id: appId, interview_type: "TECHNICAL", scheduled_at: future }, token);
    expect(created.status).toBe(201);
    const list = await api(env, "GET", `/api/interviews?application_id=${appId}`, undefined, token);
    expect(list.json.data.items).toHaveLength(1);
  });

  it("manages notes", async () => {
    const n = await api(env, "POST", "/api/notes", { application_id: appId, content: "Prepare STAR stories" }, token);
    expect(n.status).toBe(201);
    const upd = await api(env, "PUT", `/api/notes/${n.json.data.id}`, { content: "Updated" }, token);
    expect(upd.json.data.content).toBe("Updated");
    expect((await api(env, "DELETE", `/api/notes/${n.json.data.id}`, undefined, token)).status).toBe(200);
  });

  it("uploads, lists, and deletes resumes with validation", async () => {
    const bad = new FormData();
    bad.append("file", new File(["x"], "evil.exe", { type: "application/x-msdownload" }));
    const badRes = await api(env, "POST", "/api/resumes", bad, token);
    expect(badRes.status).toBe(400);

    const good = new FormData();
    good.append("file", new File(["fake-pdf"], "resume.pdf", { type: "application/pdf" }));
    const up = await api(env, "POST", "/api/resumes", good, token);
    expect(up.status).toBe(201);
    expect(up.json.data.r2_key).toContain("resume.pdf");

    const list = await api(env, "GET", "/api/resumes", undefined, token);
    expect(list.json.data.items).toHaveLength(1);

    const del = await api(env, "DELETE", `/api/resumes/${up.json.data.id}`, undefined, token);
    expect(del.status).toBe(200);
  });
});

describe("auth hardening + RBAC + PBAC", () => {
  let env: ReturnType<typeof makeEnv>;
  let tokenA = "";
  let tokenB = "";
  beforeEach(async () => {
    env = makeEnv();
    tokenA = (await api(env, "POST", "/api/auth/register", { email: "a@x.com", password: "password123" })).json.data.token;
    tokenB = (await api(env, "POST", "/api/auth/register", { email: "b@x.com", password: "password123" })).json.data.token;
  });

  function promoteToAdmin(email: string) {
    const u = env.__db.tables.users.find((x) => x.email === email);
    if (u) u.role = "admin";
  }

  it("assigns the student role on register and exposes it via /me", async () => {
    const reg = await api(env, "POST", "/api/auth/register", { email: "new@x.com", password: "password123" });
    expect(reg.json.data.user.role).toBe("student");
    const me = await api(env, "GET", "/api/auth/me", undefined, reg.json.data.token);
    expect(me.json.data.user.role).toBe("student");
  });

  it("rejects expired sessions", async () => {
    const reg = await api(env, "POST", "/api/auth/register", { email: "old@x.com", password: "password123" });
    for (const s of env.__db.tables.sessions) s.expires_at = new Date(Date.now() - 1000).toISOString();
    const me = await api(env, "GET", "/api/auth/me", undefined, reg.json.data.token);
    expect(me.status).toBe(401);
  });

  it("ignores client-supplied user_id (no mass assignment / IDOR)", async () => {
    const created = await api(env, "POST", "/api/applications", {
      company: "Evil", job_title: "Dev", application_date: "2026-01-10", user_id: "someone-else",
    }, tokenA);
    expect(created.status).toBe(201);
    expect(created.json.data.user_id).not.toBe("someone-else");
    // The other user cannot see it.
    const list = await api(env, "GET", "/api/applications?search=Evil", undefined, tokenB);
    expect(list.json.data.items).toHaveLength(0);
  });

  it("forbids students from admin endpoints, allows admins", async () => {
    const denied = await api(env, "GET", "/api/admin/users", undefined, tokenA);
    expect(denied.status).toBe(403);
    expect(denied.json.error.code).toBe("FORBIDDEN");

    promoteToAdmin("a@x.com");
    const allowed = await api(env, "GET", "/api/admin/users", undefined, tokenA);
    expect(allowed.status).toBe(200);
    expect(allowed.json.data.items.length).toBeGreaterThanOrEqual(2);
    expect(allowed.json.data.items[0]).not.toHaveProperty("password_hash");
  });

  it("lets admins change roles but never their own", async () => {
    promoteToAdmin("a@x.com");
    const userB = env.__db.tables.users.find((x) => x.email === "b@x.com")!;
    const ok = await api(env, "PUT", `/api/admin/users/${userB.id}/role`, { role: "admin" }, tokenA);
    expect(ok.status).toBe(200);
    expect(env.__db.tables.users.find((x) => x.email === "b@x.com")!.role).toBe("admin");

    const userA = env.__db.tables.users.find((x) => x.email === "a@x.com")!;
    const self = await api(env, "PUT", `/api/admin/users/${userA.id}/role`, { role: "student" }, tokenA);
    expect(self.status).toBe(400);

    const bad = await api(env, "PUT", `/api/admin/users/${userB.id}/role`, { role: "superuser" }, tokenA);
    expect(bad.status).toBe(400);
  });

  it("returns 404 for removed discover endpoints", async () => {
    // Native discovery now lives at these routes; legacy JobSetu-proxy paths
    // (tracker-export, evidence) were removed and must stay gone.
    expect((await api(env, "GET", "/api/discover/jobs/1/tracker-export", undefined, tokenA)).status).toBe(404);
    expect((await api(env, "GET", "/api/discover/evidence?path=/x", undefined, tokenA)).status).toBe(404);
  });
});

describe("native discover (SerpApi-backed)", () => {
  let env: ReturnType<typeof makeEnv>;
  let tokenA = "";
  let tokenB = "";
  beforeEach(async () => {
    env = makeEnv();
    tokenA = (await api(env, "POST", "/api/auth/register", { email: "a@x.com", password: "password123" })).json.data.token;
    tokenB = (await api(env, "POST", "/api/auth/register", { email: "b@x.com", password: "password123" })).json.data.token;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const SERPAPI_JOBS = {
    jobs_results: [
      {
        title: "Python Developer",
        company_name: "Acme",
        location: "Hyderabad",
        description: "Build APIs with Python and Django.",
        via: "LinkedIn",
        job_id: "abc123",
        detected_extensions: { posted_at: "2 days ago", schedule_type: "Full-time", work_from_home: true },
        apply_options: [{ title: "Apply on LinkedIn", link: "https://example.com/apply/1" }],
      },
      {
        title: "Junior QA",
        company_name: "Beta",
        location: "Bengaluru",
        // No job_id, no apply link, no extensions — normalization must cope.
      },
    ],
  };

  function stubSerpApi(body: unknown, status = 200, capture?: { url?: string }) {
    vi.stubGlobal("fetch", async (url: string) => {
      if (capture) capture.url = String(url);
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    });
  }

  function envWithKey(): Env {
    return { ...env, SERPAPI_API_KEY: "test-key" };
  }

  it("rejects unauthenticated discovery requests", async () => {
    expect((await api(env, "GET", "/api/discover/searches")).status).toBe(401);
    expect((await api(env, "POST", "/api/discover/search", { role: "x" })).status).toBe(401);
    expect((await api(env, "GET", "/api/discover/jobs?search_id=x")).status).toBe(401);
  });

  it("validates search input and requires a key without leaking it", async () => {
    expect((await api(env, "POST", "/api/discover/search", { role: "" }, tokenA)).status).toBe(400);
    expect((await api(env, "POST", "/api/discover/search", {}, tokenA)).status).toBe(400);
    // No key configured -> generic 503, key never appears in the response.
    const r = await api(env, "POST", "/api/discover/search", { role: "python", location: "Hyderabad", experience: "Fresher" }, tokenA);
    expect(r.status).toBe(503);
    expect(r.json.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(JSON.stringify(r.json)).not.toContain("SERPAPI");
  });

  it("searches, normalizes, stores history, and paginates", async () => {
    const capture: { url?: string } = {};
    stubSerpApi(SERPAPI_JOBS, 200, capture);
    const e = envWithKey();
    const r = await api(e, "POST", "/api/discover/search", { role: "Python Developer", location: "Hyderabad", experience: "Fresher" }, tokenA);
    expect(r.status).toBe(200);
    // Key travels server-side on the outbound call only.
    expect(capture.url).toContain("serpapi.com/search.json");
    expect(capture.url).toContain("api_key=test-key");
    expect(capture.url).toContain("engine=google_jobs");
    const jobs = r.json.data.jobs;
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ id: "abc123", title: "Python Developer", company: "Acme", source: "LinkedIn", posted_at: "2 days ago", employment_type: "FULL_TIME", remote: true });
    expect(jobs[0].apply_url).toBe("https://example.com/apply/1");
    expect(typeof jobs[1].id).toBe("string");
    expect(jobs[1].apply_url).toBe("");
    // History recorded for this user only.
    const mine = await api(e, "GET", "/api/discover/searches", undefined, tokenA);
    expect(mine.json.data.searches).toHaveLength(1);
    expect(mine.json.data.searches[0]).toMatchObject({ role: "Python Developer", location: "Hyderabad", experience: "Fresher", job_count: 2 });
    expect((await api(e, "GET", "/api/discover/searches", undefined, tokenB)).json.data.searches).toHaveLength(0);
    // Pagination over the stored snapshot.
    const searchId = r.json.data.search_id as string;
    const p1 = await api(e, "GET", `/api/discover/jobs?search_id=${searchId}&limit=1&page=2`, undefined, tokenA);
    expect(p1.json.data.jobs).toHaveLength(1);
    expect(p1.json.data.pagination).toMatchObject({ page: 2, total: 2, totalPages: 2 });
    expect((await api(e, "GET", `/api/discover/jobs?search_id=${searchId}`, undefined, tokenB)).status).toBe(404);
  });

  it("serves job details from the owned search snapshot", async () => {
    stubSerpApi(SERPAPI_JOBS);
    const e = envWithKey();
    const searchId = (await api(e, "POST", "/api/discover/search", { role: "python" }, tokenA)).json.data.search_id as string;
    const d = await api(e, "GET", `/api/discover/jobs/${searchId}/abc123`, undefined, tokenA);
    expect(d.status).toBe(200);
    expect(d.json.data).toMatchObject({ id: "abc123", company: "Acme" });
    expect((await api(e, "GET", `/api/discover/jobs/${searchId}/nope`, undefined, tokenA)).status).toBe(404);
    expect((await api(e, "GET", `/api/discover/jobs/${searchId}/abc123`, undefined, tokenB)).status).toBe(404);
  });

  it("saves jobs and blocks duplicates server-side", async () => {
    stubSerpApi(SERPAPI_JOBS);
    const e = envWithKey();
    const searchId = (await api(e, "POST", "/api/discover/search", { role: "python" }, tokenA)).json.data.search_id as string;
    const first = await api(e, "POST", `/api/discover/jobs/${searchId}/abc123/save`, undefined, tokenA);
    expect(first.status).toBe(201);
    expect(first.json.data.company).toBe("Acme");
    const dup = await api(e, "POST", `/api/discover/jobs/${searchId}/abc123/save`, undefined, tokenA);
    expect(dup.status).toBe(409);
    expect(dup.json.error.code).toBe("CONFLICT");
    expect(dup.json.error.message).toBe("Already tracked");
    expect(dup.json.error.details.application_id).toBe(first.json.data.id);
    // Same provider job is fine for a different user.
    const otherSearch = (await api(e, "POST", "/api/discover/search", { role: "python" }, tokenB)).json.data.search_id as string;
    expect((await api(e, "POST", `/api/discover/jobs/${otherSearch}/abc123/save`, undefined, tokenB)).status).toBe(201);
    // Unknown job in a valid search.
    expect((await api(e, "POST", `/api/discover/jobs/${searchId}/nope/save`, undefined, tokenA)).status).toBe(404);
  });

  it("maps provider failures to generic 503s", async () => {
    const e = envWithKey();
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));
    expect((await api(e, "POST", "/api/discover/search", { role: "python" }, tokenA)).status).toBe(503);
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ wrong: "shape" }), { status: 200, headers: { "content-type": "application/json" } }));
    expect((await api(e, "POST", "/api/discover/search", { role: "python" }, tokenA)).status).toBe(503);
    vi.stubGlobal("fetch", async () => { throw new Error("boom"); });
    expect((await api(e, "POST", "/api/discover/search", { role: "python" }, tokenA)).status).toBe(503);
  });

  it("caches identical recent searches", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return new Response(JSON.stringify(SERPAPI_JOBS), { status: 200, headers: { "content-type": "application/json" } });
    });
    const e = { ...envWithKey(), CACHE: { get: async () => null, put: async () => {}, delete: async () => {} } as unknown as KVNamespace };
    const first = await api(e, "POST", "/api/discover/search", { role: "python" }, tokenA);
    expect(first.json.data.meta.cached).toBe(false);
    // Prime the cache the way the worker would have, then search again.
    const e2 = {
      ...envWithKey(),
      CACHE: {
        get: async () => ({ jobs: first.json.data.jobs }),
        put: async () => {},
        delete: async () => {},
      } as unknown as KVNamespace,
    };
    const second = await api(e2, "POST", "/api/discover/search", { role: "python" }, tokenA);
    expect(second.json.data.meta.cached).toBe(true);
    expect(calls).toBe(1);
  });
});

describe("admin user CRUD", () => {
  let env: ReturnType<typeof makeEnv>;
  let tokenA = "";
  let tokenB = "";
  let userAId = "";
  let userBId = "";
  beforeEach(async () => {
    env = makeEnv();
    tokenA = (await api(env, "POST", "/api/auth/register", { email: "a@x.com", password: "password123" })).json.data.token;
    tokenB = (await api(env, "POST", "/api/auth/register", { email: "b@x.com", password: "password123" })).json.data.token;
    userAId = env.__db.tables.users.find((x) => x.email === "a@x.com")!.id as string;
    userBId = env.__db.tables.users.find((x) => x.email === "b@x.com")!.id as string;
    env.__db.tables.users.find((x) => x.email === "a@x.com")!.role = "admin";
  });

  it("gates every CRUD route: 401 unauthenticated, 403 student, 200 admin", async () => {
    expect((await api(env, "GET", "/api/admin/users")).status).toBe(401);
    expect((await api(env, "GET", `/api/admin/users/${userBId}`)).status).toBe(401);
    expect((await api(env, "POST", "/api/admin/users", { email: "c@x.com", password: "password123" })).status).toBe(401);
    expect((await api(env, "PUT", `/api/admin/users/${userBId}`, { name: "X" })).status).toBe(401);
    expect((await api(env, "DELETE", `/api/admin/users/${userBId}`)).status).toBe(401);

    for (const [m, p, b] of [
      ["GET", "/api/admin/users", undefined],
      ["GET", `/api/admin/users/${userBId}`, undefined],
      ["POST", "/api/admin/users", { email: "c@x.com", password: "password123" }],
      ["PUT", `/api/admin/users/${userBId}`, { name: "X" }],
      ["DELETE", `/api/admin/users/${userBId}`, undefined],
    ] as const) {
      const r = await api(env, m, p, b, tokenB);
      expect(r.status).toBe(403);
      expect(r.json.error.code).toBe("FORBIDDEN");
    }

    expect((await api(env, "GET", "/api/admin/users", undefined, tokenA)).status).toBe(200);
  });

  it("lists users with search, role filter, and pagination — never secrets", async () => {
    const all = await api(env, "GET", "/api/admin/users", undefined, tokenA);
    expect(all.json.data.items).toHaveLength(2);
    expect(all.json.data.pagination).toMatchObject({ page: 1, total: 2 });
    expect(JSON.stringify(all.json.data)).not.toContain("password_hash");
    expect(JSON.stringify(all.json.data)).not.toContain("token");

    const search = await api(env, "GET", "/api/admin/users?search=b%40x.com", undefined, tokenA);
    expect(search.json.data.items).toHaveLength(1);
    expect(search.json.data.items[0].email).toBe("b@x.com");

    const admins = await api(env, "GET", "/api/admin/users?role=admin", undefined, tokenA);
    expect(admins.json.data.items).toHaveLength(1);

    expect((await api(env, "GET", "/api/admin/users?role=superuser", undefined, tokenA)).status).toBe(400);

    const page = await api(env, "GET", "/api/admin/users?limit=1&page=2", undefined, tokenA);
    expect(page.json.data.items).toHaveLength(1);
    expect(page.json.data.pagination).toMatchObject({ page: 2, total: 2, totalPages: 2 });
  });

  it("shows user detail with counts, 404 for unknown ids", async () => {
    const d = await api(env, "GET", `/api/admin/users/${userBId}`, undefined, tokenA);
    expect(d.status).toBe(200);
    expect(d.json.data.email).toBe("b@x.com");
    expect(d.json.data.counts).toMatchObject({ applications: 0, interviews: 0, notes: 0, resumes: 0, sessions: 1 });
    expect(d.json.data).not.toHaveProperty("password_hash");
    expect((await api(env, "GET", "/api/admin/users/nope", undefined, tokenA)).status).toBe(404);
  });

  it("creates users with hashed passwords and safe duplicate behavior", async () => {
    const created = await api(env, "POST", "/api/admin/users", { email: "New@X.com", password: "password123", name: "New", role: "admin" }, tokenA);
    expect(created.status).toBe(201);
    expect(created.json.data).toMatchObject({ email: "new@x.com", name: "New", role: "admin" });
    expect(created.json.data).not.toHaveProperty("password_hash");
    const stored = env.__db.tables.users.find((x) => x.email === "new@x.com")!;
    expect(stored.password_hash).toContain("pbkdf2$");
    expect(stored.password_hash).not.toContain("password123");
    // New admin can sign in immediately.
    expect((await api(env, "POST", "/api/auth/login", { email: "new@x.com", password: "password123" })).status).toBe(200);

    const dup = await api(env, "POST", "/api/admin/users", { email: "new@x.com", password: "password123" }, tokenA);
    expect(dup.status).toBe(409);

    expect((await api(env, "POST", "/api/admin/users", { email: "bad", password: "password123" }, tokenA)).status).toBe(400);
    expect((await api(env, "POST", "/api/admin/users", { password: "password123" }, tokenA)).status).toBe(400);
    expect((await api(env, "POST", "/api/admin/users", { email: "ok@x.com", password: "short" }, tokenA)).status).toBe(400);
    expect((await api(env, "POST", "/api/admin/users", { email: "ok@x.com", password: "password123", role: "superuser" }, tokenA)).status).toBe(400);
    // Unknown fields are ignored, never stored.
    const extra = await api(env, "POST", "/api/admin/users", { email: "x@x.com", password: "password123", isAdmin: true }, tokenA);
    expect(extra.json.data.role).toBe("student");
  });

  it("updates names and roles with self/last-admin safeguards", async () => {
    const upd = await api(env, "PUT", `/api/admin/users/${userBId}`, { name: "Bee" }, tokenA);
    expect(upd.status).toBe(200);
    expect(upd.json.data.name).toBe("Bee");

    const promote = await api(env, "PUT", `/api/admin/users/${userBId}`, { role: "admin" }, tokenA);
    expect(promote.json.data.role).toBe("admin");

    // Self role change blocked even though another admin now exists.
    expect((await api(env, "PUT", `/api/admin/users/${userAId}`, { role: "student" }, tokenA)).status).toBe(400);
    // B is admin acting on A (not last since B is admin too).
    expect((await api(env, "PUT", `/api/admin/users/${userAId}`, { name: "Ay" }, tokenA)).status).toBe(200);

    expect((await api(env, "PUT", `/api/admin/users/${userBId}`, { role: "superuser" }, tokenA)).status).toBe(400);
    expect((await api(env, "PUT", `/api/admin/users/${userBId}`, { name: 5 }, tokenA)).status).toBe(400);
    expect((await api(env, "PUT", `/api/admin/users/${userBId}`, {}, tokenA)).status).toBe(400);
    expect((await api(env, "PUT", "/api/admin/users/nope", { name: "X" }, tokenA)).status).toBe(404);
  });

  it("blocks demoting the last administrator", async () => {
    // A is the sole admin: self-demotion reports the self error (existing
    // contract); the last-admin guard sits behind it as defense-in-depth.
    expect((await api(env, "PUT", `/api/admin/users/${userAId}`, { role: "student" }, tokenA)).status).toBe(400);
    // With two admins, demoting the other is allowed.
    expect((await api(env, "PUT", `/api/admin/users/${userBId}`, { role: "admin" }, tokenA)).status).toBe(200);
    const tokenB2 = (await api(env, "POST", "/api/auth/login", { email: "b@x.com", password: "password123" })).json.data.token;
    expect((await api(env, "PUT", `/api/admin/users/${userAId}`, { role: "student" }, tokenB2)).status).toBe(200);
    expect(env.__db.tables.users.find((x) => x.email === "a@x.com")!.role).toBe("student");
  });

  it("deletes users with cascade cleanup, guarding self and last admin", async () => {
    // Seed target data: application + session + resume file.
    await api(env, "POST", "/api/applications", { company: "G", job_title: "Dev", application_date: "2026-01-01" }, tokenB);
    env.__db.tables.resumes.push({ id: "r1", user_id: userBId, filename: "cv.pdf", content_type: "application/pdf", size: 10, r2_key: `${userBId}/r1-cv.pdf`, created_at: "" });
    env.__r2.store.set(`${userBId}/r1-cv.pdf`, { body: new Uint8Array([1]), contentType: "application/pdf" });

    // Self-delete blocked; unknown id 404s.
    expect((await api(env, "DELETE", `/api/admin/users/${userAId}`, undefined, tokenA)).status).toBe(400);
    expect((await api(env, "DELETE", "/api/admin/users/nope", undefined, tokenA)).status).toBe(404);

    const del = await api(env, "DELETE", `/api/admin/users/${userBId}`, undefined, tokenA);
    expect(del.status).toBe(200);
    // Cascades: D1 rows gone, R2 file gone, sessions gone.
    expect(env.__db.tables.users.some((u) => u.id === userBId)).toBe(false);
    expect(env.__db.tables.applications.some((a) => a.user_id === userBId)).toBe(false);
    expect(env.__db.tables.sessions.some((s) => s.user_id === userBId)).toBe(false);
    expect(env.__r2.store.has(`${userBId}/r1-cv.pdf`)).toBe(false);

    // Deleting the last remaining admin is blocked.
    expect((await api(env, "DELETE", `/api/admin/users/${userAId}`, undefined, tokenA)).status).toBe(400); // self (checked first)
  });

  it("blocks deleting the last administrator", async () => {
    // A is the sole admin: self-delete reports the self error (existing
    // contract); the last-admin guard sits behind it as defense-in-depth.
    expect((await api(env, "DELETE", `/api/admin/users/${userAId}`, undefined, tokenA)).status).toBe(400);
    // With two admins, deleting the other is allowed.
    await api(env, "POST", "/api/admin/users", { email: "c@x.com", password: "password123", role: "admin" }, tokenA);
    const userC = env.__db.tables.users.find((x) => x.email === "c@x.com")!;
    expect((await api(env, "DELETE", `/api/admin/users/${userC.id}`, undefined, tokenA)).status).toBe(200);
  });
});
