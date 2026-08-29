"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRightLeft,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  UserMinus,
} from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
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
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { getOrchAccessToken, orchFetch } from "../../../../lib/orch-api";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  mdmWorkforceFetch,
  orgIdFromToken,
  workforceFetch,
} from "../../../../lib/workforce-fetch";

type OrgUnitOpt = { id: string; name: string; status: string };
type PositionOpt = {
  id: string;
  name: string;
  orgUnitId: string;
  status?: string;
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
      sex?: string | null;
      birthDate?: string | null;
    }
  >;
};

const SATELLITE_OPTIONS = [
  { key: "industry_clinic", label: "Clinic" },
  { key: "industry_hotel_pms", label: "Hotel PMS" },
  { key: "industry_fnb_pos", label: "F&B POS" },
] as const;

const SEX_VALUES = ["MALE", "FEMALE", "UNKNOWN"] as const;
const BLOOD_VALUES = [
  "A_POS",
  "A_NEG",
  "B_POS",
  "B_NEG",
  "AB_POS",
  "AB_NEG",
  "O_POS",
  "O_NEG",
  "UNKNOWN",
] as const;

const AGE_BUCKETS = [
  "18-25",
  "26-35",
  "36-45",
  "46-55",
  "56-59",
  "60+",
] as const;

type AgeBucket = (typeof AGE_BUCKETS)[number];

function ageInBaku(birthDateIso: string | null | undefined): number | null {
  if (!birthDateIso) return null;
  const parts = birthDateIso.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [ty, tm, td] = todayStr.split("-").map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return age >= 0 ? age : null;
}

function ageBucket(age: number | null): AgeBucket | null {
  if (age == null || age < 18) return null;
  if (age <= 25) return "18-25";
  if (age <= 35) return "26-35";
  if (age <= 45) return "36-45";
  if (age <= 55) return "46-55";
  if (age <= 59) return "56-59";
  return "60+";
}

function bloodLabel(code: string): string {
  const map: Record<string, string> = {
    A_POS: "A+",
    A_NEG: "A−",
    B_POS: "B+",
    B_NEG: "B−",
    AB_POS: "AB+",
    AB_NEG: "AB−",
    O_POS: "O+",
    O_NEG: "O−",
    UNKNOWN: "—",
  };
  return map[code] ?? code;
}

