"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type Goal = {
  id: string;
  metric: string;
  targetValue: string | number;
  periodStart: string;
  periodEnd: string;
};

export default function ReportsPage() {
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const [data, setData] = useState<{
    stageCounts?: { toStage: string; _count: { _all: number } }[];
    currentStageCounts?: { stage: string; _count: { _all: number } }[];
    unsorted?: number;
    avgHoursInStage?: {
      stage: string;
      avgHours: number | null;
      sampleSize: number;
    }[];
    avgFirstResponseMinutes?: number | null;
    firstResponseSampleSize?: number;
  } | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [facts, setFacts] = useState<Record<string, { target: number; fact: number }>>({});
  const [error, setError] = useState("");
  const [targetValue, setTargetValue] = useState("10");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [funnelRes, goalsRes] = await Promise.all([
      fetch("/api/reports/funnel"),
      fetch("/api/sales-goals"),
    ]);
    const funnel = await funnelRes.json();
    const goalsJson = await goalsRes.json();
    if (!funnelRes.ok) {
      setError(funnel.error ?? "Failed");
      return;
    }
    setData(funnel);
    if (goalsRes.ok) {
      const items = (goalsJson.items ?? []) as Goal[];
      setGoals(items);
      const next: Record<string, { target: number; fact: number }> = {};
      await Promise.all(
        items.slice(0, 20).map(async (g) => {
          const res = await fetch(`/api/sales-goals/${g.id}/fact`);
          if (!res.ok) return;
          const f = await res.json();
          next[g.id] = { target: f.target, fact: f.fact };
        }),
      );
      setFacts(next);
    }
    setError("");
  }

  useEffect(() => {
    void load();
  }, []);

  async function createGoal() {
    if (!periodStart || !periodEnd) return;
    setBusy(true);
    try {
      const res = await fetch("/api/sales-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          metric: "WON_COUNT",
          targetValue: Number(targetValue),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <section className={CARD_CONTAINER_CLASS}>
        <h2 className="mb-2 font-medium">{t("unsorted")}</h2>
        <p className="text-2xl">{data?.unsorted ?? "—"}</p>
        <Link href="/unsorted" className={`${SECONDARY_BUTTON_CLASS} mt-3 inline-flex`}>
          {t("openUnsorted")}
        </Link>
      </section>
      <section className={CARD_CONTAINER_CLASS}>
        <h2 className="mb-2 font-medium">{t("currentStages")}</h2>
        <ul className="space-y-1 text-sm">
          {(data?.currentStageCounts ?? []).map((row) => (
            <li key={row.stage}>
              {row.stage}: {row._count._all}
            </li>
          ))}
        </ul>
      </section>
      <section className={CARD_CONTAINER_CLASS}>
        <h2 className="mb-2 font-medium">{t("stageCounts")}</h2>
        <ul className="space-y-1 text-sm">
          {(data?.stageCounts ?? []).map((row) => (
            <li key={row.toStage}>
              {row.toStage}: {row._count._all}
            </li>
          ))}
        </ul>
      </section>
      <section className={CARD_CONTAINER_CLASS}>
        <h2 className="mb-2 font-medium">{t("avgHoursTitle")}</h2>
        <p className="mb-2 text-xs text-[#7F8C8D]">{t("avgHoursHint")}</p>
        <ul className="space-y-1 text-sm">
          {(data?.avgHoursInStage ?? []).map((row) => (
            <li key={row.stage}>
              {row.stage}:{" "}
              {row.avgHours == null ? "—" : t("avgHoursValue", { hours: row.avgHours })}{" "}
              <span className="text-xs text-[#7F8C8D]">
                (n={row.sampleSize})
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className={CARD_CONTAINER_CLASS}>
        <h2 className="mb-2 font-medium">{t("firstResponseTitle")}</h2>
        <p className="text-2xl">
          {data?.avgFirstResponseMinutes == null
            ? "—"
            : t("firstResponseValue", {
                minutes: data.avgFirstResponseMinutes,
              })}
        </p>
        <p className="mt-1 text-xs text-[#7F8C8D]">
          {t("firstResponseHint", {
            n: data?.firstResponseSampleSize ?? 0,
          })}
        </p>
      </section>
      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium">{t("goalsTitle")}</h2>
        <p className="text-xs text-[#7F8C8D]">{t("goalsHint")}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field
            label={t("periodStart")}
            preset="shortText"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            placeholder="2026-01-01"
          />
          <Field
            label={t("periodEnd")}
            preset="shortText"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            placeholder="2026-12-31"
          />
          <Field
            label={t("target")}
            preset="shortText"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || !periodStart || !periodEnd}
          onClick={() => void createGoal()}
        >
          {tc("save")}
        </button>
        <ul className="space-y-1 text-sm">
          {goals.map((g) => (
            <li key={g.id}>
              {g.metric}: {facts[g.id]?.fact ?? "…"} / {facts[g.id]?.target ?? g.targetValue}
              <span className="ml-2 text-[#7F8C8D]">
                {g.periodStart.slice(0, 10)} → {g.periodEnd.slice(0, 10)}
              </span>
            </li>
          ))}
          {goals.length === 0 ? <li className="text-[#7F8C8D]">{t("goalsEmpty")}</li> : null}
        </ul>
      </section>
    </div>
  );
}
