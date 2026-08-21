"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DEFAULT_LIST_PAGE_SIZE,
  ListPaginationFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { getOrchAccessToken, orchFetch } from "../../../../lib/orch-api";
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
  orgUnit?: { name: string; id?: string } | null;
  position?: { name: string; id?: string } | null;
  orgUnitId?: string;
  positionId?: string;
  roleBindings?: Array<{ satelliteKey: string }>;
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

function orgIdFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const claims = JSON.parse(atob(token.split(".")[1] ?? "")) as {
      organizationId?: string | null;
    };
    return claims.organizationId ?? null;
  } catch {
    return null;
  }
}

async function mdmWorkforceFetch(path: string, init: RequestInit = {}) {
  const token = getOrchAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const orgId = orgIdFromToken(token);
  if (orgId && !headers.has("x-organization-id")) {
    headers.set("x-organization-id", orgId);
  }
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
  const orgId = orgIdFromToken(token);
  if (orgId && !headers.has("x-organization-id")) {
    headers.set("x-organization-id", orgId);
  }
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`/api/platform/workforce/${path.replace(/^\//, "")}`, {
    ...init,
    headers,
  });
}

const SATELLITE_OPTIONS = [
  { key: "industry_clinic", label: "Clinic" },
  { key: "industry_hotel_pms", label: "Hotel PMS" },
  { key: "industry_fnb_pos", label: "F&B POS" },
] as const;