export default function WorkforceEmploymentsPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceEmployments");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<EmploymentRow[]>([]);
  const [persons, setPersons] = useState<ListResponse["persons"]>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);
  const [actionEmp, setActionEmp] = useState<EmploymentRow | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferOrgUnitId, setTransferOrgUnitId] = useState("");
  const [transferPositionId, setTransferPositionId] = useState("");
  const [cardOpen, setCardOpen] = useState(false);
  const [moreMenuId, setMoreMenuId] = useState<string | null>(null);

  const [globalPersonId, setGlobalPersonId] = useState("");
  const [resolveFin, setResolveFin] = useState("");
  const [resolveName, setResolveName] = useState("");
  const [resolveSex, setResolveSex] = useState("UNKNOWN");
  const [resolveBirthDate, setResolveBirthDate] = useState("");
  const [resolveBlood, setResolveBlood] = useState("");
  const [resolvedLabel, setResolvedLabel] = useState<string | null>(null);
  const [orgUnitId, setOrgUnitId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [orgUnits, setOrgUnits] = useState<OrgUnitOpt[]>([]);
  const [positions, setPositions] = useState<PositionOpt[]>([]);
  const [hireDate, setHireDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [notEntitled, setNotEntitled] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [satelliteKeys, setSatelliteKeys] = useState<string[]>([]);

  // Employee card fields
  const [cardName, setCardName] = useState("");
  const [cardSex, setCardSex] = useState("UNKNOWN");
  const [cardBirthDate, setCardBirthDate] = useState("");
  const [cardPhone, setCardPhone] = useState("");
  const [cardBlood, setCardBlood] = useState("UNKNOWN");
  const [cardOrgUnitId, setCardOrgUnitId] = useState("");
  const [cardPositionId, setCardPositionId] = useState("");

  const [filterText, setFilterText] = useState("");
  const [filterOrgUnitId, setFilterOrgUnitId] = useState(
    () => searchParams.get("orgUnitId") ?? "",
  );
  const [filterPositionId, setFilterPositionId] = useState(
    () => searchParams.get("positionId") ?? "",
  );
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSatellite, setFilterSatellite] = useState("");
  const [filterSex, setFilterSex] = useState("");
  const [filterAge, setFilterAge] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE);

  useEffect(() => {
    const ou = searchParams.get("orgUnitId");
    const pos = searchParams.get("positionId");
    if (ou != null) setFilterOrgUnitId(ou);
    if (pos != null) setFilterPositionId(pos);
  }, [searchParams]);

  const sexOptions = useMemo(
    () =>
      SEX_VALUES.map((v) => ({
        value: v,
        label:
          v === "MALE"
            ? t("sexMale")
            : v === "FEMALE"
              ? t("sexFemale")
              : t("sexUnknown"),
      })),
    [t],
  );

  const bloodOptions = useMemo(
    () =>
      BLOOD_VALUES.map((v) => ({
        value: v,
        label: v === "UNKNOWN" ? t("bloodUnknown") : bloodLabel(v),
      })),
    [t],
  );

  const ageOptions = useMemo(
    () => AGE_BUCKETS.map((b) => ({ value: b, label: b })),
    [],
  );

  const orgUnitOptions = useMemo(
    () => orgUnits.map((u) => ({ value: u.id, label: u.name })),
    [orgUnits],
  );

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
      const body = (await res.json().catch(() => null)) as {
        code?: string;
      } | null;
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
    const res = await workforceFetch("scope/bootstrap", {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await load();
  }

  const activePositions = useMemo(
    () => positions.filter((p) => (p.status ?? "ACTIVE") === "ACTIVE"),
    [positions],
  );

  const filteredPositions = activePositions.filter(
    (p) => !orgUnitId || p.orgUnitId === orgUnitId,
  );

  const filterPositionOptions = activePositions.filter(
    (p) => !filterOrgUnitId || p.orgUnitId === filterOrgUnitId,
  );

  const cardPositionOptions = activePositions.filter(
    (p) => !cardOrgUnitId || p.orgUnitId === cardOrgUnitId,
  );

  const transferPositionOptions = activePositions.filter(
    (p) => p.orgUnitId === transferOrgUnitId,
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
      const person = persons[r.globalPersonId];
      if (filterSex) {
        if ((person?.sex ?? "UNKNOWN") !== filterSex) return false;
      }
      if (filterAge) {
        const bucket = ageBucket(ageInBaku(person?.birthDate));
        if (bucket !== filterAge) return false;
      }
      if (q) {
        const name = (person?.displayName ?? "").toLowerCase();
        const fin = (person?.finMasked ?? "").toLowerCase();
        if (
          !name.includes(q) &&
          !fin.includes(q) &&
          !r.globalPersonId.toLowerCase().includes(q)
        ) {
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
    filterSex,
    filterAge,
  ]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [
    filterText,
    filterOrgUnitId,
    filterPositionId,
    filterStatus,
    filterSatellite,
    filterSex,
    filterAge,
  ]);

  function formatSex(sex: string | null | undefined): string {
    if (!sex || sex === "UNKNOWN") return t("sexUnknown");
    if (sex === "MALE") return t("sexMale");
    if (sex === "FEMALE") return t("sexFemale");
    return sex;
  }

  function formatStatus(status: string): string {
    if (status === "ACTIVE") return t("statusActive");
    if (status === "TERMINATED") return t("statusTerminated");
    return status;
  }

  function openHire() {
    setResolveFin("");
    setResolveName("");
    setResolveSex("UNKNOWN");
    setResolveBirthDate("");
    setResolveBlood("");
    setGlobalPersonId("");
    setResolvedLabel(null);
    setPositionId("");
    setHireDate(new Date().toISOString().slice(0, 10));
    setSatelliteKeys([]);
    setModalError(null);
    setHireOpen(true);
  }

  async function onResolvePerson() {
    if (busy || !resolveFin.trim() || !resolveName.trim()) return;
    setBusy(true);
    setModalError(null);
    const res = await mdmWorkforceFetch("workforce-resolve", {
      method: "POST",
      body: JSON.stringify({
        fin: resolveFin.trim(),
        fullName: resolveName.trim(),
        sex: resolveSex || undefined,
        birthDate: resolveBirthDate || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setModalError(await res.text());
      return;
    }
    const data = (await res.json()) as {
      globalPersonId: string;
      opsProfile?: {
        displayName?: string | null;
        primaryIdentifierMasked?: string | null;
      };
    };
    setGlobalPersonId(data.globalPersonId);
    setResolvedLabel(
      data.opsProfile?.displayName
        ? `${data.opsProfile.displayName} (${data.opsProfile.primaryIdentifierMasked ?? "—"})`
        : data.globalPersonId.slice(0, 8),
    );

    if (resolveBlood && resolveBlood !== "UNKNOWN") {
      const hrRes = await mdmWorkforceFetch(
        `${data.globalPersonId}/hr-profile`,
        {
          method: "PATCH",
          body: JSON.stringify({ bloodGroup: resolveBlood }),
        },
      );
      if (!hrRes.ok) {
        setModalError(await hrRes.text());
      }
    }
  }

  async function onHire(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !globalPersonId.trim() || !orgUnitId || !positionId) return;
    setBusy(true);
    setModalError(null);
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
      setModalError(await res.text());
      setBusy(false);
      return;
    }
    setGlobalPersonId("");
    setSatelliteKeys([]);
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
    if (!window.confirm(t("reprovisionConfirm"))) return;
    setMoreMenuId(null);
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
    setModalError(null);
    const res = await workforceFetch(`employments/${actionEmp.id}/transfer`, {
      method: "PATCH",
      body: JSON.stringify({
        orgUnitId: transferOrgUnitId,
        positionId: transferPositionId,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setModalError(await res.text());
      return;
    }
    setTransferOpen(false);
    setActionEmp(null);
    await load();
  }

  async function openEmployeeCard(emp: EmploymentRow) {
    setActionEmp(emp);
    setModalError(null);
    setCardOpen(true);
    setBusy(true);
    const person = persons[emp.globalPersonId];
    setCardName(person?.displayName ?? "");
    setCardSex(person?.sex ?? "UNKNOWN");
    setCardBirthDate(person?.birthDate ?? "");
    setCardPhone("");
    setCardBlood("UNKNOWN");
    setCardOrgUnitId(emp.orgUnitId ?? emp.orgUnit?.id ?? "");
    setCardPositionId(emp.positionId ?? emp.position?.id ?? "");

    const [opsRes, hrRes] = await Promise.all([
      mdmWorkforceFetch(`${emp.globalPersonId}/ops-profile`),
      mdmWorkforceFetch(`${emp.globalPersonId}/hr-profile`),
    ]);
    setBusy(false);
    if (opsRes.ok) {
      const ops = (await opsRes.json()) as {
        fullName?: string | null;
        sex?: string | null;
        birthDate?: string | null;
        phoneMasked?: string | null;
      };
      if (ops.fullName) setCardName(ops.fullName);
      if (ops.sex) setCardSex(ops.sex);
      if (ops.birthDate) setCardBirthDate(ops.birthDate);
      // phoneMasked is display-only; leave editable phone empty unless user re-enters
      if (ops.phoneMasked) setCardPhone("");
    }
    if (hrRes.ok) {
      const hr = (await hrRes.json()) as {
        accessDenied?: boolean;
        hrProfile?: { bloodGroup?: string | null } | null;
      };
      if (!hr.accessDenied && hr.hrProfile?.bloodGroup) {
        setCardBlood(hr.hrProfile.bloodGroup);
      }
    } else if (!opsRes.ok) {
      setModalError(await hrRes.text().catch(() => t("cardLoadFailed")));
    }
  }

  async function saveEmployeeCard(e: React.FormEvent) {
    e.preventDefault();
    if (!actionEmp || !cardName.trim()) return;
    setBusy(true);
    setModalError(null);

    const resolveRes = await mdmWorkforceFetch("workforce-resolve", {
      method: "POST",
      body: JSON.stringify({
        globalPersonId: actionEmp.globalPersonId,
        fullName: cardName.trim(),
        sex: cardSex || undefined,
        birthDate: cardBirthDate || undefined,
        phone: cardPhone.trim() || undefined,
      }),
    });
    if (!resolveRes.ok) {
      setModalError(await resolveRes.text());
      setBusy(false);
      return;
    }

    const hrRes = await mdmWorkforceFetch(
      `${actionEmp.globalPersonId}/hr-profile`,
      {
        method: "PATCH",
        body: JSON.stringify({
          bloodGroup: cardBlood || "UNKNOWN",
        }),
      },
    );
    if (!hrRes.ok) {
      setModalError(await hrRes.text());
      setBusy(false);
      return;
    }

    const nextOrg = cardOrgUnitId;
    const nextPos = cardPositionId;
    const curOrg = actionEmp.orgUnitId ?? actionEmp.orgUnit?.id ?? "";
    const curPos = actionEmp.positionId ?? actionEmp.position?.id ?? "";
    if (
      actionEmp.status === "ACTIVE" &&
      nextOrg &&
      nextPos &&
      (nextOrg !== curOrg || nextPos !== curPos)
    ) {
      const transferRes = await workforceFetch(
        `employments/${actionEmp.id}/transfer`,
        {
          method: "PATCH",
          body: JSON.stringify({
            orgUnitId: nextOrg,
            positionId: nextPos,
          }),
        },
      );
      if (!transferRes.ok) {
        setModalError(await transferRes.text());
        setBusy(false);
        return;
      }
    }

    setCardOpen(false);
    setActionEmp(null);
    await load();
    setBusy(false);
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
  if (!user?.organizationId && !orgIdFromToken(getOrchAccessToken())) {
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
        <CatalogField
          kind="ENTITY_REF"
          label={t("filterOrgUnit")}
          value={filterOrgUnitId}
          onChange={(next) => {
            setFilterOrgUnitId(String(next));
            setFilterPositionId("");
          }}
          options={orgUnitOptions}
          emptyLabel={t("filterAll")}
        />
        <CatalogField
          kind="ENTITY_REF"
          label={t("filterPosition")}
          value={filterPositionId}
          onChange={(next) => setFilterPositionId(String(next))}
          options={filterPositionOptions.map((p) => ({
            value: p.id,
            label: p.name,
          }))}
          emptyLabel={t("filterAll")}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("filterSex")}
          value={filterSex}
          onChange={(next) => setFilterSex(String(next))}
          options={sexOptions}
          emptyLabel={t("filterAll")}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("filterAge")}
          value={filterAge}
          onChange={(next) => setFilterAge(String(next))}
          options={ageOptions}
          emptyLabel={t("filterAll")}
        />
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

      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : filteredRows.length === 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} p-4 text-sm text-[#7F8C8D]`}>
          {t("empty")}
        </div>
      ) : (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPerson")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colFinMasked")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colSex")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colBirthDate")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colOrgUnit")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPosition")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colHireDate")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => {
                const hasBindings = (r.roleBindings?.length ?? 0) > 0;
                return (
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
                    <td className={DATA_TABLE_TD_CLASS}>
                      {formatSex(persons[r.globalPersonId]?.sex)}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} tabular-nums`}>
                      {persons[r.globalPersonId]?.birthDate ?? "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {r.orgUnit?.name ?? "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {r.position?.name ?? "—"}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} tabular-nums`}>
                      {String(r.hireDate).slice(0, 10)}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {formatStatus(r.status)}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="relative flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          title={t("editCard")}
                          aria-label={t("editCard")}
                          disabled={busy}
                          onClick={() => void openEmployeeCard(r)}
                        >
                          <Pencil className="h-4 w-4 text-[#2980B9]" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          title={t("transfer")}
                          aria-label={t("transfer")}
                          disabled={busy || r.status === "TERMINATED"}
                          onClick={() => {
                            setActionEmp(r);
                            setTransferOrgUnitId(
                              r.orgUnitId ?? r.orgUnit?.id ?? "",
                            );
                            setTransferPositionId(
                              r.positionId ?? r.position?.id ?? "",
                            );
                            setModalError(null);
                            setTransferOpen(true);
                          }}
                        >
                          <ArrowRightLeft
                            className="h-4 w-4 text-[#2980B9]"
                            aria-hidden
                          />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          title={t("terminate")}
                          aria-label={t("terminate")}
                          disabled={busy || r.status === "TERMINATED"}
                          onClick={() => void terminateEmployment(r)}
                        >
                          <UserMinus
                            className="h-4 w-4 text-[#C0392B]"
                            aria-hidden
                          />
                        </button>
                        {hasBindings ? (
                          <div className="relative">
                            <button
                              type="button"
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              title={t("moreActions")}
                              aria-label={t("moreActions")}
                              disabled={busy}
                              onClick={() =>
                                setMoreMenuId((id) =>
                                  id === r.id ? null : r.id,
                                )
                              }
                            >
                              <MoreHorizontal
                                className="h-4 w-4 text-[#7F8C8D]"
                                aria-hidden
                              />
                            </button>
                            {moreMenuId === r.id ? (
                              <div className="absolute right-0 z-10 mt-1 min-w-[10rem] rounded-lg border border-[#D5DADF] bg-white py-1 shadow-md">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#34495E] hover:bg-[#F4F6F7]"
                                  disabled={busy}
                                  onClick={() => void reprovisionEmployment(r)}
                                >
                                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                                  {t("reprovision")}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
          <div className="grid gap-3 sm:grid-cols-2">
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("fieldSex")}
              value={resolveSex}
              onChange={(next) => setResolveSex(String(next))}
              options={sexOptions}
              emptyLabel={null}
            />
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("fieldBirthDate")}
              <input
                type="date"
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                value={resolveBirthDate}
                onChange={(e) => setResolveBirthDate(e.target.value)}
              />
            </label>
          </div>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("fieldBloodGroup")}
            value={resolveBlood}
            onChange={(next) => setResolveBlood(String(next))}
            options={bloodOptions}
            emptyLabel={t("bloodOptional")}
            hint={t("bloodOptionalHint")}
          />
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
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 font-mono text-[13px]"
              value={globalPersonId}
              readOnly
              placeholder={t("resolveFirst")}
              required
            />
            {resolvedLabel ? (
              <span className="mt-1 block text-xs text-[#27AE60]">
                {resolvedLabel}
              </span>
            ) : null}
          </label>
          <CatalogField
            kind="ENTITY_REF"
            label={t("orgUnit")}
            value={orgUnitId}
            onChange={(next) => {
              setOrgUnitId(String(next));
              setPositionId("");
            }}
            options={orgUnitOptions}
            required
            emptyLabel={t("selectOrgUnit")}
            disabled={orgUnits.length === 0}
          />
          <CatalogField
            kind="ENTITY_REF"
            label={t("position")}
            value={positionId}
            onChange={(next) => setPositionId(String(next))}
            options={filteredPositions.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            required
            emptyLabel={t("selectPosition")}
            disabled={filteredPositions.length === 0}
          />
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
            <p className="mb-2 text-xs text-[#7F8C8D]">
              {t("satelliteAccessHint")}
            </p>
            <div className="flex flex-wrap gap-4">
              {SATELLITE_OPTIONS.map((s) => (
                <label
                  key={s.key}
                  className="flex items-center gap-2 text-xs text-[#34495E]"
                >
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
          {modalError && hireOpen ? (
            <p className="text-sm text-red-700">{modalError}</p>
          ) : null}
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
          <CatalogField
            kind="ENTITY_REF"
            label={t("orgUnit")}
            value={transferOrgUnitId}
            onChange={(next) => {
              setTransferOrgUnitId(String(next));
              setTransferPositionId("");
            }}
            options={orgUnitOptions}
            required
            emptyLabel={t("selectOrgUnit")}
          />
          <CatalogField
            kind="ENTITY_REF"
            label={t("position")}
            value={transferPositionId}
            onChange={(next) => setTransferPositionId(String(next))}
            options={transferPositionOptions.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            required
            emptyLabel={t("selectPosition")}
          />
          {modalError && transferOpen ? (
            <p className="text-sm text-red-700">{modalError}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setTransferOpen(false)}
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
            >
              {t("transfer")}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={cardOpen}
        title={t("cardTitle")}
        subtitle={t("cardSubtitle")}
        onClose={() => !busy && setCardOpen(false)}
        closeLabel={tCommon("close")}
      >
        <form
          onSubmit={(e) => void saveEmployeeCard(e)}
          className="grid gap-4"
        >
          <fieldset className="grid gap-3 rounded-lg border border-[#D5DADF] p-3">
            <legend className="px-1 text-xs font-semibold text-[#34495E]">
              {t("cardIdentity")}
            </legend>
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("resolveFullName")}
              <input
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                required
              />
            </label>
            <p className="text-xs text-[#7F8C8D]">
              {t("colFinMasked")}:{" "}
              {actionEmp
                ? (persons[actionEmp.globalPersonId]?.finMasked ?? "—")
                : "—"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("fieldSex")}
                value={cardSex}
                onChange={(next) => setCardSex(String(next))}
                options={sexOptions}
                emptyLabel={null}
              />
              <label className="block text-[13px] font-medium text-[#34495E]">
                {t("fieldBirthDate")}
                <input
                  type="date"
                  className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                  value={cardBirthDate}
                  onChange={(e) => setCardBirthDate(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("fieldPhone")}
              <input
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                value={cardPhone}
                onChange={(e) => setCardPhone(e.target.value)}
                placeholder="+994…"
              />
            </label>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("fieldBloodGroup")}
              value={cardBlood}
              onChange={(next) => setCardBlood(String(next))}
              options={bloodOptions}
              emptyLabel={null}
            />
          </fieldset>

          <fieldset className="grid gap-3 rounded-lg border border-[#D5DADF] p-3">
            <legend className="px-1 text-xs font-semibold text-[#34495E]">
              {t("cardEmployment")}
            </legend>
            <p className="text-xs text-[#7F8C8D]">
              {t("hireDate")}:{" "}
              {actionEmp ? String(actionEmp.hireDate).slice(0, 10) : "—"}
            </p>
            <CatalogField
              kind="ENTITY_REF"
              label={t("orgUnit")}
              value={cardOrgUnitId}
              onChange={(next) => {
                setCardOrgUnitId(String(next));
                setCardPositionId("");
              }}
              options={orgUnitOptions}
              emptyLabel={t("selectOrgUnit")}
              disabled={actionEmp?.status === "TERMINATED"}
            />
            <CatalogField
              kind="ENTITY_REF"
              label={t("position")}
              value={cardPositionId}
              onChange={(next) => setCardPositionId(String(next))}
              options={cardPositionOptions.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
              emptyLabel={t("selectPosition")}
              disabled={actionEmp?.status === "TERMINATED"}
            />
            <p className="text-xs text-[#7F8C8D]">
              <Link
                href="/workspace/workforce/security"
                className="text-[#2980B9] hover:underline"
              >
                {t("goSecurity")}
              </Link>
              {" — "}
              {t("cardSatellitesHint")}
            </p>
          </fieldset>

          {modalError && cardOpen ? (
            <p className="text-sm text-red-700">{modalError}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setCardOpen(false)}
              disabled={busy}
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || !cardName.trim()}
            >
              {busy ? t("busy") : tCommon("save")}
            </button>
          </div>
        </form>
      </ModalShell>
    </>
  );
}
