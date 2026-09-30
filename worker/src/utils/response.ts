import type { ApiErrorBody } from "../types";

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
  headers: HeadersInit = {},
): Response {
  const body: ApiErrorBody = { success: false, error: { code, message, details } };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export function corsHeaders(req: Request, env: { FRONTEND_ORIGIN?: string }): HeadersInit {
  const origin = req.headers.get("Origin") ?? env.FRONTEND_ORIGIN ?? "*";
  const allowed = env.FRONTEND_ORIGIN ? env.FRONTEND_ORIGIN : origin;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Vary": "Origin",
  };
}

export function withCors(res: Response, req: Request, env: { FRONTEND_ORIGIN?: string }): Response {
  const h = new Headers(res.headers);
  const cors = corsHeaders(req, env);
  for (const [k, v] of Object.entries(cors)) h.set(k, v as string);
  return new Response(res.body, { status: res.status, headers: h });
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export function log(req: Request, env: unknown, ...args: unknown[]): void {
  // Visible via `wrangler tail` (Workers Logs).
  console.log(`[${req.method} ${new URL(req.url).pathname}]`, ...args);
}

