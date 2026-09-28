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
import { isBarePublicWebPath } from "./public-routes";

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

function redirectToLoginIfAppShell(): void {
  if (typeof window === "undefined") return;
  const pathname = window.location.pathname;
  if (isBarePublicWebPath(pathname)) return;
  window.location.replace("/login?reason=expired");
}

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
          setToken(refreshed);
          setUser(userFromToken(refreshed));
          setReady(true);
          void loadMemberships(refreshed)
            .then(setMemberships)
            .catch(() => undefined);
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
          redirectToLoginIfAppShell();
          return;
        }
        access = refreshed;
      }
      try {
        setToken(access);
        setUser(userFromToken(access));
        setReady(true);
        void loadMemberships(access)
          .then(setMemberships)
          .catch(() => undefined);
      } catch {
        clearOrchTokens();
        setReady(true);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    return subscribeOrchSession({
      onExpired: () => {
        setToken(null);
        setUser(null);
        setMemberships([]);
        redirectToLoginIfAppShell();
      },
      onRefreshed: (accessToken) => {
        setToken(accessToken);
        try {
          setUser(userFromToken(accessToken));
        } catch {
          /* keep previous user until next call */
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
        setMemberships([]);
        redirectToLoginIfAppShell();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
