"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  GHOST_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../../../../lib/auth-context";
import { orchFetch } from "../../../../../lib/orch-api";

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

const ACTION_OPTIONS = [
  { value: "freeze", label: "freeze" },
  { value: "exportSlice", label: "exportSlice" },
  { value: "markProvisioned", label: "markProvisioned" },
  { value: "bindAndConfig", label: "bindAndConfig" },
  { value: "cutoverEndpoint", label: "cutoverEndpoint" },
  { value: "smoke", label: "smoke" },
  { value: "complete", label: "complete" },
  { value: "fail", label: "fail" },
];

export default function SuperAdminPlacementPage() {
  const params = useParams();
  const orgId = String(params.orgId ?? "");
  const { token } = useAuth();
  const [jobs, setJobs] = useState<PlacementJob[]>([]);
  const [satelliteKey, setSatelliteKey] = useState("industry_clinic");
  const [fromTopology, setFromTopology] = useState<Topology>("SHARED");
  const [toTopology, setToTopology] = useState<Topology>("DEDICATED");
  const [action, setAction] = useState<AdvanceAction>("freeze");
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    try {
      const res = await orchFetch(`/v1/admin/orgs/${orgId}/placement-jobs`, { token });
      if (res.ok) {
        const data = (await res.json()) as PlacementJob[] | { items?: PlacementJob[] };
        setJobs(Array.isArray(data) ? data : (data.items ?? []));
      } else {
        setMessage(`List failed (${res.status})`);
      }
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function createJob() {
    if (!token) return;
    setMessage("");
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/placement-jobs`, {
      token,
      method: "POST",
      body: JSON.stringify({ satelliteKey, fromTopology, toTopology }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(typeof body.message === "string" ? body.message : `Create failed (${res.status})`);
      return;
    }
    setMessage(`Created ${body.id ?? ""} status=${body.status ?? ""}`);
    void reload();
  }

  async function advance() {
    if (!token || !selectedId) return;
    setMessage("");
    const res = await orchFetch(`/v1/admin/placement-jobs/${selectedId}/advance`, {
      token,
      method: "POST",
      body: JSON.stringify({ action }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(typeof body.message === "string" ? body.message : `Advance failed (${res.status})`);
      return;
    }
    setMessage(`Advanced ${selectedId} → ${body.status ?? action}`);
    void reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/super-admin/orgs/${orgId}`} className={GHOST_BUTTON_CLASS}>
          ← Organization
        </Link>
        <h1 className="text-lg font-semibold text-[#34495E]">Placement jobs</h1>
      </div>
      <p className="text-sm text-[#7F8C8D]">
        Lab hop scaffold — not a live SHARED pool and not sellable migrate. SHARED↔ONPREM is rejected.
      </p>
      {loading ? <p className="text-sm text-[#7F8C8D]">Loading…</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#34495E]">Create hop</h2>
        <CatalogField
          kind="CLOSED_MEDIUM"
          label="Satellite"
          value={satelliteKey}
          onChange={(next) => setSatelliteKey(String(next))}
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
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={!token} onClick={() => void createJob()}>
          Create job
        </button>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#34495E]">Advance</h2>
        <CatalogField
          kind="SEARCHABLE"
          label="Job"
          value={selectedId}
          onChange={(next) => setSelectedId(String(next))}
          options={jobs.map((j) => ({
            value: j.id,
            label: `${j.satelliteKey} ${j.fromTopology}→${j.toTopology} (${j.status})`,
          }))}
        />
        <CatalogField
          kind="CLOSED_MEDIUM"
          label="Action"
          value={action}
          onChange={(next) => setAction(next as AdvanceAction)}
          options={ACTION_OPTIONS}
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={!token || !selectedId} onClick={() => void advance()}>
          Advance
        </button>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-2 p-4`}>
        <h2 className="font-medium text-[#34495E]">Jobs</h2>
        <ul className="space-y-2 text-sm">
          {jobs.map((job) => (
            <li key={job.id} className="border-b border-[#ECF0F1] pb-2">
              <span className="font-mono text-xs">{job.id}</span>
              <p>
                {job.satelliteKey} {job.fromTopology}→{job.toTopology} · {job.status}
              </p>
              {job.errorMessage ? <p className="text-[#E74C3C]">{job.errorMessage}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
