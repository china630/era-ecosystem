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
import type { SubscriptionModulesSnapshot } from "@era/satellite-kit";
import { orchFetch } from "./orch-api";
import { useAuth } from "./auth-context";

export type SubscriptionSnapshot = SubscriptionModulesSnapshot & {
  tier?: string;
  readOnly?: boolean;
};

type SubscriptionContextValue = {
  loading: boolean;
  snapshot: SubscriptionSnapshot | null;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(
  null,
);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot | null>(null);

  const refresh = useCallback(async () => {
    if (!token || !user?.organizationId) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    try {
      const res = await orchFetch("/v1/subscription/me", { token });
      if (!res.ok) {
        setSnapshot(null);
        return;
      }
      const data = (await res.json()) as SubscriptionSnapshot;
      setSnapshot(data);
    } finally {
      setLoading(false);
    }
  }, [token, user?.organizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ loading, snapshot, refresh }),
    [loading, snapshot, refresh],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription requires SubscriptionProvider");
  return ctx;
}
