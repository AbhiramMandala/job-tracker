export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("Cookie") ?? "";
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function sessionCookie(token: string, maxAgeSec: number, secure: boolean): string {
  const parts = [
    `session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  const parts = ["session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function bearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  return parseCookies(req)["session"] ?? null;
}
