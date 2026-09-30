import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../services/api";
import type { User } from "../types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem("sjt_token")) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ user: User }>("/api/auth/me");
      setUser(data.user);
    } catch {
      localStorage.removeItem("sjt_token");
      setUser(null);
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
    setUser(data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const data = await api.post<{ user: User; token: string }>("/api/auth/register", { email, password, name });
    localStorage.setItem("sjt_token", data.token);
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
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
