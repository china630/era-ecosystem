"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cpAdminFetch } from "../../../lib/cp-admin-fetch";
import type { BillingPayload } from "../../../lib/billing-types";

type BillingContextValue = {
  billing: BillingPayload | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  seedPricing: () => Promise<void>;
};

const BillingContext = createContext<BillingContextValue | null>(null);

function normalize(raw: Partial<BillingPayload>): BillingPayload {
  return {
    prices: raw.prices ?? {},
    quotas: raw.quotas ?? {},
    ocrJobsPerOrgMonth: raw.ocrJobsPerOrgMonth ?? 200,
    foundationMonthlyAzn: raw.foundationMonthlyAzn ?? 29,
    yearlyDiscountPercent: raw.yearlyDiscountPercent ?? 20,
    quotaPricing: raw.quotaPricing ?? {
      employeeBlockSize: 10,
      pricePerEmployeeBlockAzn: 15,
      documentPackSize: 1000,
      pricePerDocumentPackAzn: 5,
    },
    pricingModules: raw.pricingModules ?? [],
    pricingBundles: raw.pricingBundles ?? [],
  };
}

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [billing, setBilling] = useState<BillingPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await cpAdminFetch("config/billing");
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setBilling(null);
        return;
      }
      setBilling(normalize((await res.json()) as Partial<BillingPayload>));
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      setBilling(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const seedPricing = useCallback(async () => {
    const res = await cpAdminFetch("config/billing/seed-pricing", { method: "POST" });
    if (!res.ok) {
      setError(`Seed HTTP ${res.status}`);
      return;
    }
    await reload();
  }, [reload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo(
    () => ({ billing, loading, error, reload, seedPricing }),
    [billing, loading, error, reload, seedPricing],
  );

  return (
    <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
  );
}

export function useBilling() {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error("useBilling requires BillingProvider");
  return ctx;
}
