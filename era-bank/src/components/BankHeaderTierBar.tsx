"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { HeaderTierUsageBar, type HeaderTierQuota } from "@era/satellite-kit/ui";

type BillingSnapshot = {
  tier?: string;
  quotas?: {
    activeBranches?: { current?: number; max?: number | null };
    employees?: { current?: number; max?: number | null };
  };
};

export function BankHeaderTierBar() {
  const t = useTranslations("header");
  const [snapshot, setSnapshot] = useState<BillingSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/platform/billing-snapshot")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as BillingSnapshot;
      })
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!snapshot?.tier) return null;

  const quotas: HeaderTierQuota[] = [
    {
      key: "branches",
      label: t("branchesQuota"),
      current: snapshot.quotas?.activeBranches?.current ?? 0,
      max: snapshot.quotas?.activeBranches?.max ?? null,
    },
    {
      key: "employees",
      label: t("staffQuota"),
      current: snapshot.quotas?.employees?.current ?? 0,
      max: snapshot.quotas?.employees?.max ?? null,
    },
  ];

  return (
    <HeaderTierUsageBar tier={String(snapshot.tier).toUpperCase()} quotas={quotas} />
  );
}
