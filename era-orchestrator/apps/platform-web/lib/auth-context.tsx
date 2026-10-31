"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ORCH_TOKEN_KEY,
  accessTokenExpiresAtMs,
  clearOrchTokens,
  getOrchAccessToken,
  isAccessTokenUsable,
  notifyOrchSessionExpired,
  orchFetch,
  refreshOrchAccessToken,
  setOrchTokens,
  subscribeOrchSession,
} from "./orch-api";

export type OrchUser = {
  id: string;
  email: string;
  organizationId: string | null;
  role?: string | null;
  isSuperAdmin?: boolean;
};

type JwtClaims = {
  sub?: string;
  email?: string;
  organizationId?: string | null;
  role?: string | null;
  isSuperAdmin?: boolean;
};

function userFromToken(accessToken: string): OrchUser {
  const payload = JSON.parse(atob(accessToken.split(".")[1] ?? "")) as JwtClaims;
  return {
    id: payload.sub ?? "",
    email: payload.email ?? "",
    organizationId: payload.organizationId ?? null,
    role: payload.role ?? null,
    isSuperAdmin: payload.isSuperAdmin ?? false,
  };
}

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  user: OrchUser | null;
  login: (accessToken: string, user: OrchUser, refreshToken?: string | null) => void;
  logout: () => void;
};

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  window.location.replace("/login?reason=expired");
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<OrchUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const stored = localStorage.getItem(ORCH_TOKEN_KEY);
      if (!stored) {
        const refreshed = await refreshOrchAccessToken();
        if (cancelled) return;
        if (!refreshed) {
          setReady(true);
          return;
        }
        try {
          const next = userFromToken(refreshed);
          if (!next.isSuperAdmin) {
            clearOrchTokens();
            setReady(true);
            return;
          }
          setToken(refreshed);
          setUser(next);
          setReady(true);
        } catch {
          clearOrchTokens();
          setReady(true);
        }
        return;
      }
      let access = stored;
      if (!isAccessTokenUsable(stored, 30_000)) {
        const refreshed = await refreshOrchAccessToken();
        if (cancelled) return;
        if (!refreshed) {
          clearOrchTokens();
          setReady(true);
          redirectToLogin();
          return;
        }
        access = refreshed;
      }
      try {
        const next = userFromToken(access);
        if (!next.isSuperAdmin) {
          clearOrchTokens();
          setReady(true);
          return;
        }
        setToken(access);
        setUser(next);
        setReady(true);
      } catch {
        clearOrchTokens();
        setReady(true);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    (accessToken: string, nextUser: OrchUser, refreshToken?: string | null) => {
      setOrchTokens(accessToken, refreshToken);
      setToken(accessToken);
      setUser({ ...nextUser, isSuperAdmin: true });
    },
    [],
  );

  const logout = useCallback(() => {
    clearOrchTokens();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    return subscribeOrchSession({
      onExpired: () => {
        setToken(null);
        setUser(null);
        redirectToLogin();
      },
      onRefreshed: (accessToken) => {
        setToken(accessToken);
        try {
          const next = userFromToken(accessToken);
          if (!next.isSuperAdmin) {
            clearOrchTokens();
            setToken(null);
            setUser(null);
            redirectToLogin();
            return;
          }
          setUser(next);
        } catch {
          /* keep previous user */
        }
      },
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    const exp = accessTokenExpiresAtMs(token);
    if (exp == null) return;
    const delay = Math.max(5_000, exp - Date.now() - 90_000);
    const id = window.setTimeout(() => {
      void refreshOrchAccessToken().then((fresh) => {
        if (fresh) return;
        const current = getOrchAccessToken();
        if (current && isAccessTokenUsable(current, 0)) return;
        notifyOrchSessionExpired();
      });
    }, delay);
    return () => window.clearTimeout(id);
  }, [token]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ORCH_TOKEN_KEY) return;
      if (e.newValue == null) {
        setToken(null);
        setUser(null);
        redirectToLogin();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({ ready, token, user, login, logout }),
    [ready, token, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requires AuthProvider");
  return ctx;
}
