"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../../../../lib/auth-context";
import { orchFetch } from "../../../../../lib/orch-api";

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

export default function SuperAdminPlacementPage() {
  const params = useParams();
  const orgId = String(params.orgId ?? "");
  const { token } = useAuth();
  const [batches, setBatches] = useState<PlacementBatch[]>([]);
  const [satelliteKeys, setSatelliteKeys] = useState<string[]>([
    "industry_hotel_pms",
  ]);
  const [fromTopology, setFromTopology] = useState<Topology>("SHARED");
  const [toTopology, setToTopology] = useState<Topology>("DEDICATED");
  const [packaging, setPackaging] = useState<Packaging>("PER_SATELLITE");
  const [targetHost, setTargetHost] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
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
        setMessage(`List failed (${res.status})`);
      }
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

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
      setMessage("Select at least one satellite");
      return;
    }
    if (!targetHost.trim()) {
      setMessage("Target host is required");
      return;
    }
    setMessage("");
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
      setMessage(
        typeof body.message === "string"
          ? body.message
          : `Start failed (${res.status})`,
      );
      return;
    }
    setMessage(
      `Started ${body.id ?? ""} status=${body.status ?? ""} jobs=${Array.isArray(body.jobs) ? body.jobs.length : satelliteKeys.length}`,
    );
    void reload();
  }

  async function rollbackJob(jobId: string) {
    if (!token) return;
    setBusyJobId(jobId);
    try {
      const res = await orchFetch(`/v1/admin/placement-jobs/${jobId}/advance`, {
        token,
        method: "POST",
        body: JSON.stringify({
          action: "rollback",
          errorMessage: "Operator rollback from legacy placement UI",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(
          typeof body.message === "string"
            ? body.message
            : `Rollback failed (${res.status})`,
        );
        return;
      }
      setMessage(`Rollback requested for ${jobId}`);
      void reload();
    } finally {
      setBusyJobId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/super-admin/orgs/${orgId}`} className={GHOST_BUTTON_CLASS}>
          ← Organization
        </Link>
        <h1 className="text-lg font-semibold text-[#34495E]">Placement batches</h1>
      </div>
      {activeBatch ? (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="status"
        >
          Placement migrate in progress ({activeBatch.status}) · batch{" "}
          {activeBatch.id.slice(0, 8)}… — writes frozen until DONE or rollback.
        </div>
      ) : null}
      <p className="text-sm text-[#7F8C8D]">
        Start runs SHARED→DEDICATED clone → configure → freeze → export/import →
        cutover → smoke. Process log on the batch. Not sellable migrate.
        SHARED↔ONPREM is rejected. Target host required. Prefer platform console
        for full UX.
      </p>
      {loading ? <p className="text-sm text-[#7F8C8D]">Loading…</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#34495E]">Start batch</h2>
        <CatalogField
          kind="MULTI"
          label="Satellites"
          value={satelliteKeys}
          onChange={(next) =>
            setSatelliteKeys(Array.isArray(next) ? next.map(String) : [String(next)])
          }
          options={SATELLITE_OPTIONS}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label="From"
          value={fromTopology}
          onChange={(next) => setFromTopology(next as Topology)}
          options={TOPOLOGY_OPTIONS}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label="To"
          value={toTopology}
          onChange={(next) => setToTopology(next as Topology)}
          options={TOPOLOGY_OPTIONS}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label="Packaging"
          value={packaging}
          onChange={(next) => setPackaging(next as Packaging)}
          options={PACKAGING_OPTIONS}
        />
        <CatalogField
          kind="FREE_TEXT"
          label="Target host"
          value={targetHost}
          onChange={(next) => setTargetHost(String(next))}
        />
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={
            !token ||
            Boolean(activeBatch) ||
            satelliteKeys.length === 0 ||
            !targetHost.trim()
          }
          onClick={() => void startBatch()}
        >
          Start
        </button>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium text-[#34495E]">Batches</h2>
          <button
            type="button"
            className={GHOST_BUTTON_CLASS}
            onClick={() => void reload()}
          >
            Refresh
          </button>
        </div>
        {batches.length === 0 ? (
          <p className="text-sm text-[#7F8C8D]">No placement batches yet</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {batches.map((batch) => (
              <li key={batch.id} className="border-b border-[#ECF0F1] pb-3">
                <div className="font-mono text-[11px] text-[#95A5A6]">{batch.id}</div>
                <div>
                  {batch.fromTopology} → {batch.toTopology} · {batch.packaging} ·{" "}
                  <strong>{batch.status}</strong>
                </div>
                <div className="text-xs text-[#7F8C8D]">
                  {(batch.satelliteKeys ?? []).join(", ")}
                  {batch.targetHost ? ` · ${batch.targetHost}` : ""}
                </div>
                {batch.errorMessage ? (
                  <div className="text-xs text-[#E74C3C]">{batch.errorMessage}</div>
                ) : null}
                <ul className="mt-1 space-y-1 text-xs">
                  {(batch.jobs ?? []).map((job) => (
                    <li key={job.id} className="flex flex-wrap items-center gap-2">
                      <span>
                        {job.satelliteKey}: {job.status}
                        {job.applyLog ? ` — ${job.applyLog.split("\n")[0]}` : ""}
                      </span>
                      {!TERMINAL.has(job.status) ? (
                        <button
                          type="button"
                          className={GHOST_BUTTON_CLASS}
                          disabled={busyJobId === job.id}
                          onClick={() => void rollbackJob(job.id)}
                        >
                          Rollback
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {(batch.processLogs ?? []).length > 0 ? (
                  <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto font-mono text-[10px] text-[#7F8C8D]">
                    {(batch.processLogs ?? []).map((log) => (
                      <li key={log.id}>
                        {log.phase} [{log.level}] {log.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
