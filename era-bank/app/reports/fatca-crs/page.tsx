"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { OpsDataTable, OpsModalShell, useOpsModal } from "@/components/ops";
import { OpsError, StatusBadge } from "@/components/ops-ui";

type FatcaRow = {
  id: string;
  customerId: string;
  classification: string;
  tinStatus?: string | null;
  updatedAt?: string;
};

const CLASSIFICATIONS = ["US_PERSON", "REPORTABLE", "NON_REPORTABLE"] as const;

function FatcaCrsPageInner() {
  const [rows, setRows] = useState<FatcaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [template, setTemplate] = useState("CBAR_TRIAL_BALANCE");
  const [periodFrom, setPeriodFrom] = useState("2026-01-01");
  const [periodTo, setPeriodTo] = useState("2026-01-31");
  const [runId, setRunId] = useState<string | null>(null);
  const [classification, setClassification] = useState<string>("NON_REPORTABLE");
  const [tinStatus, setTinStatus] = useState("");
  const { mode, entityId, open, close, isOpen } = useOpsModal();

  const selected = useMemo(
    () => rows.find((r) => r.customerId === entityId),
    [rows, entityId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/fatca-crs", { cache: "no-store" });
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setRows(Array.isArray(data) ? (data as FatcaRow[]) : []);
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode === "edit" && selected) {
      setClassification(selected.classification);
      setTinStatus(selected.tinStatus ?? "");
    }
  }, [mode, selected]);

  async function generateCbar() {
    const res = await fetch(`/api/reports/cbar/${template}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodFrom, periodTo }),
    });
    const json = (await res.json()) as { id?: string };
    if (json.id) setRunId(json.id);
  }

  async function saveClassification(e: React.FormEvent) {
    e.preventDefault();
    if (!entityId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/fatca-crs/classifications/${encodeURIComponent(entityId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classification,
            tinStatus: tinStatus || undefined,
          }),
        },
      );
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        return;
      }
      close();
      await load();
    } catch {
      setError("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Regulatory reports" subtitle="CBAR prudential + FATCA/CRS" />
      <div className={CARD_CONTAINER_CLASS}>
        <h3 className="mb-2 font-medium">CBAR generate</h3>
        <select
          className="mb-2 w-full rounded border px-3 py-2 text-sm"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        >
          <option value="CBAR_TRIAL_BALANCE">CBAR_TRIAL_BALANCE</option>
          <option value="CBAR_BALANCE_SHEET_STUB">CBAR_BALANCE_SHEET_STUB</option>
          <option value="CBAR_LCR_STUB">CBAR_LCR_STUB</option>
        </select>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <input
            type="date"
            className="rounded border px-3 py-2 text-sm"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
          />
          <input
            type="date"
            className="rounded border px-3 py-2 text-sm"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void generateCbar()}>
            Generate
          </button>
          {runId ? (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() =>
                window.open(`/api/reports/cbar/runs/${runId}/export?format=csv`, "_blank")
              }
            >
              Export CSV
            </button>
          ) : null}
        </div>
      </div>

      <OpsError message={error} />
      <div className={CARD_CONTAINER_CLASS}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">FATCA/CRS classifications</h3>
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
            Refresh
          </button>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {!loading ? (
          <OpsDataTable
            rows={rows}
            emptyLabel="No classifications yet"
            onRowClick={(row) => open("edit", row.customerId)}
            columns={[
              {
                key: "customerId",
                label: "Customer",
                render: (row) => `${row.customerId.slice(0, 14)}…`,
              },
              {
                key: "classification",
                label: "Class",
                render: (row) => <StatusBadge status={row.classification} />,
              },
              { key: "tinStatus", label: "TIN status" },
              {
                key: "updatedAt",
                label: "Updated",
                render: (row) => row.updatedAt?.slice(0, 10) ?? "—",
              },
            ]}
          />
        ) : null}
      </div>

      <OpsModalShell
        open={isOpen && mode === "edit"}
        title="Edit classification"
        subtitle={entityId ?? undefined}
        onClose={close}
        formId="fatca-edit-form"
        submitLabel="Save classification"
        busy={busy}
      >
        <form id="fatca-edit-form" onSubmit={(e) => void saveClassification(e)} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-foreground">Classification</span>
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
            >
              {CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-foreground">TIN status</span>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={tinStatus}
              onChange={(e) => setTinStatus(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </form>
      </OpsModalShell>
    </div>
  );
}

export default function FatcaCrsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <FatcaCrsPageInner />
    </Suspense>
  );
}
