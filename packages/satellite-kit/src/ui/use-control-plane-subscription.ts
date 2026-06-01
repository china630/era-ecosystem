"use client";

import { useCallback, useEffect, useState } from "react";
import { getSubscriptionMe } from "../integration/control-plane-platform.client";

export type ControlPlaneQuotaSnapshot = {
  tier?: string;
  readOnly?: boolean;
  isTrial?: boolean;
  expiresAt?: string | null;
  quotas?: {
    invoicesThisMonth?: { current?: number; max?: number | null };
    employees?: { current?: number; max?: number | null };
  };
};

export function useControlPlaneSubscription(accessToken: string | null | undefined) {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<ControlPlaneQuotaSnapshot | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    try {
      const data = await getSubscriptionMe({ bearerToken: accessToken });
      setSnapshot(data as ControlPlaneQuotaSnapshot);
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, snapshot, refresh };
}
