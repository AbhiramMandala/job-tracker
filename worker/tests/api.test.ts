import { describe, expect, it, beforeEach } from "vitest";
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
      const [id, email, password_hash, name, created_at, updated_at] = params as any[];
      if (T.users.some((u) => u.email === email)) throw new Error("UNIQUE constraint failed: users.email");
      T.users.push({ id, email, password_hash, name, created_at, updated_at });
      return [];
    }
    if (q.startsWith("INSERT INTO sessions")) {
      const [id, user_id, token_hash, expires_at, created_at] = params as any[];
      T.sessions.push({ id, user_id, token_hash, expires_at, created_at });
      return [];
    }
    if (q.startsWith("INSERT INTO applications")) {
      const [id, user_id, company, job_title, location, job_url, job_type, salary, application_date, status, notes, contact_person, contact_email, follow_up_date, follow_up_reminder, follow_up_notes, resume_id, jobsetu_job_id, created_at, updated_at] = params as any[];
      T.applications.push({ id, user_id, company, job_title, location, job_url, job_type, salary, application_date, status, notes, contact_person, contact_email, follow_up_date, follow_up_reminder, follow_up_notes, resume_id, jobsetu_job_id, created_at, updated_at });
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
      return [{ id: u.id, email: u.email, name: u.name, created_at: u.created_at, expires_at: s.expires_at }] as unknown as T[];
    }
    if (q.startsWith("DELETE FROM sessions WHERE token_hash")) {
      T.sessions = T.sessions.filter((x) => x.token_hash !== params[0]);
      return [];
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
    const dash = await api(env, "GET", "/api/dashboard", undefined, tokenA);
    expect(dash.status).toBe(200);
    expect(dash.json.data.totals.total).toBe(1);
    expect(dash.json.data.overdueFollowUps).toHaveLength(1);
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
