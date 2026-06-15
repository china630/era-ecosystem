"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";
import { OpsDataTable } from "@/components/ops";
import { OpsError } from "@/components/ops-ui";

type GapSnapshot = {
  id: string;
  asOf?: string;
  horizonDays?: number;
  bucketsJson?: {
    buckets?: Array<{
      dayOffset: number;
      inflowMinor: number;
      outflowMinor: number;
      netGapMinor: number;
      cumulativeGapMinor: number;
    }>;
    lcrRatioStub?: number | null;
  };
};

type GapHistoryRow = {
  id: string;
  asOf?: string;
  horizonDays?: number;
  createdAt?: string;
};

export default function LiquidityGapPage() {
  const t = useTranslations("pages.treasury");
  const tc = useTranslations("common");
  const [snapshot, setSnapshot] = useState<GapSnapshot | null>(null);
  const [history, setHistory] = useState<GapHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [snapRes, histRes] = await Promise.all([
        fetch("/api/treasury/liquidity-gap?horizonDays=30"),
        fetch("/api/treasury/liquidity-gap/history?limit=10"),
      ]);
      const snapData = await snapRes.json();
      if (!snapRes.ok) throw new Error(snapData.error ?? tc("error"));
      setSnapshot(snapData as GapSnapshot);

      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(Array.isArray(histData) ? (histData as GapHistoryRow[]) : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const buckets = snapshot?.bucketsJson?.buckets ?? [];

  return (
    <div className="space-y-6">
      <Link href="/treasury" className="text-sm text-primary">
        ← {t("back")}
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("sections.gap")}</h1>
        <button type="button" onClick={() => void refresh()} className="text-sm text-primary">
          {tc("refresh")}
        </button>
      </div>
      <OpsError message={error} />
      {loading ? <p className="text-sm text-muted-foreground">{tc("loading")}</p> : null}
      {snapshot?.bucketsJson?.lcrRatioStub != null ? (
        <p className="text-sm">
          LCR (stub): <strong>{snapshot.bucketsJson.lcrRatioStub.toFixed(2)}</strong>
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">T+</th>
              <th className="px-3 py-2 text-right">Inflow</th>
              <th className="px-3 py-2 text-right">Outflow</th>
              <th className="px-3 py-2 text-right">Net</th>
              <th className="px-3 py-2 text-right">Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.dayOffset} className="border-t">
                <td className="px-3 py-2">{b.dayOffset}</td>
                <td className="px-3 py-2 text-right">{(b.inflowMinor / 100).toFixed(2)}</td>
                <td className="px-3 py-2 text-right">{(b.outflowMinor / 100).toFixed(2)}</td>
                <td className="px-3 py-2 text-right">{(b.netGapMinor / 100).toFixed(2)}</td>
                <td className="px-3 py-2 text-right">{(b.cumulativeGapMinor / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={CARD_CONTAINER_CLASS}>
        <h2 className="mb-3 text-sm font-semibold">Snapshot history</h2>
        <OpsDataTable
          rows={history}
          emptyLabel="No historical snapshots"
          columns={[
            {
              key: "id",
              label: "Snapshot",
              render: (row) => `${row.id.slice(0, 10)}…`,
            },
            {
              key: "asOf",
              label: "As of",
              render: (row) => row.asOf?.slice(0, 10) ?? "—",
            },
            { key: "horizonDays", label: "Horizon (days)" },
            {
              key: "createdAt",
              label: "Created",
              render: (row) => row.createdAt?.slice(0, 19) ?? "—",
            },
          ]}
        />
      </div>
    </div>
  );
}
