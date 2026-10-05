import type { Env } from "./types";
import { corsHeaders, fail, json, withCors, log } from "./utils/response";
import { requireAuth, rateLimit } from "./middleware/auth";
import { handleLogin, handleLogout, handleMe, handleRegister } from "./routes/auth";
import {
  createApplication,
  deleteApplication,
  getApplication,
  listApplications,
  updateApplication,
} from "./routes/applications";
import {
  createInterview,
  createNote,
  deleteInterview,
  deleteNote,
  listInterviews,
  listNotes,
  updateInterview,
  updateNote,
} from "./routes/interviews_notes";
import { deleteResume, getResume, listResumes, uploadResume } from "./routes/resumes";
import { handleDashboard } from "./routes/dashboard";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req, env) });
    }

    const respond = (res: Response) => withCors(res, req, env);

    try {
      // Service index (no auth) — the API has no UI; the app lives on Pages.
      if ((path === "/" || path === "/api") && req.method === "GET") {
        return respond(
          json({
            service: "student-job-tracker-api",
            message: "API only — open the frontend instead.",
            frontend: env.FRONTEND_ORIGIN ?? "http://localhost:5173",
            health: "/api/health",
            docs: "GET /api/auth/me, /api/applications, /api/dashboard, ... (Bearer token required)",
          }),
        );
      }

      // Health check (no auth)
      if (path === "/api/health" && req.method === "GET") return respond(json({ ok: true, time: new Date().toISOString() }));

      // Auth (rate-limited)
      if (path === "/api/auth/register" && req.method === "POST") {
        if (!(await rateLimit(req, env, "auth", 20, 300))) return respond(fail("RATE_LIMITED", "Too many requests", 429));
        return respond(await handleRegister(req, env));
      }
      if (path === "/api/auth/login" && req.method === "POST") {
        if (!(await rateLimit(req, env, "auth", 20, 300))) return respond(fail("RATE_LIMITED", "Too many requests", 429));
        return respond(await handleLogin(req, env));
      }
      if (path === "/api/auth/logout" && req.method === "POST") return respond(await handleLogout(req, env));
      if (path === "/api/auth/me" && req.method === "GET") return respond(await handleMe(req, env));

      // Everything below requires auth.
      const auth = await requireAuth(req, env);
      if ("response" in auth) return respond(auth.response);
      const user = auth.user;

      if (path === "/api/dashboard" && req.method === "GET") return respond(await handleDashboard(req, env, user));

      if (path === "/api/applications" && req.method === "GET") return respond(await listApplications(req, env, user));
      if (path === "/api/applications" && req.method === "POST") return respond(await createApplication(req, env, user));

      const appMatch = path.match(/^\/api\/applications\/([^/]+)$/);
      if (appMatch) {
        const id = decodeURIComponent(appMatch[1]!);
        if (req.method === "GET") return respond(await getApplication(req, env, user, id));
        if (req.method === "PUT") return respond(await updateApplication(req, env, user, id));
        if (req.method === "DELETE") return respond(await deleteApplication(req, env, user, id));
      }

      if (path === "/api/interviews" && req.method === "GET") return respond(await listInterviews(req, env, user));
      if (path === "/api/interviews" && req.method === "POST") return respond(await createInterview(req, env, user));
      const intMatch = path.match(/^\/api\/interviews\/([^/]+)$/);
      if (intMatch) {
        const id = decodeURIComponent(intMatch[1]!);
        if (req.method === "PUT") return respond(await updateInterview(req, env, user, id));
        if (req.method === "DELETE") return respond(await deleteInterview(req, env, user, id));
      }

      if (path === "/api/notes" && req.method === "GET") return respond(await listNotes(req, env, user));
      if (path === "/api/notes" && req.method === "POST") return respond(await createNote(req, env, user));
      const noteMatch = path.match(/^\/api\/notes\/([^/]+)$/);
      if (noteMatch) {
        const id = decodeURIComponent(noteMatch[1]!);
        if (req.method === "PUT") return respond(await updateNote(req, env, user, id));
        if (req.method === "DELETE") return respond(await deleteNote(req, env, user, id));
      }

      if (path === "/api/resumes" && req.method === "GET") return respond(await listResumes(req, env, user));
      if (path === "/api/resumes" && req.method === "POST") return respond(await uploadResume(req, env, user));
      const dlMatch = path.match(/^\/api\/resumes\/([^/]+)\/download$/);
      if (dlMatch && req.method === "GET")
        return respond(await getResume(req, env, user, decodeURIComponent(dlMatch[1]!), true));
      const resMatch = path.match(/^\/api\/resumes\/([^/]+)$/);
      if (resMatch) {
        const id = decodeURIComponent(resMatch[1]!);
        if (req.method === "GET") return respond(await getResume(req, env, user, id, false));
        if (req.method === "DELETE") return respond(await deleteResume(req, env, user, id));
      }

      return respond(fail("NOT_FOUND", "Route not found", 404));
    } catch (err) {
      // Never leak stack traces / DB details to clients; log server-side for Workers Logs.
      log(req, env, "unhandled error:", err instanceof Error ? err.stack ?? err.message : String(err));
      return respond(fail("INTERNAL_ERROR", "Something went wrong", 500));
    }
  },
};

