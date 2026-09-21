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
  clearOrchTokens,
  orchFetch,
  setOrchTokens,
} from "./orch-api";

export type OrchUser = {
  id: string;
  email: string;
  organizationId: string | null;
  role?: string | null;
  isSuperAdmin?: boolean;
  isOwner?: boolean;
  permissions?: string[];
};

export type MembershipRow = {
  organizationId: string;
  organizationName: string | null;
  role: string;
  isOwner: boolean;
};

type JwtClaims = {
  sub?: string;
  email?: string;
  organizationId?: string | null;
  role?: string | null;
  isSuperAdmin?: boolean;
  isOwner?: boolean;
  permissions?: string[];
};

function userFromToken(accessToken: string): OrchUser {
  const payload = JSON.parse(atob(accessToken.split(".")[1] ?? "")) as JwtClaims;
  return {
    id: payload.sub ?? "",
    email: payload.email ?? "",
    organizationId: payload.organizationId ?? null,
    role: payload.role ?? null,
    isSuperAdmin: payload.isSuperAdmin ?? false,
    isOwner: payload.isOwner ?? false,
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
  };
}

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  user: OrchUser | null;
  memberships: MembershipRow[];
  permissions: string[];
  can: (permission: string) => boolean;
  login: (
    accessToken: string,
    user: OrchUser,
    refreshToken?: string | null,
  ) => void;
  logout: () => void;
  switchOrganization: (organizationId: string) => Promise<void>;
  applyAccessToken: (accessToken: string, refreshToken?: string | null) => void;
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
    try {
      setToken(stored);
      setUser(userFromToken(stored));
      setReady(true);
      // Do not clear tokens on memberships failure — transient API/CORS blips
      // were wiping orch SSO state and made satellite launch look "broken".
      void loadMemberships(stored)
        .then(setMemberships)
        .catch(() => undefined);
    } catch {
      clearOrchTokens();
      setReady(true);
    }
  }, [loadMemberships]);

  const login = useCallback(
    (
      accessToken: string,
      nextUser: OrchUser,
      refreshToken?: string | null,
    ) => {
      setOrchTokens(accessToken, refreshToken);
      setToken(accessToken);
      const fromJwt = userFromToken(accessToken);
      setUser({
        ...nextUser,
        isOwner: fromJwt.isOwner ?? nextUser.isOwner,
        permissions: fromJwt.permissions ?? nextUser.permissions ?? [],
      });
      void loadMemberships(accessToken).then(setMemberships);
    },
    [loadMemberships],
  );

  const applyAccessToken = useCallback(
    (accessToken: string, refreshToken?: string | null) => {
      setOrchTokens(accessToken, refreshToken);
      setToken(accessToken);
      setUser(userFromToken(accessToken));
    },
    [],
  );

  const logout = useCallback(() => {
    clearOrchTokens();
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
        refreshToken?: string;
        claims: {
          sub: string;
          email: string;
          organizationId: string;
          role: string;
          isSuperAdmin?: boolean;
          isOwner?: boolean;
          permissions?: string[];
        };
      };
      const nextUser: OrchUser = {
        id: data.claims.sub,
        email: data.claims.email,
        organizationId: data.claims.organizationId,
        role: data.claims.role,
        isSuperAdmin: data.claims.isSuperAdmin,
        isOwner: data.claims.isOwner,
        permissions: data.claims.permissions ?? [],
      };
      login(data.accessToken, nextUser, data.refreshToken);
    },
    [token, login],
  );

  const permissions = user?.permissions ?? [];

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.isSuperAdmin || user.isOwner) return true;
      return permissions.includes(permission);
    },
    [user, permissions],
  );

  const value = useMemo(
    () => ({
      ready,
      token,
      user,
      memberships,
      permissions,
      can,
      login,
      logout,
      switchOrganization,
      applyAccessToken,
    }),
    [
      ready,
      token,
      user,
      memberships,
      permissions,
      can,
      login,
      logout,
      switchOrganization,
      applyAccessToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requires AuthProvider");
  return ctx;
}
