"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../../../lib/auth-context";
import { orchFetch } from "../../../../lib/orch-api";

type OperatingMode = {
  organizationId: string;
  mode: "STANDALONE" | "DEPARTMENT";
  parentOrgId: string | null;
  fiscalRouting: "OWN" | "PARENT";
  revenueRouting: "OWN" | "PARENT";
};

type SatelliteEndpoint = {
  satelliteKey: string;
  baseUrl: string;
  enabled: boolean;
};

type DepartmentRow = {
  id: string;
  name: string;
  operatingMode: string;
  parentOrgId: string | null;
  createdAt: string;
};

const ENDPOINT_PRESETS = [
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
];

export default function SuperAdminOrgHubPage() {
  const params = useParams();
  const orgId = String(params.orgId ?? "");
  const { token } = useAuth();
  const [mode, setMode] = useState<OperatingMode | null>(null);
  const [endpoints, setEndpoints] = useState<SatelliteEndpoint[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [deptName, setDeptName] = useState("");
  const [endpointDraft, setEndpointDraft] = useState<Record<string, { baseUrl: string; enabled: boolean }>>({});
  const [parentOrgId, setParentOrgId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(async () => {
    if (!token || !orgId) return;
    setLoading(true);
    try {
      const [modeRes, epRes, deptRes] = await Promise.all([
        orchFetch(`/v1/admin/orgs/${orgId}/operating-mode`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/satellite-endpoints`, { token }),
        orchFetch(`/v1/admin/orgs/${orgId}/departments`, { token }),
      ]);
      if (modeRes.ok) setMode((await modeRes.json()) as OperatingMode);
      if (epRes.ok) {
        const eps = (await epRes.json()) as SatelliteEndpoint[];
        setEndpoints(eps);
        const draft: Record<string, { baseUrl: string; enabled: boolean }> = {};
        for (const key of ENDPOINT_PRESETS) {
          const row = eps.find((e) => e.satelliteKey === key);
          draft[key] = { baseUrl: row?.baseUrl ?? "", enabled: row?.enabled ?? false };
        }
        setEndpointDraft(draft);
      }
      if (deptRes.ok) setDepartments((await deptRes.json()) as DepartmentRow[]);
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function saveOperatingMode(nextMode: "STANDALONE" | "DEPARTMENT") {
    if (!token) return;
    setMessage("");
    const body =
      nextMode === "DEPARTMENT"
        ? {
            mode: "DEPARTMENT",
            parentOrgId: parentOrgId.trim() || mode?.parentOrgId,
            fiscalRouting: "PARENT",
            revenueRouting: "PARENT",
          }
        : { mode: "STANDALONE" };
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/operating-mode`, {
      token,
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setMessage(`Operating mode save failed (${res.status})`);
      return;
    }
    setMode((await res.json()) as OperatingMode);
    setMessage("Operating mode saved");
    await reload();
  }

  async function saveEndpoint(key: string) {
    if (!token) return;
    const row = endpointDraft[key];
    if (!row?.baseUrl.trim()) return;
    setMessage("");
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/satellite-endpoints/${key}`, {
      token,
      method: "PUT",
      body: JSON.stringify({
        satelliteKey: key,
        baseUrl: row.baseUrl.trim(),
        enabled: row.enabled,
      }),
    });
    if (!res.ok) {
      setMessage(`Endpoint ${key} save failed (${res.status})`);
      return;
    }
    setMessage(`Saved endpoint ${key}`);
    await reload();
  }

  async function createDepartment() {
    if (!token || !deptName.trim()) return;
    setMessage("");
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/departments`, {
      token,
      method: "POST",
      body: JSON.stringify({ name: deptName.trim() }),
    });
    if (!res.ok) {
      setMessage(`Create department failed (${res.status})`);
      return;
    }
    setDeptName("");
    setMessage("Department org created");
    await reload();
  }

  async function detachDepartment() {
    if (!token) return;
    if (
      !window.confirm(
        "Detach this organization from its parent (DEPARTMENT → STANDALONE)? Routing becomes OWN.",
      )
    ) {
      return;
    }
    setMessage("");
    const res = await orchFetch(`/v1/admin/orgs/${orgId}/operating-mode/detach`, {
      token,
      method: "POST",
    });
    if (!res.ok) {
      setMessage(`Detach failed (${res.status})`);
      return;
    }
    setMode((await res.json()) as OperatingMode);
    setMessage("Detached to STANDALONE");
    await reload();
  }

  function copyUuid(id: string) {
    void navigator.clipboard.writeText(id);
    setMessage(`Copied ${id}`);
  }

  async function syncSatelliteBindings() {
    if (!token || !orgId) return;
    setSyncing(true);
    setMessage("");
    try {
      const res = await orchFetch(`/v1/admin/orgs/${orgId}/sync-satellite-bindings`, {
        token,
        method: "POST",
      });
      if (!res.ok) {
        setMessage(`Sync bindings failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as {
        results?: Array<{ satelliteKey: string; ok: boolean; organizationId: string; error?: string }>;
      };
      const results = body.results ?? [];
      const ok = results.filter((r) => r.ok).length;
      const fail = results.filter((r) => !r.ok);
      if (results.length === 0) {
        setMessage("No enabled industry endpoints to sync — save hotel/fnb/clinic URLs first");
        return;
      }
      if (fail.length === 0) {
        setMessage(`Synced ${ok} satellite binding(s)`);
        return;
      }
      setMessage(
        `Synced ${ok}/${results.length}. Failed: ${fail
          .map((f) => `${f.satelliteKey}${f.error ? ` (${f.error.slice(0, 80)})` : ""}`)
          .join("; ")}`,
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/super-admin/orgs" className={GHOST_BUTTON_CLASS}>
          ← Organizations
        </Link>
        <Link href={`/super-admin/orgs/${orgId}/subscription`} className={GHOST_BUTTON_CLASS}>
          License / trial
        </Link>
        <Link href={`/super-admin/orgs/${orgId}/placement`} className={GHOST_BUTTON_CLASS}>
          Placement
        </Link>
        <h1 className="text-lg font-semibold text-[#34495E]">Organization hub</h1>
        <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => copyUuid(orgId)}>
          Copy org UUID
        </button>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={syncing || !token}
          onClick={() => void syncSatelliteBindings()}
        >
          {syncing ? "Syncing…" : "Sync satellite bindings"}
        </button>
      </div>

      {loading ? <p className="text-sm text-[#7F8C8D]">Loading…</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#34495E]">Operating mode</h2>
        {mode ? (
          <p className="text-sm text-[#7F8C8D]">
            Current: {mode.mode}
            {mode.parentOrgId ? ` · parent ${mode.parentOrgId}` : ""}
            · fiscal {mode.fiscalRouting} · revenue {mode.revenueRouting}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void saveOperatingMode("STANDALONE")}>
            Set STANDALONE
          </button>
          <input
            className={`${MODAL_INPUT_CLASS} min-w-[16rem]`}
            placeholder="Parent org UUID (for DEPARTMENT)"
            value={parentOrgId}
            onChange={(e) => setParentOrgId(e.target.value)}
          />
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void saveOperatingMode("DEPARTMENT")}>
            Set DEPARTMENT
          </button>
          {mode?.mode === "DEPARTMENT" ? (
            <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => void detachDepartment()}>
              Detach → STANDALONE
            </button>
          ) : null}
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#34495E]">Department orgs</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${MODAL_INPUT_CLASS} min-w-[12rem]`}
            placeholder="Department name (F&B, Clinic…)"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
          />
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void createDepartment()}>
            Create department
          </button>
        </div>
        <ul className="space-y-1 text-sm">
          {departments.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2">
              <span>{d.name}</span>
              <code className="text-xs">{d.id}</code>
              <button type="button" className="text-xs text-[#2980B9]" onClick={() => copyUuid(d.id)}>
                copy
              </button>
            </li>
          ))}
          {departments.length === 0 ? <li className="text-[#7F8C8D]">No departments yet</li> : null}
        </ul>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#34495E]">Satellite endpoints</h2>
        <p className="text-xs text-[#7F8C8D]">
          After saving enabled base URLs, use <strong>Sync satellite bindings</strong> to push this org
          (or matching department) UUID into each satellite — no manual{" "}
          <code>ERA_SATELLITE_ORGANIZATION_ID</code> edit. See ADR satellite-organization-bind.
        </p>
        {ENDPOINT_PRESETS.map((key) => (
          <div key={key} className="flex flex-wrap items-center gap-2 border-b border-[#ECF0F1] py-2 text-sm">
            <span className="w-40 font-mono text-xs">{key}</span>
            <input
              className={`${MODAL_INPUT_CLASS} min-w-[16rem] flex-1`}
              placeholder="http://host:port"
              value={endpointDraft[key]?.baseUrl ?? ""}
              onChange={(e) =>
                setEndpointDraft((prev) => ({
                  ...prev,
                  [key]: { ...prev[key], baseUrl: e.target.value, enabled: prev[key]?.enabled ?? true },
                }))
              }
            />
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={endpointDraft[key]?.enabled ?? false}
                onChange={(e) =>
                  setEndpointDraft((prev) => ({
                    ...prev,
                    [key]: {
                      baseUrl: prev[key]?.baseUrl ?? "",
                      enabled: e.target.checked,
                    },
                  }))
                }
              />
              enabled
            </label>
            <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => void saveEndpoint(key)}>
              Save
            </button>
          </div>
        ))}
        {endpoints.length > 0 && (
          <p className="text-xs text-[#7F8C8D]">{endpoints.length} endpoint(s) registered</p>
        )}
      </section>
    </div>
  );
}
