"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { getOrchAccessToken } from "../../../../lib/orch-api";
import { useRequireAuth } from "../../../../lib/use-require-auth";

type OrgUnitOpt = { id: string; name: string; status: string };
type PositionOpt = {
  id: string;
  name: string;
  orgUnitId: string;
  orgUnit?: { name: string };
};

type EmploymentRow = {
  id: string;
  globalPersonId: string;
  hireDate: string;
  status: string;
  financeEmployeeId?: string | null;
  orgUnit?: { name: string } | null;
  position?: { name: string } | null;
};

type ListResponse = {
  items: EmploymentRow[];
  persons: Record<
    string,
    {
      globalPersonId: string;
      displayName: string | null;
      finMasked?: string | null;
      accessDenied: boolean;
    }
  >;
};

async function mdmWorkforceFetch(path: string, init: RequestInit = {}) {
  const token = getOrchAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`/api/platform/mdm/workforce/${path.replace(/^\//, "")}`, {
    ...init,
    headers,
  });
}

async function workforceFetch(path: string, init: RequestInit = {}) {
  const token = getOrchAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`/api/platform/workforce/${path.replace(/^\//, "")}`, {
    ...init,
    headers,
  });
}

export default function WorkforceEmploymentsPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceEmployments");
  const [rows, setRows] = useState<EmploymentRow[]>([]);
  const [persons, setPersons] = useState<ListResponse["persons"]>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [globalPersonId, setGlobalPersonId] = useState("");
  const [resolveFin, setResolveFin] = useState("");
  const [resolveName, setResolveName] = useState("");
  const [resolvedLabel, setResolvedLabel] = useState<string | null>(null);
  const [orgUnitId, setOrgUnitId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [orgUnits, setOrgUnits] = useState<OrgUnitOpt[]>([]);
  const [positions, setPositions] = useState<PositionOpt[]>([]);
  const [hireDate, setHireDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [satelliteKeys, setSatelliteKeys] = useState<string[]>([
    "industry_clinic",
    "industry_hotel_pms",
    "industry_fnb_pos",
  ]);

  const SATELLITE_OPTIONS = [
    { key: "industry_clinic", label: "Clinic" },
    { key: "industry_hotel_pms", label: "Hotel PMS" },
    { key: "industry_fnb_pos", label: "F&B POS" },
  ] as const;

  const loadRefs = useCallback(async () => {
    const [unitRes, posRes] = await Promise.all([
      workforceFetch("org-units"),
      workforceFetch("positions"),
    ]);
    if (unitRes.status === 404) {
      setNeedsBootstrap(true);
      setOrgUnits([]);
      return;
    }
    setNeedsBootstrap(false);
    if (unitRes.ok) {
      const u = (await unitRes.json()) as { items: OrgUnitOpt[] };
      const active = (u.items ?? []).filter((x) => x.status === "ACTIVE");
      setOrgUnits(active);
      if (!orgUnitId && active[0]) setOrgUnitId(active[0].id);
    }
    if (posRes.ok) {
      const p = (await posRes.json()) as PositionOpt[];
      setPositions(Array.isArray(p) ? p : []);
    }
  }, [orgUnitId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    await loadRefs();
    const res = await workforceFetch("employments");
    if (!res.ok) {
      setError(`${res.status}`);
      setRows([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as ListResponse;
    setRows(data.items ?? []);
    setPersons(data.persons ?? {});
    setLoading(false);
  }, [loadRefs]);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  async function bootstrapScope() {
    setBusy(true);
    const res = await workforceFetch("scope/bootstrap", { method: "POST", body: "{}" });
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await load();
  }

  const filteredPositions = positions.filter(
    (p) => !orgUnitId || p.orgUnitId === orgUnitId,
  );

  async function onResolvePerson() {
    if (busy || !resolveFin.trim() || !resolveName.trim()) return;
    setBusy(true);
    setError(null);
    const res = await mdmWorkforceFetch("workforce-resolve", {
      method: "POST",
      body: JSON.stringify({
        fin: resolveFin.trim(),
        fullName: resolveName.trim(),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const data = (await res.json()) as {
      globalPersonId: string;
      opsProfile?: { displayName?: string | null; primaryIdentifierMasked?: string | null };
    };
    setGlobalPersonId(data.globalPersonId);
    setResolvedLabel(
      data.opsProfile?.displayName
        ? `${data.opsProfile.displayName} (${data.opsProfile.primaryIdentifierMasked ?? "—"})`
        : data.globalPersonId.slice(0, 8),
    );
  }

  async function onHire(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !globalPersonId.trim() || !orgUnitId || !positionId) return;
    setBusy(true);
    setError(null);
    const res = await workforceFetch("employments/hire", {
      method: "POST",
      body: JSON.stringify({
        globalPersonId: globalPersonId.trim(),
        hireDate,
        orgUnitId,
        positionId,
        satelliteKeys,
      }),
    });
    if (!res.ok) {
      setError(await res.text());
      setBusy(false);
      return;
    }
    setGlobalPersonId("");
    await load();
    setBusy(false);
  }

  if (!ready) return null;
  if (!user?.organizationId) {
    return (
      <p className="text-sm text-[#7F8C8D]">{t("selectOrg")}</p>
    );
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/workspace/workforce/security" className={SECONDARY_BUTTON_CLASS}>
              {t("goSecurity")}
            </Link>
            <Link href="/workspace/workforce/org-structure" className={SECONDARY_BUTTON_CLASS}>
              {t("goOrgStructure")}
            </Link>
            <Link href="/workspace/workforce/positions" className={SECONDARY_BUTTON_CLASS}>
              {t("goPositions")}
            </Link>
            <Link href="/workspace/workforce/absences" className={SECONDARY_BUTTON_CLASS}>
              {t("goAbsences")}
            </Link>
          </div>
        }
      />

      {needsBootstrap ? (
        <div className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
          <p className="text-sm text-[#34495E]">{t("bootstrapHint")}</p>
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} mt-3`}
            disabled={busy}
            onClick={() => void bootstrapScope()}
          >
            {t("bootstrap")}
          </button>
        </div>
      ) : null}

      <form
        onSubmit={(e) => void onHire(e)}
        className={`${CARD_CONTAINER_CLASS} mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5`}
      >
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("resolveFin")}
          <input
            className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={resolveFin}
            onChange={(e) => setResolveFin(e.target.value.toUpperCase())}
            placeholder="1A2B3C4"
          />
        </label>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("resolveFullName")}
          <input
            className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={resolveName}
            onChange={(e) => setResolveName(e.target.value)}
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy || !resolveFin.trim() || !resolveName.trim()}
            onClick={() => void onResolvePerson()}
          >
            {t("resolvePerson")}
          </button>
        </div>
        <label className="block text-[13px] font-medium text-[#34495E] lg:col-span-2">
          {t("globalPersonId")}
          <input
            className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px] font-mono"
            value={globalPersonId}
            readOnly
            placeholder={t("resolveFirst")}
            required
          />
          {resolvedLabel ? (
            <span className="mt-1 block text-xs text-[#27AE60]">{resolvedLabel}</span>
          ) : null}
        </label>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("orgUnit")}
          <select
            className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={orgUnitId}
            onChange={(e) => {
              setOrgUnitId(e.target.value);
              setPositionId("");
            }}
            required
            disabled={orgUnits.length === 0}
          >
            <option value="">{t("selectOrgUnit")}</option>
            {orgUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("position")}
          <select
            className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={positionId}
            onChange={(e) => setPositionId(e.target.value)}
            required
            disabled={filteredPositions.length === 0}
          >
            <option value="">{t("selectPosition")}</option>
            {filteredPositions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] font-medium text-[#34495E]">
          {t("hireDate")}
          <input
            type="date"
            className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={hireDate}
            onChange={(e) => setHireDate(e.target.value)}
            required
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !orgUnitId || !positionId}
          >
            {busy ? t("busy") : t("hire")}
          </button>
        </div>
        <p className="lg:col-span-5 text-xs text-[#7F8C8D]">{t("mdmHint")}</p>
        <fieldset className="lg:col-span-5 rounded-lg border border-[#D5DADF] p-3">
          <legend className="px-1 text-xs font-medium text-[#34495E]">{t("satelliteAccess")}</legend>
          <div className="flex flex-wrap gap-4">
            {SATELLITE_OPTIONS.map((s) => (
              <label key={s.key} className="flex items-center gap-2 text-xs text-[#34495E]">
                <input
                  type="checkbox"
                  checked={satelliteKeys.includes(s.key)}
                  onChange={(e) => {
                    setSatelliteKeys((prev) =>
                      e.target.checked
                        ? [...prev, s.key]
                        : prev.filter((k) => k !== s.key),
                    );
                  }}
                />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
      </form>

      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} p-4 text-sm text-[#7F8C8D]`}>{t("empty")}</div>
      ) : (
        <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto`}>
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#D5DADF]">
                <th className="p-2 text-left font-semibold">{t("colPerson")}</th>
                <th className="p-2 text-left font-semibold">{t("colFinMasked")}</th>
                <th className="p-2 text-left font-semibold">{t("colOrgUnit")}</th>
                <th className="p-2 text-left font-semibold">{t("colPosition")}</th>
                <th className="p-2 text-left font-semibold">{t("colHireDate")}</th>
                <th className="p-2 text-left font-semibold">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#EBEDF0]">
                  <td className="p-2">
                    {persons[r.globalPersonId]?.displayName ??
                      (persons[r.globalPersonId]?.accessDenied
                        ? t("maskedPerson")
                        : r.globalPersonId.slice(0, 8))}
                  </td>
                  <td className="p-2 font-mono text-xs">
                    {persons[r.globalPersonId]?.finMasked ?? "—"}
                  </td>
                  <td className="p-2">{r.orgUnit?.name ?? "—"}</td>
                  <td className="p-2">{r.position?.name ?? "—"}</td>
                  <td className="p-2 tabular-nums">{String(r.hireDate).slice(0, 10)}</td>
                  <td className="p-2">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
