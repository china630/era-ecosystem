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
import { ORCH_TOKEN_KEY, orchFetch } from "./orch-api";

export type OrchUser = {
  id: string;
  email: string;
  organizationId: string | null;
  role?: string | null;
  isSuperAdmin?: boolean;
};

export type MembershipRow = {
  organizationId: string;
  organizationName: string | null;
  role: string;
  isOwner: boolean;
};

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  user: OrchUser | null;
  memberships: MembershipRow[];
  login: (accessToken: string, user: OrchUser) => void;
  logout: () => void;
  switchOrganization: (organizationId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<OrchUser | null>(null);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);

  const loadMemberships = useCallback(async (accessToken: string) => {
    const res = await orchFetch("/memberships", { token: accessToken });
    if (!res.ok) return [];
    return (await res.json()) as MembershipRow[];
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(ORCH_TOKEN_KEY);
    if (!stored) {
      setReady(true);
      return;
    }
    (async () => {
      try {
        const payload = JSON.parse(
          atob(stored.split(".")[1] ?? ""),
        ) as {
          sub?: string;
          email?: string;
          organizationId?: string | null;
          role?: string | null;
          isSuperAdmin?: boolean;
        };
        setToken(stored);
        setUser({
          id: payload.sub ?? "",
          email: payload.email ?? "",
          organizationId: payload.organizationId ?? null,
          role: payload.role ?? null,
          isSuperAdmin: payload.isSuperAdmin ?? false,
        });
        const rows = await loadMemberships(stored);
        setMemberships(rows);
      } catch {
        localStorage.removeItem(ORCH_TOKEN_KEY);
      } finally {
        setReady(true);
      }
    })();
  }, [loadMemberships]);

  const login = useCallback(
    (accessToken: string, nextUser: OrchUser) => {
      localStorage.setItem(ORCH_TOKEN_KEY, accessToken);
      setToken(accessToken);
      setUser(nextUser);
      void loadMemberships(accessToken).then(setMemberships);
    },
    [loadMemberships],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(ORCH_TOKEN_KEY);
    setToken(null);
    setUser(null);
    setMemberships([]);
  }, []);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      if (!token) return;
      const res = await orchFetch("/auth/switch-organization", {
        method: "POST",
        token,
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error("Switch organization failed");
      const data = (await res.json()) as {
        accessToken: string;
        claims: {
          sub: string;
          email: string;
          organizationId: string;
          role: string;
          isSuperAdmin?: boolean;
        };
      };
      const nextUser: OrchUser = {
        id: data.claims.sub,
        email: data.claims.email,
        organizationId: data.claims.organizationId,
        role: data.claims.role,
        isSuperAdmin: data.claims.isSuperAdmin,
      };
      login(data.accessToken, nextUser);
    },
    [token, login],
  );

  const value = useMemo(
    () => ({
      ready,
      token,
      user,
      memberships,
      login,
      logout,
      switchOrganization,
    }),
    [ready, token, user, memberships, login, logout, switchOrganization],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requires AuthProvider");
  return ctx;
}
