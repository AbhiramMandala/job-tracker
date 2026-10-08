import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../services/api";
import type { User } from "../types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  /** Non-auth bootstrap failure (network/5xx). Token is kept for retry. */
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem("sjt_token")) {
      setUser(null);
      setLoading(false);
      return;
    }
    // Loading covers both initial bootstrap and manual retry: clearing the
    // error must not expose the logged-out branch while /me is in flight,
    // or the router would bounce to Sign in before the retry resolves.
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ user: User }>("/api/auth/me");
      setUser(data.user);
    } catch (e) {
      // Only an explicit 401 means "not authenticated". Transient failures
      // (network error, 5xx) must NOT wipe the stored session — otherwise a
      // single failed bootstrap request silently signs the user out.
      const err = e as { status?: number; code?: string };
      if (err?.status === 401 || err?.code === "UNAUTHORIZED") {
        localStorage.removeItem("sjt_token");
        setUser(null);
      } else {
        setUser(null);
        setError(e instanceof Error ? e.message : "Failed to restore session");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ user: User; token: string }>("/api/auth/login", { email, password });
    localStorage.setItem("sjt_token", data.token);
    setError(null);
    setUser(data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const data = await api.post<{ user: User; token: string }>("/api/auth/register", { email, password, name });
    localStorage.setItem("sjt_token", data.token);
    setError(null);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      /* ignore */
    }
    localStorage.removeItem("sjt_token");
    setUser(null);
    setError(null);
  };

  return <Ctx.Provider value={{ user, loading, error, login, register, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
