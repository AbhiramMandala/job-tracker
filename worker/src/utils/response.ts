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

export interface CorsEnv {
  FRONTEND_ORIGIN?: string;
}

// Local-dev defaults so `wrangler dev` works without extra config.
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

export function corsHeaders(req: Request, env: CorsEnv): HeadersInit {
  const requestOrigin = req.headers.get("Origin") ?? "";
  const allowList = [
    ...(env.FRONTEND_ORIGIN ? [env.FRONTEND_ORIGIN] : []),
    ...DEV_ORIGINS,
  ];
  // Echo the request origin only when allow-listed; otherwise fall back to
  // the primary frontend origin (or "*" when nothing is configured).
  const allowed = allowList.includes(requestOrigin)
    ? requestOrigin
    : (env.FRONTEND_ORIGIN ?? allowList[0] ?? "*");
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Vary": "Origin",
  };
}

export function withCors(res: Response, req: Request, env: CorsEnv): Response {
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

