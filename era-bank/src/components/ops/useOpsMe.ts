"use client";

import { useEffect, useState } from "react";
import type { Permission } from "@/lib/auth/permissions";
import {
  sessionHasBankPermission,
  type BankPermissionSession,
} from "@/lib/auth/permission-check";

export type OpsMe = {
  id: string;
  login: string;
  fullName: string;
  role: string;
  branchId: string;
  permissions: Permission[];
  canApprove: boolean;
  limitsJson: Record<string, unknown>;
  isPlatformSuperAdmin?: boolean;
  isOwner?: boolean;
};

export function useOpsMe() {
  const [me, setMe] = useState<OpsMe | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) {
          setMe(null);
          return;
        }
        setMe({
          ...(d as OpsMe),
          permissions: Array.isArray(d.permissions) ? d.permissions : [],
        });
      })
      .catch(() => setMe(null));
  }, []);

  return me;
}

export function opsMeToSession(me: OpsMe | null): BankPermissionSession | null {
  if (!me) return null;
  return {
    login: me.login,
    role: me.role,
    permissions: me.permissions,
    isOwner: me.isOwner === true || me.role === "BUSINESS_OWNER",
  };
}

export function meCan(me: OpsMe | null, permission: Permission): boolean {
  const session = opsMeToSession(me);
  if (!session) return false;
  return sessionHasBankPermission(session, permission);
}
