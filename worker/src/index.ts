import type { Env } from "./types";
import { corsHeaders, fail, json, withCors, log } from "./utils/response";
import { requireAuth, rateLimit } from "./middleware/auth";
import { denyIfNoPermission } from "./authz";
import { handleLogin, handleLogout, handleMe, handleRegister } from "./routes/auth";
import { handleForgotPassword, handleResetPassword } from "./routes/password_reset";
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
import { createUser, deleteUser, getUser, listUsers, setUserRole, updateUser } from "./routes/admin";
import { getJob, listJobs, listSearches, runSearch, saveJob } from "./routes/discover";

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
      if (path === "/api/auth/forgot-password" && req.method === "POST") {
        if (!(await rateLimit(req, env, "pwreset", 5, 600))) return respond(fail("RATE_LIMITED", "Too many requests", 429));
        return respond(await handleForgotPassword(req, env));
      }
      if (path === "/api/auth/reset-password" && req.method === "POST") {
        if (!(await rateLimit(req, env, "pwreset", 5, 600))) return respond(fail("RATE_LIMITED", "Too many requests", 429));
        return respond(await handleResetPassword(req, env));
      }

      // Everything below requires auth.
      const auth = await requireAuth(req, env);
      if ("response" in auth) return respond(auth.response);
      const user = auth.user;
      // Centralized RBAC gate: every protected route declares its permission.
      const need = (perm: Parameters<typeof denyIfNoPermission>[1]): Response | null => {
        const denied = denyIfNoPermission(user, perm);
        return denied ? respond(denied) : null;
      };

      if (path === "/api/dashboard" && req.method === "GET") return respond(await handleDashboard(req, env, user));

      // Discover Jobs (native SerpApi-backed discovery).
      if (path === "/api/discover/search" && req.method === "POST") {
        const d = need("jobs.discover");
        if (d) return d;
        if (!(await rateLimit(req, env, "discover-search", 20, 600))) return respond(fail("RATE_LIMITED", "Too many requests", 429));
        return respond(await runSearch(req, env, user));
      }
      if (path === "/api/discover/searches" && req.method === "GET") {
        const d = need("jobs.discover");
        if (d) return d;
        if (!(await rateLimit(req, env, "discover", 60, 60))) return respond(fail("RATE_LIMITED", "Too many requests", 429));
        return respond(await listSearches(req, env, user));
      }
      if (path === "/api/discover/jobs" && req.method === "GET") {
        const d = need("jobs.discover");
        if (d) return d;
        if (!(await rateLimit(req, env, "discover", 60, 60))) return respond(fail("RATE_LIMITED", "Too many requests", 429));
        return respond(await listJobs(req, env, user));
      }
      const jobMatch = path.match(/^\/api\/discover\/jobs\/([^/]+)\/([^/]+)(\/save)?$/);
      if (jobMatch) {
        const [, searchId, jobId, saveSuffix] = jobMatch as unknown as [string, string, string, string | undefined];
        if (saveSuffix === "/save" && req.method === "POST") {
          const d = need("applications.create");
          if (d) return d;
          return respond(await saveJob(req, env, user, decodeURIComponent(searchId!), decodeURIComponent(jobId!)));
        }
        if (!saveSuffix && req.method === "GET") {
          const d = need("jobs.discover");
          if (d) return d;
          if (!(await rateLimit(req, env, "discover", 60, 60))) return respond(fail("RATE_LIMITED", "Too many requests", 429));
          return respond(await getJob(req, env, user, decodeURIComponent(searchId!), decodeURIComponent(jobId!)));
        }
      }

      if (path === "/api/applications" && req.method === "GET") {
        const d = need("applications.read");
        if (d) return d;
        return respond(await listApplications(req, env, user));
      }
      if (path === "/api/applications" && req.method === "POST") {
        const d = need("applications.create");
        if (d) return d;
        return respond(await createApplication(req, env, user));
      }

      const appMatch = path.match(/^\/api\/applications\/([^/]+)$/);
      if (appMatch) {
        const id = decodeURIComponent(appMatch[1]!);
        if (req.method === "GET") {
          const d = need("applications.read");
          if (d) return d;
          return respond(await getApplication(req, env, user, id));
        }
        if (req.method === "PUT") {
          const d = need("applications.update");
          if (d) return d;
          return respond(await updateApplication(req, env, user, id));
        }
        if (req.method === "DELETE") {
          const d = need("applications.delete");
          if (d) return d;
          return respond(await deleteApplication(req, env, user, id));
        }
      }

      if (path === "/api/interviews" && req.method === "GET") {
        const d = need("interviews.read");
        if (d) return d;
        return respond(await listInterviews(req, env, user));
      }
      if (path === "/api/interviews" && req.method === "POST") {
        const d = need("interviews.create");
        if (d) return d;
        return respond(await createInterview(req, env, user));
      }
      const intMatch = path.match(/^\/api\/interviews\/([^/]+)$/);
      if (intMatch) {
        const id = decodeURIComponent(intMatch[1]!);
        if (req.method === "PUT") {
          const d = need("interviews.update");
          if (d) return d;
          return respond(await updateInterview(req, env, user, id));
        }
        if (req.method === "DELETE") {
          const d = need("interviews.delete");
          if (d) return d;
          return respond(await deleteInterview(req, env, user, id));
        }
      }

      if (path === "/api/notes" && req.method === "GET") {
        const d = need("notes.read");
        if (d) return d;
        return respond(await listNotes(req, env, user));
      }
      if (path === "/api/notes" && req.method === "POST") {
        const d = need("notes.create");
        if (d) return d;
        return respond(await createNote(req, env, user));
      }
      const noteMatch = path.match(/^\/api\/notes\/([^/]+)$/);
      if (noteMatch) {
        const id = decodeURIComponent(noteMatch[1]!);
        if (req.method === "PUT") {
          const d = need("notes.update");
          if (d) return d;
          return respond(await updateNote(req, env, user, id));
        }
        if (req.method === "DELETE") {
          const d = need("notes.delete");
          if (d) return d;
          return respond(await deleteNote(req, env, user, id));
        }
      }

      if (path === "/api/resumes" && req.method === "GET") {
        const d = need("resumes.read");
        if (d) return d;
        return respond(await listResumes(req, env, user));
      }
      if (path === "/api/resumes" && req.method === "POST") {
        const d = need("resumes.create");
        if (d) return d;
        return respond(await uploadResume(req, env, user));
      }
      const dlMatch = path.match(/^\/api\/resumes\/([^/]+)\/download$/);
      if (dlMatch && req.method === "GET") {
        const d = need("resumes.read");
        if (d) return d;
        return respond(await getResume(req, env, user, decodeURIComponent(dlMatch[1]!), true));
      }
      const resMatch = path.match(/^\/api\/resumes\/([^/]+)$/);
      if (resMatch) {
        const id = decodeURIComponent(resMatch[1]!);
        if (req.method === "GET") {
          const d = need("resumes.read");
          if (d) return d;
          return respond(await getResume(req, env, user, id, false));
        }
        if (req.method === "DELETE") {
          const d = need("resumes.delete");
          if (d) return d;
          return respond(await deleteResume(req, env, user, id));
        }
      }

      // Admin (admin role only).
      if (path === "/api/admin/users" && req.method === "GET") {
        const d = need("users.manage");
        if (d) return d;
        return respond(await listUsers(req, env, user));
      }
      if (path === "/api/admin/users" && req.method === "POST") {
        const d = need("users.manage");
        if (d) return d;
        return respond(await createUser(req, env, user));
      }
      const roleMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/role$/);
      if (roleMatch && req.method === "PUT") {
        const d = need("users.manage");
        if (d) return d;
        return respond(await setUserRole(req, env, user, decodeURIComponent(roleMatch[1]!)));
      }
      const adminUserMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
      if (adminUserMatch) {
        const id = decodeURIComponent(adminUserMatch[1]!);
        if (req.method === "GET") {
          const d = need("users.manage");
          if (d) return d;
          return respond(await getUser(req, env, user, id));
        }
        if (req.method === "PUT") {
          const d = need("users.manage");
          if (d) return d;
          return respond(await updateUser(req, env, user, id));
        }
        if (req.method === "DELETE") {
          const d = need("users.manage");
          if (d) return d;
          return respond(await deleteUser(req, env, user, id));
        }
      }

      return respond(fail("NOT_FOUND", "Route not found", 404));
    } catch (err) {
      // Never leak stack traces / DB details to clients; log server-side for Workers Logs.
      log(req, env, "unhandled error:", err instanceof Error ? err.stack ?? err.message : String(err));
      return respond(fail("INTERNAL_ERROR", "Something went wrong", 500));
    }
  },
};
