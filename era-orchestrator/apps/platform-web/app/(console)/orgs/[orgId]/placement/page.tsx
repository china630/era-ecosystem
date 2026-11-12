"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  GHOST_BUTTON_CLASS,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "@/lib/auth-context";
import { orchFetch } from "@/lib/orch-api";

type Topology = "SHARED" | "DEDICATED" | "ONPREM";
type Packaging = "PER_SATELLITE" | "SINGLE_STACK";

type PlacementJob = {
  id: string;
  satelliteKey: string;
  fromTopology: Topology;
  toTopology: Topology;
  status: string;
  errorMessage: string | null;
  applyLog?: string | null;
  targetBaseUrl: string | null;
  createdAt: string;
};

type ProcessLog = {
  id: string;
  phase: string;
  level: string;
  message: string;
  createdAt: string;
};

type PlacementBatch = {
  id: string;
  satelliteKeys: string[];
  fromTopology: Topology;
  toTopology: Topology;
  packaging: Packaging;
  targetHost: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  jobs?: PlacementJob[];
  processLogs?: ProcessLog[];
};

const TERMINAL = new Set(["DONE", "FAILED", "REJECTED", "ROLLBACK"]);

const SATELLITE_OPTIONS = [
  "industry_hotel_pms",
  "industry_clinic",
  "industry_fnb_pos",
  "industry_retail",
  "industry_logistics",
  "industry_construction",
  "industry_crm",
  "industry_auto_service",
  "industry_wholesale",
  "finance_core",
  "industry_banking",
].map((value) => ({ value, label: value }));

const TOPOLOGY_OPTIONS = [
  { value: "SHARED", label: "SHARED" },
  { value: "DEDICATED", label: "DEDICATED" },
  { value: "ONPREM", label: "ONPREM" },
];

const PACKAGING_OPTIONS = [
  { value: "PER_SATELLITE", label: "PER_SATELLITE" },
  { value: "SINGLE_STACK", label: "SINGLE_STACK" },
];

function statusChipClass(status: string): string {
  if (status === "DONE") return "bg-emerald-100 text-emerald-800";
  if (status === "FAILED" || status === "REJECTED")
    return "bg-red-100 text-red-800";
  if (status === "ROLLBACK") return "bg-amber-100 text-amber-900";
  if (status === "FREEZE" || status === "EXPORT" || status === "IMPORT")
    return "bg-sky-100 text-sky-900";
  return "bg-[#ECF0F1] text-[#2C3E50]";
}

