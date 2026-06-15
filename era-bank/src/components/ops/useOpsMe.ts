"use client";

import { useEffect, useState } from "react";

export type OpsMe = {
  id: string;
  login: string;
  fullName: string;
  role: string;
  branchId: string;
  canApprove: boolean;
  limitsJson: Record<string, unknown>;
};

export function useOpsMe() {
  const [me, setMe] = useState<OpsMe | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d as OpsMe | null))
      .catch(() => setMe(null));
  }, []);

  return me;
}
