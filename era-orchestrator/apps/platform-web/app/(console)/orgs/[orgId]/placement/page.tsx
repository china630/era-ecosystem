"use client";

import { useCallback, useEffect, useState } from "react";
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
type AdvanceAction =
  | "freeze"
  | "exportSlice"
  | "markProvisioned"
  | "bindAndConfig"
  | "cutoverEndpoint"
  | "smoke"
  | "complete"
  | "fail";

type PlacementJob = {
  id: string;
  satelliteKey: string;
  fromTopology: Topology;
  toTopology: Topology;
  status: string;
  errorMessage: string | null;
  targetBaseUrl: string | null;
  createdAt: string;
};

const STATUS_TO_NEXT: Record<string, AdvanceAction | null> = {
  PENDING: "freeze",
  FREEZE: "exportSlice",
  EXPORT: "markProvisioned",
  PROVISION: "bindAndConfig",
  BIND: "cutoverEndpoint",
  CUTOVER: "smoke",
  SMOKE: "complete",
  DONE: null,
  REJECTED: null,
  FAILED: null,
};

function nextActionForStatus(status: string): AdvanceAction | null {
  const key = status.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(STATUS_TO_NEXT, key)) {
    return STATUS_TO_NEXT[key] ?? null;
  }
  return null;
}

const SATELLITE_OPTIONS = [
  "industry_hotel_pms",
  "industry_fnb_pos",
  "industry_clinic",
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

export default function SuperAdminPlacementPage() {
  const params = useParams();
  const orgId = String(params.orgId ?? "");
  const { token } = useAuth();
  const t = useTranslations("superAdmin.orgPlacement");
  const [jobs, setJobs] = useState<PlacementJob[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [satelliteKey, setSatelliteKey] = useState("industry_clinic");
  const [fromTopology, setFromTopology] = useState<Topology>("SHARED");
  const [toTopology, setToTopology] = useState<Topology>("DEDICATED");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    try {
      const res = await orchFetch(`/v1/admin/orgs/${orgId}/placement-jobs`, { token });
      if (res.ok) {
        const data = (await res.json()) as PlacementJob[] | { items?: PlacementJob[] };
        setJobs(Array.isArray(data) ? data : (data.items ?? []));
      } else {
        setError(t("listFailed", { status: res.status }));
      }
    } finally {
      setLoading(false);
    }
  }, [token, orgId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function createJob() {
    if (!token) return;
    setError("");
    setMessage("");
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/placement-jobs`, {
      token,
      method: "POST",
      body: JSON.stringify({ satelliteKey, fromTopology, toTopology }),
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
    setMessage(t("created", { id: body.id ?? "", status: body.status ?? "" }));
    setCreateOpen(false);
    void reload();
  }

  async function advance(jobId: string, action: AdvanceAction) {
    if (!token) return;
    setBusyId(jobId);
    setError("");
    setMessage("");
    try {
      const res = await orchFetch(`/v1/admin/placement-jobs/${jobId}/advance`, {
        token,
        method: "POST",
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body.message === "string"
            ? body.message
            : t("advanceFailed", { status: res.status }),
        );
        return;
      }
      setMessage(t("advanced", { id: jobId, status: body.status ?? action }));
      void reload();
    } finally {
      setBusyId(null);
    }
  }

  function actionLabel(action: AdvanceAction): string {
    return t(`action_${action}` as "action_freeze");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#7F8C8D]">{t("hint")}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          onClick={() => setCreateOpen(true)}
        >
          {t("createHop")}
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
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colSatellite")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colHop")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const next = nextActionForStatus(job.status);
                const terminal =
                  job.status === "DONE" ||
                  job.status === "REJECTED" ||
                  job.status === "FAILED" ||
                  job.status === "COMPLETE";
                return (
                  <tr key={job.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="font-medium text-[#34495E]">{job.satelliteKey}</div>
                      <div className="font-mono text-[11px] text-[#95A5A6]">{job.id}</div>
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {job.fromTopology} → {job.toTopology}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <span className="rounded-full bg-[#ECF0F1] px-2 py-0.5 text-xs font-medium">
                        {job.status}
                      </span>
                      {job.errorMessage ? (
                        <p className="mt-1 text-xs text-[#E74C3C]">{job.errorMessage}</p>
                      ) : null}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="flex flex-wrap gap-2">
                        {next && !terminal ? (
                          <button
                            type="button"
                            className={PRIMARY_BUTTON_CLASS}
                            disabled={busyId === job.id}
                            onClick={() => void advance(job.id, next)}
                          >
                            {actionLabel(next)}
                          </button>
                        ) : null}
                        {!terminal ? (
                          <button
                            type="button"
                            className={GHOST_BUTTON_CLASS}
                            disabled={busyId === job.id}
                            onClick={() => void advance(job.id, "fail")}
                          >
                            {t("action_fail")}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && jobs.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={4}>
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
        title={t("createHop")}
      >
        <div className="space-y-3">
          <CatalogField
            kind="CLOSED_MEDIUM"
            label={t("satellite")}
            value={satelliteKey}
            onChange={(next) => setSatelliteKey(String(next))}
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={!token}
              onClick={() => void createJob()}
            >
              {t("createJob")}
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