export default function WorkforceEmploymentsPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceEmployments");
  const tCommon = useTranslations("common");
  const [rows, setRows] = useState<EmploymentRow[]>([]);
  const [persons, setPersons] = useState<ListResponse["persons"]>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);
  const [actionEmp, setActionEmp] = useState<EmploymentRow | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferOrgUnitId, setTransferOrgUnitId] = useState("");
  const [transferPositionId, setTransferPositionId] = useState("");
  const [hrOpen, setHrOpen] = useState(false);
  const [hrJson, setHrJson] = useState("");
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
  const [notEntitled, setNotEntitled] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [satelliteKeys, setSatelliteKeys] = useState<string[]>([
    "industry_clinic",
    "industry_hotel_pms",
    "industry_fnb_pos",
  ]);

  const [filterText, setFilterText] = useState("");
  const [filterOrgUnitId, setFilterOrgUnitId] = useState("");
  const [filterPositionId, setFilterPositionId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSatellite, setFilterSatellite] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE);

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
    const res = await workforceFetch("employments");
    if (res.status === 403) {
      const body = (await res.json().catch(() => null)) as { code?: string } | null;
      if (body?.code === "PLATFORM_WORKFORCE_REQUIRED") {
        setNotEntitled(true);
        setRows([]);
        setLoading(false);
        return;
      }
    }
    setNotEntitled(false);
    await loadRefs();
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

  const filterPositionOptions = positions.filter(
    (p) => !filterOrgUnitId || p.orgUnitId === filterOrgUnitId,
  );

  const filteredRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterOrgUnitId) {
        const unitId = r.orgUnitId ?? r.orgUnit?.id;
        if (unitId !== filterOrgUnitId) return false;
      }
      if (filterPositionId) {
        const posId = r.positionId ?? r.position?.id;
        if (posId !== filterPositionId) return false;
      }
      if (filterSatellite) {
        const keys = r.roleBindings?.map((b) => b.satelliteKey) ?? [];
        if (!keys.includes(filterSatellite)) return false;
      }
      if (q) {
        const person = persons[r.globalPersonId];
        const name = (person?.displayName ?? "").toLowerCase();
        const fin = (person?.finMasked ?? "").toLowerCase();
        if (!name.includes(q) && !fin.includes(q) && !r.globalPersonId.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [
    rows,
    persons,
    filterText,
    filterOrgUnitId,
    filterPositionId,
    filterStatus,
    filterSatellite,
  ]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filterText, filterOrgUnitId, filterPositionId, filterStatus, filterSatellite]);

  function openHire() {
    setResolveFin("");
    setResolveName("");
    setGlobalPersonId("");
    setResolvedLabel(null);
    setPositionId("");
    setHireDate(new Date().toISOString().slice(0, 10));
    setSatelliteKeys(["industry_clinic", "industry_hotel_pms", "industry_fnb_pos"]);
    setError(null);
    setHireOpen(true);
  }

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
    setHireOpen(false);
    await load();
    setBusy(false);
  }

  async function terminateEmployment(emp: EmploymentRow) {
    if (!window.confirm(t("terminateConfirm"))) return;
    setBusy(true);
    setError(null);
    const res = await workforceFetch(`employments/${emp.id}/terminate`, {
      method: "POST",
    });
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await load();
  }

  async function reprovisionEmployment(emp: EmploymentRow) {
    setBusy(true);
    setError(null);
    const res = await workforceFetch(`employments/${emp.id}/reprovision`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await load();
  }

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!actionEmp || !transferOrgUnitId || !transferPositionId) return;
    setBusy(true);
    setError(null);
    const res = await workforceFetch(`employments/${actionEmp.id}/transfer`, {
      method: "PATCH",
      body: JSON.stringify({
        orgUnitId: transferOrgUnitId,
        positionId: transferPositionId,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    setTransferOpen(false);
    setActionEmp(null);
    await load();
  }

  async function openHrProfile(emp: EmploymentRow) {
    setActionEmp(emp);
    setHrOpen(true);
    setHrJson("");
    setBusy(true);
    const res = await mdmWorkforceFetch(`${emp.globalPersonId}/hr-profile`);
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    setHrJson(JSON.stringify(await res.json(), null, 2));
  }

  async function saveHrProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!actionEmp) return;
    setBusy(true);
    setError(null);
    let body: unknown;
    try {
      body = JSON.parse(hrJson);
    } catch {
      setError(t("hrInvalidJson"));
      setBusy(false);
      return;
    }
    const res = await mdmWorkforceFetch(`${actionEmp.globalPersonId}/hr-profile`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    setHrOpen(false);
  }

  async function enableWorkforce() {
    setEnabling(true);
    const token = getOrchAccessToken();
    if (!token) {
      setEnabling(false);
      return;
    }
    const res = await orchFetch("/v1/billing/toggle-module", {
      token,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleKey: "platform_workforce", enabled: true }),
    }).catch(() => null);
    setEnabling(false);
    if (res?.ok) {
      setNotEntitled(false);
      await load();
    }
  }

  if (!ready) return null;
  if (!user?.organizationId) {
    return <p className="text-sm text-[#7F8C8D]">{t("selectOrg")}</p>;
  }

  if (notEntitled) {
    return (
      <div className={`${CARD_CONTAINER_CLASS} mx-auto max-w-lg p-8 text-center`}>
        <h1 className="text-xl font-semibold text-[#34495E]">{t("gateTitle")}</h1>
        <p className="mt-2 text-sm text-[#7F8C8D]">{t("gateHint")}</p>
        <button
          type="button"
          className={`${PRIMARY_BUTTON_CLASS} mt-6`}
          disabled={enabling}
          onClick={() => void enableWorkforce()}
        >
          {enabling ? t("gateEnabling") : t("gateEnable")}
        </button>
        <p className="mt-4 text-sm">
          <Link href="/workspace" className="text-[#2980B9] hover:underline">
            {t("gateBack")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openHire}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("addEmployee")}
          </button>
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

      <div className={`${CARD_CONTAINER_CLASS} mb-4 flex flex-wrap items-end gap-3 p-4`}>
        <label className="text-[13px] font-medium text-[#34495E]">
          {t("filterSearch")}
          <input
            className="mt-1 block w-48 rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={t("filterSearchPlaceholder")}
          />
        </label>
        <label className="text-[13px] font-medium text-[#34495E]">
          {t("filterOrgUnit")}
          <select
            className="mt-1 block min-w-[10rem] rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={filterOrgUnitId}
            onChange={(e) => {
              setFilterOrgUnitId(e.target.value);
              setFilterPositionId("");
            }}
          >
            <option value="">{t("filterAll")}</option>
            {orgUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] font-medium text-[#34495E]">
          {t("filterPosition")}
          <select
            className="mt-1 block min-w-[10rem] rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={filterPositionId}
            onChange={(e) => setFilterPositionId(e.target.value)}
          >
            <option value="">{t("filterAll")}</option>
            {filterPositionOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] font-medium text-[#34495E]">
          {t("filterStatus")}
          <select
            className="mt-1 block min-w-[8rem] rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">{t("filterAll")}</option>
            <option value="ACTIVE">{t("statusActive")}</option>
            <option value="TERMINATED">{t("statusTerminated")}</option>
          </select>
        </label>
        <label className="text-[13px] font-medium text-[#34495E]">
          {t("filterSatellite")}
          <select
            className="mt-1 block min-w-[10rem] rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={filterSatellite}
            onChange={(e) => setFilterSatellite(e.target.value)}
          >
            <option value="">{t("filterAll")}</option>
            {SATELLITE_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && !hireOpen ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : filteredRows.length === 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} p-4 text-sm text-[#7F8C8D]`}>{t("empty")}</div>
      ) : (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPerson")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colFinMasked")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colOrgUnit")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPosition")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colHireDate")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {persons[r.globalPersonId]?.displayName ??
                      (persons[r.globalPersonId]?.accessDenied
                        ? t("maskedPerson")
                        : r.globalPersonId.slice(0, 8))}
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>
                    {persons[r.globalPersonId]?.finMasked ?? "—"}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.orgUnit?.name ?? "—"}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.position?.name ?? "—"}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} tabular-nums`}>
                    {String(r.hireDate).slice(0, 10)}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.status}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy || r.status === "TERMINATED"}
                        onClick={() => {
                          setActionEmp(r);
                          setTransferOrgUnitId(r.orgUnitId ?? r.orgUnit?.id ?? "");
                          setTransferPositionId(r.positionId ?? r.position?.id ?? "");
                          setTransferOpen(true);
                        }}
                      >
                        {t("transfer")}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy || r.status === "TERMINATED"}
                        onClick={() => void terminateEmployment(r)}
                      >
                        {t("terminate")}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy}
                        onClick={() => void reprovisionEmployment(r)}
                      >
                        {t("reprovision")}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy}
                        onClick={() => void openHrProfile(r)}
                      >
                        {t("hrProfile")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={filteredRows.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            labels={{
              rowsPerPage: tCommon("paginationRowsPerPage"),
              pageOf: tCommon("paginationPageOf"),
              prev: tCommon("paginationPrev"),
              next: tCommon("paginationNext"),
            }}
          />
        </div>
      )}

      <ModalShell
        open={hireOpen}
        title={t("hireTitle")}
        subtitle={t("hireSubtitle")}
        onClose={() => !busy && setHireOpen(false)}
        closeLabel={tCommon("close")}
      >
        <form onSubmit={(e) => void onHire(e)} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy || !resolveFin.trim() || !resolveName.trim()}
            onClick={() => void onResolvePerson()}
          >
            {t("resolvePerson")}
          </button>
          <label className="block text-[13px] font-medium text-[#34495E]">
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
          <fieldset className="rounded-lg border border-[#D5DADF] p-3">
            <legend className="px-1 text-xs font-medium text-[#34495E]">
              {t("satelliteAccess")}
            </legend>
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
          <p className="text-xs text-[#7F8C8D]">{t("mdmHint")}</p>
          {error && hireOpen ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setHireOpen(false)}
              disabled={busy}
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || !orgUnitId || !positionId || !globalPersonId}
            >
              {busy ? t("busy") : t("hire")}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={transferOpen}
        title={t("transferTitle")}
        onClose={() => !busy && setTransferOpen(false)}
        closeLabel={tCommon("close")}
      >
        <form onSubmit={(e) => void submitTransfer(e)} className="grid gap-3">
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("orgUnit")}
            <select
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={transferOrgUnitId}
              onChange={(e) => {
                setTransferOrgUnitId(e.target.value);
                setTransferPositionId("");
              }}
              required
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
              value={transferPositionId}
              onChange={(e) => setTransferPositionId(e.target.value)}
              required
            >
              <option value="">{t("selectPosition")}</option>
              {positions
                .filter((p) => p.orgUnitId === transferOrgUnitId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setTransferOpen(false)}
            >
              {tCommon("cancel")}
            </button>
            <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
              {t("transfer")}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={hrOpen}
        title={t("hrProfileTitle")}
        onClose={() => !busy && setHrOpen(false)}
        closeLabel={tCommon("close")}
      >
        <form onSubmit={(e) => void saveHrProfile(e)} className="grid gap-3">
          <textarea
            className="min-h-[12rem] w-full rounded-lg border border-[#D5DADF] p-2 font-mono text-xs"
            value={hrJson}
            onChange={(e) => setHrJson(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setHrOpen(false)}
            >
              {tCommon("cancel")}
            </button>
            <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
              {t("hrSave")}
            </button>
          </div>
        </form>
      </ModalShell>
    </>
  );
}
