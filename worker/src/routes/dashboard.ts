import type { AuthUser, Env } from "../types";
import { json } from "../utils/response";

interface DashboardData {
  totals: { total: number; applied: number; interviewing: number; offers: number; rejected: number; saved: number };
  byStatus: { status: string; count: number }[];
  upcomingInterviews: unknown[];
  recentApplications: unknown[];
  overdueFollowUps: unknown[];
  upcomingFollowUps: unknown[];
}

export async function handleDashboard(req: Request, env: Env, user: AuthUser): Promise<Response> {
  const cacheKey = `dashboard:${user.id}`;
  // Serve cached stats for 60s to demonstrate KV caching. D1 remains source of truth.
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey, "json");
      if (cached) return json({ ...(cached as object), cached: true });
    } catch {
      /* ignore cache errors */
    }
  }

  const counts = await env.DB.prepare(
    `SELECT status, COUNT(*) as count FROM applications WHERE user_id = ? GROUP BY status`,
  )
    .bind(user.id)
    .all<{ status: string; count: number }>();

  const byStatus = counts.results ?? [];
  const get = (s: string) => Number(byStatus.find((r) => r.status === s)?.count ?? 0);
  const total = byStatus.reduce((a, r) => a + Number(r.count), 0);

  const upcomingInterviews = await env.DB.prepare(
    `SELECT i.*, a.company, a.job_title FROM interviews i
     JOIN applications a ON a.id = i.application_id
     WHERE i.user_id = ? AND i.scheduled_at >= ? ORDER BY i.scheduled_at ASC LIMIT 5`,
  )
    .bind(user.id, new Date().toISOString())
    .all();

  const recentApplications = await env.DB.prepare(
    `SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
  )
    .bind(user.id)
    .all();

  const today = new Date().toISOString().slice(0, 10);
  const overdueFollowUps = await env.DB.prepare(
    `SELECT id, company, job_title, follow_up_date, follow_up_notes FROM applications
     WHERE user_id = ? AND follow_up_reminder = 1 AND follow_up_date IS NOT NULL AND follow_up_date != '' AND substr(follow_up_date, 1, 10) < ? 
     AND status NOT IN ('REJECTED','WITHDRAWN','OFFER') ORDER BY follow_up_date ASC LIMIT 10`,
  )
    .bind(user.id, today)
    .all();

  const upcomingFollowUps = await env.DB.prepare(
    `SELECT id, company, job_title, follow_up_date, follow_up_notes FROM applications
     WHERE user_id = ? AND follow_up_reminder = 1 AND follow_up_date IS NOT NULL AND follow_up_date != '' AND substr(follow_up_date, 1, 10) >= ?
     AND status NOT IN ('REJECTED','WITHDRAWN','OFFER') ORDER BY follow_up_date ASC LIMIT 10`,
  )
    .bind(user.id, today)
    .all();

  const data: DashboardData & { cached: boolean } = {
    totals: {
      total,
      applied: get("APPLIED"),
      interviewing: get("INTERVIEW") + get("OA"),
      offers: get("OFFER"),
      rejected: get("REJECTED"),
      saved: get("SAVED"),
    },
    byStatus,
    upcomingInterviews: upcomingInterviews.results ?? [],
    recentApplications: (recentApplications.results ?? []).map((r: any) => ({
      ...r,
      follow_up_reminder: Number(r.follow_up_reminder ?? 0),
    })),
    overdueFollowUps: overdueFollowUps.results ?? [],
    upcomingFollowUps: upcomingFollowUps.results ?? [],
    cached: false,
  };

  if (env.CACHE) {
    try {
      await env.CACHE.put(cacheKey, JSON.stringify({ ...data, cached: undefined }), { expirationTtl: 60 });
    } catch {
      /* ignore */
    }
  }
  return json(data);
}


