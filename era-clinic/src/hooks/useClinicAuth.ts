"use client";

import { useEffect, useState } from "react";
import type { ClinicPresetCode } from "@/domain/presets/clinic-presets";

export type ClinicAuthState = {
  displayName: string;
  email?: string | null;
  organizationName?: string | null;
  role?: string;
  canViewClinicAdmin: boolean;
  isPlatformSuperAdmin: boolean;
  enabledPresets: ClinicPresetCode[];
};

type AuthMePayload = {
  fullName?: string | null;
  login?: string | null;
  email?: string | null;
  role?: string;
  organizationName?: string | null;
  canViewClinicAdmin?: boolean;
  isPlatformSuperAdmin?: boolean;
  enabledPresets?: ClinicPresetCode[];
};

export function useClinicAuth(): {
  auth: ClinicAuthState | null;
  loading: boolean;
} {
  const [auth, setAuth] = useState<ClinicAuthState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me")
      .then(async (res) => (res.ok ? ((await res.json()) as AuthMePayload) : null))
      .then((data) => {
        if (cancelled || !data) return;
        const displayName =
          data.fullName?.trim() ||
          data.login?.trim() ||
          data.email?.trim() ||
          "";
        if (!displayName) return;
        setAuth({
          displayName,
          email: data.email ?? null,
          organizationName: data.organizationName ?? null,
          role: data.role,
          canViewClinicAdmin: data.canViewClinicAdmin === true,
          isPlatformSuperAdmin: data.isPlatformSuperAdmin === true,
          enabledPresets: Array.isArray(data.enabledPresets)
            ? data.enabledPresets
            : ["outpatient"],
        });
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { auth, loading };
}
