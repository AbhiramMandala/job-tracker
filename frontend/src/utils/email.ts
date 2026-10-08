/** Client-side email checks mirroring the Worker's validation semantics
 *  (worker/src/validation/schemas.ts). The backend re-validates everything —
 *  this only improves responsiveness. Never rely on it for security. */

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

/** Empty → "Email is required.", malformed → "Please enter a valid email
 *  address.", valid → null. Matches the backend register messages exactly. */
export function emailError(raw: string): string | null {
  if (!raw.trim()) return "Email is required.";
  if (!isValidEmail(raw)) return "Please enter a valid email address.";
  return null;
}
