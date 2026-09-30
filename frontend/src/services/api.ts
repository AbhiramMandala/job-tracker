const API_BASE = import.meta.env.VITE_API_URL ?? "";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("sjt_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    const msg = body?.error?.message ?? `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { code?: string; details?: unknown; status?: number };
    err.code = body?.error?.code;
    err.details = body?.error?.details;
    err.status = res.status;
    throw err;
  }
  return body.data as T;
}

export const api = {
  get<T>(path: string): Promise<T> {
    return fetch(`${API_BASE}${path}`, { credentials: "include", headers: authHeaders() }).then(handle<T>);
  },
  post<T>(path: string, data?: unknown): Promise<T> {
    return fetch(`${API_BASE}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }).then(handle<T>);
  },
  put<T>(path: string, data: unknown): Promise<T> {
    return fetch(`${API_BASE}${path}`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    }).then(handle<T>);
  },
  del<T>(path: string): Promise<T> {
    return fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      credentials: "include",
      headers: authHeaders(),
    }).then(handle<T>);
  },
  upload<T>(path: string, form: FormData): Promise<T> {
    return fetch(`${API_BASE}${path}`, {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
      body: form,
    }).then(handle<T>);
  },
  download(path: string): string {
    // Token must travel via query for plain <a> downloads is insecure; we fetch as blob instead in pages.
    return `${API_BASE}${path}`;
  },
};

export async function downloadResume(id: string, filename: string): Promise<void> {
  const token = localStorage.getItem("sjt_token");
  const res = await fetch(`${API_BASE}/api/resumes/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