export default function SuperAdminPlacementPage() {
  const params = useParams();
  const orgId = String(params.orgId ?? "");
  const { token } = useAuth();
  const t = useTranslations("superAdmin.orgPlacement");
  const [batches, setBatches] = useState<PlacementBatch[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [satelliteKeys, setSatelliteKeys] = useState<string[]>([
    "industry_hotel_pms",
  ]);
  const [fromTopology, setFromTopology] = useState<Topology>("SHARED");
  const [toTopology, setToTopology] = useState<Topology>("DEDICATED");
  const [packaging, setPackaging] = useState<Packaging>("PER_SATELLITE");
  const [targetHost, setTargetHost] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    try {
      const res = await orchFetch(`/v1/admin/orgs/${orgId}/placement-batches`, {
        token,
      });
      if (res.ok) {
        const data = (await res.json()) as
          | PlacementBatch[]
          | { items?: PlacementBatch[] };
        setBatches(Array.isArray(data) ? data : (data.items ?? []));
      } else {
        setError(t("listFailed", { status: res.status }));
      }
    } finally {
      setLoading(false);
    }
  }, [token, orgId, t]);

  const activeBatch = useMemo(
    () => batches.find((b) => !TERMINAL.has(b.status)),
    [batches],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!activeBatch || !token) return;
    const id = window.setInterval(() => {
      void reload();
    }, 4000);
    return () => window.clearInterval(id);
  }, [activeBatch, token, reload]);

  async function startBatch() {
    if (!token) return;
    if (satelliteKeys.length === 0) {
      setError(t("needSatellites"));
      return;
    }
    if (!targetHost.trim()) {
      setError(t("needTargetHost"));
      return;
    }
    setError("");
    setMessage("");
    setStarting(true);
    try {
      const res = await orchFetch(`/v1/admin/orgs/${orgId}/placement-batches`, {
        token,
        method: "POST",
        body: JSON.stringify({
          satelliteKeys,
          fromTopology,
          toTopology,
          packaging,
          targetHost: targetHost.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body.message === "string"
            ? body.message
            : t("createFailed", { status: res.status }),
        );
        return;
      }
      setMessage(
        t("started", {
          id: body.id ?? "",
          status: body.status ?? "",
          count: Array.isArray(body.jobs) ? body.jobs.length : satelliteKeys.length,
        }),
      );
      setCreateOpen(false);
      void reload();
    } finally {
      setStarting(false);
    }
  }

  async function rollbackJob(jobId: string) {
    if (!token) return;
    setBusyJobId(jobId);
    setError("");
    try {
      const res = await orchFetch(`/v1/admin/placement-jobs/${jobId}/advance`, {
        token,
        method: "POST",
        body: JSON.stringify({
          action: "rollback",
          errorMessage: "Operator rollback from placement UI",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body.message === "string"
            ? body.message
            : t("rollbackFailed", { status: res.status }),
        );
        return;
      }
      setMessage(t("rollbackOk", { id: jobId }));
      void reload();
    } finally {
      setBusyJobId(null);
    }
  }

  return (
    <div className="space-y-4">
      {activeBatch ? (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="status"
        >
          {t("migrateBanner", {
            status: activeBatch.status,
            id: activeBatch.id.slice(0, 8),
          })}
        </div>
      ) : null}

      <p className="text-sm text-[#7F8C8D]">{t("hint")}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          onClick={() => setCreateOpen(true)}
          disabled={Boolean(activeBatch)}
        >
          {t("startBatch")}
        </button>
        <button
          type="button"
          className={GHOST_BUTTON_CLASS}
          onClick={() => void reload()}
        >
          {t("refresh")}
        </button>
      </div>
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className={CARD_CONTAINER_CLASS}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colBatch")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colHop")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPackaging")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colJobs")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colProcessLog")}</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div className="font-mono text-[11px] text-[#95A5A6]">
                      {batch.id}
                    </div>
                    <div className="text-xs text-[#7F8C8D]">
                      {(batch.satelliteKeys ?? []).join(", ")}
                    </div>
                    {batch.targetHost ? (
                      <div className="text-xs text-[#7F8C8D]">{batch.targetHost}</div>
                    ) : null}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {batch.fromTopology} → {batch.toTopology}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{batch.packaging}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusChipClass(batch.status)}`}
                    >
                      {batch.status}
                    </span>
                    {batch.errorMessage ? (
                      <p className="mt-1 text-xs text-[#E74C3C]">{batch.errorMessage}</p>
                    ) : null}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <ul className="space-y-2 text-xs">
                      {(batch.jobs ?? []).map((job) => (
                        <li key={job.id}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{job.satelliteKey}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusChipClass(job.status)}`}
                            >
                              {job.status}
                            </span>
                            {!TERMINAL.has(job.status) ? (
                              <button
                                type="button"
                                className={GHOST_BUTTON_CLASS}
                                disabled={busyJobId === job.id}
                                onClick={() => void rollbackJob(job.id)}
                              >
                                {t("rollback")}
                              </button>
                            ) : null}
                          </div>
                          {job.applyLog ? (
                            <div className="font-mono text-[10px] text-[#95A5A6] whitespace-pre-wrap">
                              {job.applyLog.split("\n").slice(0, 4).join("\n")}
                            </div>
                          ) : null}
                          {job.errorMessage ? (
                            <div className="text-[#E74C3C]">{job.errorMessage}</div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-[10px] text-[#7F8C8D]">
                      {(batch.processLogs ?? []).map((log) => (
                        <li key={log.id}>
                          <span className="text-[#34495E]">{log.phase}</span>{" "}
                          <span
                            className={
                              log.level === "ERROR"
                                ? "text-[#E74C3C]"
                                : log.level === "WARN"
                                  ? "text-[#E67E22]"
                                  : ""
                            }
                          >
                            [{log.level}]
                          </span>{" "}
                          {log.message}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
              {!loading && batches.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={6}>
                    {t("empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <ModalShell
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("startBatch")}
      >
        <div className="space-y-3">
          <CatalogField
            kind="MULTI"
            label={t("satellites")}
            value={satelliteKeys}
            onChange={(next) =>
              setSatelliteKeys(Array.isArray(next) ? next.map(String) : [String(next)])
            }
            options={SATELLITE_OPTIONS}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("from")}
            value={fromTopology}
            onChange={(next) => setFromTopology(next as Topology)}
            options={TOPOLOGY_OPTIONS}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("to")}
            value={toTopology}
            onChange={(next) => setToTopology(next as Topology)}
            options={TOPOLOGY_OPTIONS}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("packaging")}
            value={packaging}
            onChange={(next) => setPackaging(next as Packaging)}
            options={PACKAGING_OPTIONS}
          />
          <CatalogField
            kind="FREE_TEXT"
            label={t("targetHost")}
            value={targetHost}
            onChange={(next) => setTargetHost(String(next))}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={
                !token ||
                starting ||
                satelliteKeys.length === 0 ||
                !targetHost.trim()
              }
              onClick={() => void startBatch()}
            >
              {t("start")}
            </button>
            <button
              type="button"
              className={GHOST_BUTTON_CLASS}
              onClick={() => setCreateOpen(false)}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
