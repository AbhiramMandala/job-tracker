// WebCrypto-compatible password hashing (PBKDF2-SHA256) + session tokens.
// Works in Cloudflare Workers, Node 18+, and browsers.

const ITERATIONS = 100_000;
const KEY_LEN_BITS = 256;

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBuf(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomHex(16);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBuf(salt) as BufferSource, iterations: ITERATIONS },
    key,
    KEY_LEN_BITS,
  );
  return `pbkdf2$${ITERATIONS}$${salt}$${bufToHex(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [, iterStr, salt, hashHex] = stored.split("$");
    const iterations = Number(iterStr);
    if (!iterations || !salt || !hashHex) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
      "deriveBits",
    ]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: hexToBuf(salt) as BufferSource, iterations },
      key,
      KEY_LEN_BITS,
    );
    const computed = bufToHex(bits);
    if (computed.length !== hashHex.length) return false;
    // Constant-time comparison to avoid timing leaks.
    let diff = 0;
    for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hashHex.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${randomHex(12)}`;
}

export function newToken(): string {
  return randomHex(32); // 256-bit session token
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bufToHex(digest);
}
