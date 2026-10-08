/**
 * Native SerpApi provider for Discover Jobs.
 *
 * Server-side only: the API key travels exclusively in Worker→SerpApi
 * requests. It is never returned to clients, never logged, and never
 * leaves this module except as an `api_key` query parameter on the
 * outbound HTTPS call. There is no duplicate SerpApi integration —
 * this is the single place the Tracker talks to SerpApi.
 */

export const SERPAPI_TIMEOUT_MS = 20000;
const SERPAPI_BASE = "https://serpapi.com/search.json";

export type SerpApiFailure =
  | { kind: "missing-key" }
  | { kind: "timeout" }
  | { kind: "rejected"; status: number }
  | { kind: "malformed" }
  | { kind: "network"; message: string };

export interface SerpApiSearchParams {
  role: string;
  location: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Run one Google Jobs search. Returns the raw jobs array on success, or a
 * failure descriptor. Callers map failures to generic 503s — details stay
 * server-side (they can contain account/quota information).
 */
export async function serpApiGoogleJobs(
  apiKey: string | undefined,
  params: SerpApiSearchParams,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; jobs: unknown[] } | { ok: false; failure: SerpApiFailure }> {
  if (!apiKey) return { ok: false, failure: { kind: "missing-key" } };
  const q = new URLSearchParams({
    engine: "google_jobs",
    q: params.role,
    location: params.location,
    gl: "in",
    hl: "en",
    api_key: apiKey,
  });
  let res: Response;
  try {
    res = await fetchImpl(`${SERPAPI_BASE}?${q}`, { signal: AbortSignal.timeout(SERPAPI_TIMEOUT_MS) });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError")
      return { ok: false, failure: { kind: "timeout" } };
    return { ok: false, failure: { kind: "network", message: err instanceof Error ? err.message : "fetch failed" } };
  }
  if (!res.ok) return { ok: false, failure: { kind: "rejected", status: res.status } };
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, failure: { kind: "malformed" } };
  }
  if (!isRecord(body) || !Array.isArray(body.jobs_results))
    return { ok: false, failure: { kind: "malformed" } };
  return { ok: true, jobs: body.jobs_results };
}
