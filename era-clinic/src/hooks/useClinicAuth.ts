"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClinicPresetCode } from "@/domain/presets/clinic-presets";

export const CLINIC_AUTH_REFRESH_EVENT = "clinic-auth-refresh";

export type ClinicAuthState = {
  displayName: string;
  email?: string | null;
  organizationName?: string | null;
  role?: string;
  permissions: string[];
  canViewClinicAdmin: boolean;
  isPlatformSuperAdmin: boolean;
  enabledPresets: ClinicPresetCode[];
  checkInMode?: "QR" | "CODE" | "MANUAL";
  checkInRequiresQr: boolean;
};

type AuthMePayload = {
  fullName?: string | null;
  login?: string | null;
  email?: string | null;
  role?: string;
  permissions?: string[];
  organizationName?: string | null;
  canViewClinicAdmin?: boolean;
  isPlatformSuperAdmin?: boolean;
  enabledPresets?: ClinicPresetCode[];
  checkInMode?: "QR" | "CODE" | "MANUAL";
  checkInRequiresQr?: boolean;
  data?: AuthMePayload;
};

function stateFromMe(raw: AuthMePayload): ClinicAuthState | null {
  const data = raw.data ?? raw;
  const displayName =
    data.fullName?.trim() || data.login?.trim() || data.email?.trim() || "";
  if (!displayName) return null;
  return {
    displayName,
    email: data.email ?? null,
    organizationName: data.organizationName ?? null,
    role: data.role,
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    canViewClinicAdmin: data.canViewClinicAdmin === true,
    isPlatformSuperAdmin: data.isPlatformSuperAdmin === true,
    enabledPresets: Array.isArray(data.enabledPresets)
      ? data.enabledPresets
      : ["outpatient"],
    checkInMode:
      data.checkInMode ??
      ((data.checkInRequiresQr === false ? "MANUAL" : "QR") as
        | "QR"
        | "CODE"
        | "MANUAL"),
    checkInRequiresQr:
      (data.checkInMode ??
        (data.checkInRequiresQr === false ? "MANUAL" : "QR")) === "QR",
  };
}

export function useClinicAuth(): {
  auth: ClinicAuthState | null;
  loading: boolean;
} {
  const [auth, setAuth] = useState<ClinicAuthState | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;
      const raw = (await res.json()) as AuthMePayload;
      const next = stateFromMe(raw);
      if (next) setAuth(next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadAuth().finally(() => {
      if (!cancelled) setLoading(false);
    });
    const onRefresh = () => {
      void loadAuth();
    };
    window.addEventListener(CLINIC_AUTH_REFRESH_EVENT, onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener(CLINIC_AUTH_REFRESH_EVENT, onRefresh);
    };
  }, [loadAuth]);

  return { auth, loading };
}
