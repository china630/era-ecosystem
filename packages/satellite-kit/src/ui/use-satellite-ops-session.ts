"use client";

import { useEffect, useState } from "react";

export type SatelliteOpsSession = {
  displayName: string;
  organizationName?: string | null;
  email?: string | null;
};

type AuthMePayload = {
  fullName?: string | null;
  login?: string | null;
  email?: string | null;
  organizationName?: string | null;
};

/**
 * Optional `/api/auth/me` for ops shell header (profile label + org name).
 * Fails silently when the route is absent (minimal satellite auth).
 */
export function useSatelliteOpsSession(): {
  session: SatelliteOpsSession | null;
  loading: boolean;
} {
  const [session, setSession] = useState<SatelliteOpsSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me")
      .then(async (res) => (res.ok ? ((await res.json()) as AuthMePayload) : null))
      .then((data) => {
        if (cancelled || !data) return;
        const displayName =
          data.fullName?.trim() || data.login?.trim() || data.email?.trim() || "";
        if (!displayName) return;
        setSession({
          displayName,
          organizationName: data.organizationName ?? null,
          email: data.email ?? null,
        });
      })
      .catch(() => {
        /* no /api/auth/me — keep null */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { session, loading };
}
