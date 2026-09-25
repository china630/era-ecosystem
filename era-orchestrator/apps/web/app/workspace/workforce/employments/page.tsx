"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRightLeft,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  UserMinus,
} from "lucide-react";
import {
  isPatronymicParticle,
  splitFullNameToParts,
} from "@era/satellite-kit/integration/person-name";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DatePicker,
  DEFAULT_LIST_PAGE_SIZE,
  EraListFilterBar,
  EraListWorkspace,
  LIST_PAGE_SHELL_CLASS,
  ListPaginationFooter,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { bakuDateDisplay, todayBakuYmd } from "@era/satellite-kit/time";
import { getOrchAccessToken, orchFetch } from "../../../../lib/orch-api";
import { useSubscription } from "../../../../lib/subscription-context";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  mdmWorkforceFetch,
  orgIdFromToken,
  parseWorkforceApiError,
  workforceFetch,
} from "../../../../lib/workforce-fetch";
import {
  WORKFORCE_UI_SATELLITES,
  humanizeSatelliteRole,
  satelliteLoginHref,
} from "../../../../lib/workforce-satellites";
import { WorkforceConfirmDialog } from "../../../../components/workspace/workforce-confirm-dialog";

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
  roleBindings?: Array<{
    satelliteKey: string;
    satelliteRole?: string;
    provisionState?: string;
    lastProvisionError?: string | null;
  }>;
  satelliteStaffLogin?: string | null;
  satelliteStaffPin?: string | null;
};

type PersonnelOrderRef = {
  id: string;
  type: string;
  status: string;
  orderNumber: string;
  employmentId?: string | null;
};

type ListResponse = {
  items: EmploymentRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  draftOrdersByEmployment?: Record<
    string,
    Array<{ id: string; type: string; orderNumber: string }>
  >;
  persons: Record<
    string,
    {
      globalPersonId: string;
      displayName: string | null;
      firstName?: string | null;
      middleName?: string | null;
      lastName?: string | null;
      finMasked?: string | null;
      accessDenied: boolean;
      sex?: string | null;
      birthDate?: string | null;
    }
  >;
};

function staffLoginFromEmploymentId(employmentId: string): string {
  const staffCode = employmentId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `emp-${staffCode.toLowerCase()}`;
}

function displayStaffLogin(emp: EmploymentRow): string {
  return emp.satelliteStaffLogin?.trim() || staffLoginFromEmploymentId(emp.id);
}

function latinizeLoginToken(raw: string): string {
  const az: Record<string, string> = {
    ə: "e",
    ı: "i",
    ö: "o",
    ü: "u",
    ç: "c",
    ş: "s",
    ğ: "g",
  };
  return raw
    .toLowerCase()
    .replace(/[əıöüçşğ]/g, (ch) => az[ch] ?? ch)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function suggestStaffLogin(lastName: string, firstName: string): string {
  const last = latinizeLoginToken(lastName);
  const first = latinizeLoginToken(firstName);
  if (last && first) return `${last}.${first}`.slice(0, 64);
  return (last || first).slice(0, 64);
}

function looksMaskedContact(value: string | null | undefined): boolean {
  return Boolean(value?.includes("*"));
}

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

const FIELD_INPUT_CLASS =
  "mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]";
const ZONE_CLASS = "grid min-w-0 gap-3 rounded-lg border border-[#D5DADF] p-3";
const ROW3_CLASS = "grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3";
const ROW2_CLASS = "grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2";
const REQ_STAR = <span className="text-[#E74C3C]"> *</span>;

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
  const tSys = useTranslations("workspace.systems");
  const tOrders = useTranslations("workforceOrders");

  const satelliteLabel = useCallback(
    (key: string): string => {
      const found = WORKFORCE_UI_SATELLITES.find((s) => s.key === key);
      return found ? tSys(`${found.i18n}.title` as "clinic.title") : key;
    },
    [tSys],
  );

  const satelliteFilterOptions = useMemo(
    () =>
      WORKFORCE_UI_SATELLITES.map((s) => ({
        key: s.key,
        label: satelliteLabel(s.key),
      })),
    [satelliteLabel],
  );
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<EmploymentRow[]>([]);
  const [persons, setPersons] = useState<ListResponse["persons"]>({});
  const [draftOrdersByEmployment, setDraftOrdersByEmployment] = useState<
    NonNullable<ListResponse["draftOrdersByEmployment"]>
  >({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);
  const [actionEmp, setActionEmp] = useState<EmploymentRow | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferOrgUnitId, setTransferOrgUnitId] = useState("");
  const [transferPositionId, setTransferPositionId] = useState("");
  const [cardOpen, setCardOpen] = useState(false);
  const [moreMenuId, setMoreMenuId] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmp, setLoginEmp] = useState<EmploymentRow | null>(null);
  const [loginCopied, setLoginCopied] = useState(false);
  const [orgCopied, setOrgCopied] = useState(false);
  const [loginEditLogin, setLoginEditLogin] = useState("");
  const [loginEditPin, setLoginEditPin] = useState("");
  const [loginEditSatelliteKeys, setLoginEditSatelliteKeys] = useState<string[]>([]);
  const [loginModalError, setLoginModalError] = useState<string | null>(null);

  const { snapshot: subscriptionSnapshot } = useSubscription();
  const workspaceOrgNo =
    subscriptionSnapshot?.publicOrgNumber != null
      ? String(subscriptionSnapshot.publicOrgNumber)
      : "";


  useEffect(() => {
    if (!moreMenuId) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      if (el?.closest("[data-employment-more-menu]")) return;
      setMoreMenuId(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [moreMenuId]);

  const [globalPersonId, setGlobalPersonId] = useState("");
  const [resolveFin, setResolveFin] = useState("");
  const [resolveFirstName, setResolveFirstName] = useState("");
  const [resolveMiddleName, setResolveMiddleName] = useState("");
  const [resolveLastName, setResolveLastName] = useState("");
  const [resolveSex, setResolveSex] = useState("");
  const [resolveBirthDate, setResolveBirthDate] = useState("");
  const [resolveBlood, setResolveBlood] = useState("");
  const [resolvedLabel, setResolvedLabel] = useState<string | null>(null);
  const [hireFinMasked, setHireFinMasked] = useState<string | null>(null);
  const [orgUnitId, setOrgUnitId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [orgUnits, setOrgUnits] = useState<OrgUnitOpt[]>([]);
  const [positions, setPositions] = useState<PositionOpt[]>([]);
  const [hireDate, setHireDate] = useState(() => todayBakuYmd());
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [notEntitled, setNotEntitled] = useState(false);
  const [satelliteKeys, setSatelliteKeys] = useState<string[]>([]);
  const [hireLogin, setHireLogin] = useState("");
  const [hirePin, setHirePin] = useState("");
  const [hirePhone, setHirePhone] = useState("");
  const [hireEmail, setHireEmail] = useState("");
  const [hireAddress, setHireAddress] = useState("");
  const [hireGrantAccess, setHireGrantAccess] = useState(false);
  const [hireLoginDirty, setHireLoginDirty] = useState(false);
  const [mdmSearchBusy, setMdmSearchBusy] = useState(false);
  const [orderBridge, setOrderBridge] = useState<PersonnelOrderRef | null>(null);
  const [orderBridgeBusy, setOrderBridgeBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<
    | null
    | { kind: "hireWithoutFin" }
    | { kind: "terminate"; emp: EmploymentRow }
    | { kind: "reprovision"; emp: EmploymentRow }
  >(null);
  const [dualVoenBanner, setDualVoenBanner] = useState<{
    globalPersonId: string;
    holdingId: string | null;
    orgNames: string[];
  } | null>(null);
  const deepLinkKeyRef = useRef<string | null>(null);

  // Employee card fields
  const [cardFirstName, setCardFirstName] = useState("");
  const [cardMiddleName, setCardMiddleName] = useState("");
  const [cardLastName, setCardLastName] = useState("");
  const [cardSex, setCardSex] = useState("");
  const [cardBirthDate, setCardBirthDate] = useState("");
  const [cardPhone, setCardPhone] = useState("");
  const [cardEmail, setCardEmail] = useState("");
  const [cardBlood, setCardBlood] = useState("");
  const [cardAddress, setCardAddress] = useState("");
  const [cardFinMasked, setCardFinMasked] = useState("");
  const [cardPhoneMasked, setCardPhoneMasked] = useState("");
  const [cardEmailMasked, setCardEmailMasked] = useState("");
  const [cardGrantAccess, setCardGrantAccess] = useState(false);
  const [cardLogin, setCardLogin] = useState("");
  const [cardPin, setCardPin] = useState("");
  const [cardLoginDirty, setCardLoginDirty] = useState(false);
  const [cardSatelliteKeys, setCardSatelliteKeys] = useState<string[]>([]);
  const [cardOrders, setCardOrders] = useState<PersonnelOrderRef[]>([]);

  useEffect(() => {
    if (!hireOpen || !hireGrantAccess || hireLoginDirty) return;
    const suggested = suggestStaffLogin(resolveLastName, resolveFirstName);
    if (suggested) setHireLogin(suggested);
  }, [
    hireOpen,
    hireGrantAccess,
    hireLoginDirty,
    resolveFirstName,
    resolveLastName,
  ]);

  useEffect(() => {
    if (!cardOpen || !cardGrantAccess || cardLoginDirty) return;
    if (actionEmp?.satelliteStaffLogin?.trim()) return;
    const suggested = suggestStaffLogin(cardLastName, cardFirstName);
    if (suggested) setCardLogin(suggested);
  }, [
    cardOpen,
    cardGrantAccess,
    cardLoginDirty,
    cardFirstName,
    cardLastName,
    actionEmp,
  ]);

  const [filterText, setFilterText] = useState("");
  const debouncedFilterText = useDebouncedValue(filterText, 300);
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
  const [serverTotal, setServerTotal] = useState(0);

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
      await workforceFetch("scope/bootstrap", { method: "POST", body: "{}" });
      const retry = await workforceFetch("org-units");
      if (!retry.ok) {
        setOrgUnits([]);
        return;
      }
      const u = (await retry.json()) as { items: OrgUnitOpt[] };
      const active = (u.items ?? []).filter((x) => x.status === "ACTIVE");
      setOrgUnits(active);
      return;
    }
    }
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
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (filterStatus) qs.set("status", filterStatus);
    if (filterOrgUnitId) qs.set("orgUnitId", filterOrgUnitId);
    if (filterPositionId) qs.set("positionId", filterPositionId);
    if (filterSatellite) qs.set("satelliteKey", filterSatellite);
    const q = debouncedFilterText.trim();
    if (q) qs.set("q", q);
    if (filterSex) qs.set("sex", filterSex);
    if (filterAge) qs.set("ageBucket", filterAge);
    const res = await workforceFetch(`employments?${qs}`);
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
    setDraftOrdersByEmployment(data.draftOrdersByEmployment ?? {});
    setServerTotal(typeof data.total === "number" ? data.total : (data.items ?? []).length);
    setLoading(false);
  }, [
    loadRefs,
    page,
    pageSize,
    filterStatus,
    filterOrgUnitId,
    filterPositionId,
    filterSatellite,
    debouncedFilterText,
    filterSex,
    filterAge,
  ]);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

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

  const transferPositionOptions = activePositions.filter(
    (p) => p.orgUnitId === transferOrgUnitId,
  );

  const pagedRows = rows;
  const listTotal = serverTotal;

  useEffect(() => {
    setPage(1);
  }, [
    debouncedFilterText,
    filterOrgUnitId,
    filterPositionId,
    filterStatus,
    filterSatellite,
    filterSex,
    filterAge,
    pageSize,
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

  function openTransfer(emp: EmploymentRow) {
    setActionEmp(emp);
    setTransferOrgUnitId(emp.orgUnitId ?? emp.orgUnit?.id ?? "");
    setTransferPositionId(emp.positionId ?? emp.position?.id ?? "");
    setModalError(null);
    setCardOpen(false);
    setTransferOpen(true);
  }

  async function describeWorkforceError(res: Response): Promise<string> {
    const err = await parseWorkforceApiError(res);
    if (err.code === "LOGIN_TAKEN") return t("loginTaken");
    if (err.code === "LOGIN_REQUIRES_BINDING") return t("loginRequiresBinding");
    return err.message;
  }

  function openHire() {
    setResolveFin("");
    setResolveFirstName("");
    setResolveMiddleName("");
    setResolveLastName("");
    setResolveSex("");
    setResolveBirthDate("");
    setResolveBlood("");
    setGlobalPersonId("");
    setResolvedLabel(null);
    setHireFinMasked(null);
    setPositionId("");
    setHireDate(todayBakuYmd());
    setSatelliteKeys([]);
    setHireLogin("");
    setHirePin("");
    setHirePhone("");
    setHireEmail("");
    setHireAddress("");
    setHireGrantAccess(false);
    setHireLoginDirty(false);
    setModalError(null);
    setHireOpen(true);
  }

  /** Deep-link from group person card: hire=1&globalPersonId= */
  async function openHireForPerson(personId: string) {
    setResolveFin("");
    setResolveFirstName("");
    setResolveMiddleName("");
    setResolveLastName("");
    setResolveSex("");
    setResolveBirthDate("");
    setResolveBlood("");
    setGlobalPersonId(personId);
    setResolvedLabel(null);
    setHireFinMasked(null);
    setPositionId("");
    setHireDate(todayBakuYmd());
    setSatelliteKeys([]);
    setHireLogin("");
    setHirePin("");
    setHirePhone("");
    setHireEmail("");
    setHireAddress("");
    setHireGrantAccess(false);
    setHireLoginDirty(false);
    setModalError(null);
    setHireOpen(true);
    const opsRes = await mdmWorkforceFetch(`${personId}/ops-profile`);
    if (opsRes.ok) {
      const ops = (await opsRes.json()) as {
        displayName?: string | null;
        firstName?: string | null;
        middleName?: string | null;
        lastName?: string | null;
        sex?: string | null;
        birthDate?: string | null;
        finMasked?: string | null;
        primaryIdentifierMasked?: string | null;
      };
      if (ops.firstName) setResolveFirstName(ops.firstName);
      if (ops.middleName) setResolveMiddleName(ops.middleName);
      if (ops.lastName) setResolveLastName(ops.lastName);
      if (ops.sex && ops.sex !== "UNKNOWN") setResolveSex(ops.sex);
      if (ops.birthDate) setResolveBirthDate(ops.birthDate.slice(0, 10));
      const fin =
        ops.finMasked?.trim() ||
        ops.primaryIdentifierMasked?.trim() ||
        null;
      setHireFinMasked(fin && fin !== "—" ? fin : null);
      const label =
        ops.displayName?.trim() ||
        [ops.firstName, ops.lastName].filter(Boolean).join(" ").trim() ||
        tCommon("unnamedPerson");
      setResolvedLabel(label);
    } else {
      setResolvedLabel(tCommon("unnamedPerson"));
    }
  }

  type MdmLookupHit = {
    found: boolean;
    masked?: boolean;
    globalPersonId?: string;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    phone?: string | null;
    email?: string | null;
    sex?: string | null;
    birthDate?: string | null;
  };

  function applyLookupHit(hit: MdmLookupHit) {
    if (!hit.found || !hit.globalPersonId) return;
    setGlobalPersonId(hit.globalPersonId);
    if (hit.masked) {
      setResolvedLabel(t("maskedPerson"));
      return;
    }
    if (hit.firstName) setResolveFirstName(hit.firstName);
    if (hit.middleName) setResolveMiddleName(hit.middleName);
    if (hit.lastName) setResolveLastName(hit.lastName);
    if (hit.sex && hit.sex !== "UNKNOWN") setResolveSex(hit.sex);
    if (hit.birthDate) setResolveBirthDate(String(hit.birthDate).slice(0, 10));
    if (hit.phone && !looksMaskedContact(hit.phone)) setHirePhone(hit.phone);
    if (hit.email && !looksMaskedContact(hit.email)) setHireEmail(hit.email);
    const label =
      [hit.firstName, hit.lastName].filter(Boolean).join(" ").trim() ||
      hit.fullName?.trim() ||
      tCommon("unnamedPerson");
    setResolvedLabel(label);
  }

  async function searchMdmByFin() {
    const fin = resolveFin.trim().toUpperCase();
    if (!fin) {
      setModalError(t("mdmFinRequired"));
      return;
    }
    setMdmSearchBusy(true);
    setModalError(null);
    setResolvedLabel(null);
    const first = await mdmWorkforceFetch("lookup-by-fin", {
      method: "POST",
      body: JSON.stringify({ fin, purpose: "workforce_hire" }),
    });
    if (!first.ok) {
      setModalError(await describeWorkforceError(first));
      setMdmSearchBusy(false);
      return;
    }
    let hit = (await first.json()) as MdmLookupHit;
    if (!hit.found) {
      setGlobalPersonId("");
      setHireFinMasked(null);
      setResolvedLabel(t("mdmNotFound"));
      setMdmSearchBusy(false);
      return;
    }
    if (hit.globalPersonId && hit.masked) {
      await mdmWorkforceFetch(`${hit.globalPersonId}/access-grant`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const again = await mdmWorkforceFetch("lookup-by-fin", {
        method: "POST",
        body: JSON.stringify({ fin, purpose: "workforce_hire" }),
      });
      if (again.ok) hit = (await again.json()) as MdmLookupHit;
    }
    applyLookupHit(hit);
    setMdmSearchBusy(false);
  }

  // Consume ?hire=1&globalPersonId= / ?employmentId= / ?login=1 once rows are ready.
  useEffect(() => {
    if (!ready || loading) return;
    const hireFlag = searchParams.get("hire");
    const gpid = searchParams.get("globalPersonId");
    const empId = searchParams.get("employmentId");
    const loginFlag = searchParams.get("login");
    const key = `${hireFlag}|${gpid}|${empId}|${loginFlag}`;
    if (!hireFlag && !empId) return;
    if (deepLinkKeyRef.current === key) return;

    if (hireFlag === "1" && gpid?.trim()) {
      deepLinkKeyRef.current = key;
      void openHireForPerson(gpid.trim());
      return;
    }
    if (!empId?.trim()) return;
    const emp = rows.find((r) => r.id === empId.trim());
    if (!emp) return;
    deepLinkKeyRef.current = key;
    if (loginFlag === "1" && emp.status !== "TERMINATED") {
      setLoginEmp(emp);
      setLoginEditLogin(displayStaffLogin(emp));
      setLoginEditPin("");
      setLoginEditSatelliteKeys([
        ...new Set(
          (emp.roleBindings ?? [])
            .map((b) => b.satelliteKey)
            .filter(Boolean),
        ),
      ]);
      setLoginModalError(null);
      setLoginCopied(false);
      setLoginOpen(true);
      return;
    }
    void openEmployeeCard(emp);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot deep-link
  }, [ready, loading, rows, searchParams]);

  async function applyDualVoenFromCard(
    gpid: string,
    holdingId: string | null,
    path: string,
  ) {
    const res = await workforceFetch(path);
    if (!res.ok) return false;
    const body = (await res.json()) as {
      employments?: Array<{ status: string; orgName: string }>;
    };
    const active = (body.employments ?? []).filter((e) => e.status === "ACTIVE");
    if (active.length < 2) return false;
    setDualVoenBanner({
      globalPersonId: gpid,
      holdingId,
      orgNames: active.map((e) => e.orgName),
    });
    return true;
  }

  async function checkDualVoenAfterHire(gpid: string) {
    const token = getOrchAccessToken();
    if (!token) return;
    const holdingsRes = await orchFetch("/v1/holdings", { token });
    if (holdingsRes.ok) {
      const holdings = (await holdingsRes.json()) as Array<{
        id: string;
        name: string;
      }>;
      for (const holding of holdings) {
        const ok = await applyDualVoenFromCard(
          gpid,
          holding.id,
          `persons/${encodeURIComponent(gpid)}/employments?holdingId=${encodeURIComponent(holding.id)}`,
        );
        if (ok) return;
      }
    }
    await applyDualVoenFromCard(
      gpid,
      null,
      `persons/${encodeURIComponent(gpid)}/employments`,
    );
  }

  async function onHire(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !orgUnitId || !positionId) return;
    if (!resolveFirstName.trim() || !resolveLastName.trim()) return;
    if (!resolveSex || resolveSex === "UNKNOWN") {
      setModalError(t("selectSex"));
      return;
    }
    if (!resolveBirthDate.trim()) {
      setModalError(t("birthDateRequired"));
      return;
    }
    if (!hirePhone.trim()) {
      setModalError(t("phoneRequired"));
      return;
    }
    const accessKeys = hireGrantAccess ? satelliteKeys : [];
    if (accessKeys.length > 0 && !hirePin.trim()) {
      setModalError(t("pinRequired"));
      return;
    }
    const finEmpty = !resolveFin.trim() && !hireFinMasked;
    if (finEmpty) {
      setPendingConfirm({ kind: "hireWithoutFin" });
      return;
    }
    await submitHire();
  }

  function parsePersonnelOrderRef(raw: unknown): PersonnelOrderRef | null {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Partial<PersonnelOrderRef>;
    if (!o.id || !o.orderNumber) return null;
    return {
      id: String(o.id),
      type: String(o.type ?? ""),
      status: String(o.status ?? "DRAFT"),
      orderNumber: String(o.orderNumber),
      employmentId: o.employmentId ? String(o.employmentId) : null,
    };
  }

  async function issueOrder(id: string) {
    setOrderBridgeBusy(true);
    const res = await workforceFetch(`personnel-orders/${id}/issue`, {
      method: "POST",
    });
    setOrderBridgeBusy(false);
    if (!res.ok) {
      setModalError(await describeWorkforceError(res));
      return;
    }
    const data = (await res.json()) as PersonnelOrderRef;
    setOrderBridge((prev) =>
      prev && prev.id === id
        ? { ...prev, status: data.status ?? "ISSUED" }
        : prev,
    );
    setCardOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: data.status ?? "ISSUED" } : o)),
    );
  }

  async function downloadOrderPdf(id: string) {
    setOrderBridgeBusy(true);
    const res = await workforceFetch(`personnel-orders/${id}/pdf`);
    setOrderBridgeBusy(false);
    if (!res.ok) {
      setModalError(await describeWorkforceError(res));
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `personnel-order-${id.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function patchHrProfile(
    personId: string,
    blood: string,
    address: string,
  ) {
    const body: {
      bloodGroup: string;
      addresses?: Array<{ kind: string; line: string }>;
    } = { bloodGroup: blood || "UNKNOWN" };
    if (address.trim()) {
      body.addresses = [{ kind: "ACTUAL", line: address.trim() }];
    }
    return mdmWorkforceFetch(`${personId}/hr-profile`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async function submitHire() {
    const accessKeys = hireGrantAccess ? satelliteKeys : [];
    setBusy(true);
    setModalError(null);

    const resolveRes = await mdmWorkforceFetch("workforce-resolve", {
      method: "POST",
      body: JSON.stringify({
        ...(globalPersonId.trim() ? { globalPersonId: globalPersonId.trim() } : {}),
        fin: resolveFin.trim() || undefined,
        firstName: resolveFirstName.trim(),
        middleName: resolveMiddleName.trim() || undefined,
        lastName: resolveLastName.trim(),
        sex: resolveSex || undefined,
        birthDate: resolveBirthDate || undefined,
        phone: hirePhone.trim() || undefined,
        email: hireEmail.trim() || undefined,
      }),
    });
    if (!resolveRes.ok) {
      setModalError(await describeWorkforceError(resolveRes));
      setBusy(false);
      return;
    }
    const resolved = (await resolveRes.json()) as { globalPersonId: string };
    const hiredGpid = resolved.globalPersonId;
    setGlobalPersonId(hiredGpid);

    const hrRes = await patchHrProfile(hiredGpid, resolveBlood, hireAddress);
    if (!hrRes.ok) {
      setModalError(await describeWorkforceError(hrRes));
      setBusy(false);
      return;
    }

    const res = await workforceFetch("employments/hire", {
      method: "POST",
      body: JSON.stringify({
        globalPersonId: hiredGpid,
        hireDate,
        orgUnitId,
        positionId,
        satelliteKeys: accessKeys,
        ...(hireGrantAccess && hireLogin.trim()
          ? { login: hireLogin.trim().toLowerCase() }
          : {}),
        ...(hireGrantAccess && hirePin.trim() ? { pin: hirePin.trim() } : {}),
      }),
    });
    if (!res.ok) {
      setModalError(await describeWorkforceError(res));
      setBusy(false);
      return;
    }
    const hired = (await res.json()) as {
      employment?: { id: string };
      personnelOrder?: unknown;
    };
    const order =
      parsePersonnelOrderRef(hired.personnelOrder) ??
      (hired.employment?.id
        ? {
            id: "",
            type: "HIRE",
            status: "DRAFT",
            orderNumber: "",
            employmentId: hired.employment.id,
          }
        : null);
    setHireOpen(false);
    await load();
    void checkDualVoenAfterHire(hiredGpid);
    if (order) setOrderBridge(order);
    setBusy(false);
  }

  async function terminateEmployment(emp: EmploymentRow) {
    setPendingConfirm({ kind: "terminate", emp });
  }

  async function submitTerminate(emp: EmploymentRow) {
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
    const body = (await res.json()) as { personnelOrder?: unknown };
    const order = parsePersonnelOrderRef(body.personnelOrder);
    await load();
    if (order) setOrderBridge(order);
  }

  async function reprovisionEmployment(
    emp: EmploymentRow,
    opts?: {
      login?: string;
      pin?: string;
      satelliteKeys?: string[];
      skipConfirm?: boolean;
    },
  ) {
    if (!opts?.skipConfirm) {
      setPendingConfirm({ kind: "reprovision", emp });
      return;
    }
    return submitReprovision(emp, opts);
  }

  async function submitReprovision(
    emp: EmploymentRow,
    opts?: {
      login?: string;
      pin?: string;
      satelliteKeys?: string[];
    },
  ) {
    setMoreMenuId(null);
    setBusy(true);
    setError(null);
    setLoginModalError(null);
    const body: { login?: string; pin?: string; satelliteKeys?: string[] } = {};
    if (opts?.login?.trim()) body.login = opts.login.trim().toLowerCase();
    if (opts?.pin?.trim()) body.pin = opts.pin.trim();
    if (opts?.satelliteKeys !== undefined) body.satelliteKeys = opts.satelliteKeys;
    const res = await workforceFetch(`employments/${emp.id}/reprovision`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const msg = await describeWorkforceError(res);
      if (loginOpen) setLoginModalError(msg);
      else if (cardOpen) setModalError(msg);
      else setError(msg);
      return;
    }
    await load();
    return true;
  }

  async function saveLoginAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmp || busy) return;
    const hasSatellites = loginEditSatelliteKeys.length > 0;
    const hadBindings = (loginEmp.roleBindings?.length ?? 0) > 0;
    if (hasSatellites && !loginEditPin.trim() && !hadBindings) {
      setLoginModalError(t("pinRequired"));
      return;
    }
    const ok = await reprovisionEmployment(loginEmp, {
      login: hasSatellites ? loginEditLogin : undefined,
      pin: hasSatellites ? loginEditPin : undefined,
      satelliteKeys: loginEditSatelliteKeys,
      skipConfirm: true,
    });
    if (ok) {
      setLoginOpen(false);
      setLoginEmp(null);
    }
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
      setModalError(await describeWorkforceError(res));
      return;
    }
    const body = (await res.json()) as { personnelOrder?: unknown };
    const order = parsePersonnelOrderRef(body.personnelOrder);
    setTransferOpen(false);
    setActionEmp(null);
    await load();
    if (order) setOrderBridge(order);
  }

  async function openEmployeeCard(emp: EmploymentRow) {
    setActionEmp(emp);
    setModalError(null);
    setCardOpen(true);
    setBusy(true);
    const person = persons[emp.globalPersonId];
    setCardFirstName(person?.firstName ?? "");
    setCardMiddleName(person?.middleName ?? "");
    setCardLastName(person?.lastName ?? "");
    setCardSex(person?.sex && person.sex !== "UNKNOWN" ? person.sex : "");
    setCardBirthDate(person?.birthDate ?? "");
    setCardPhone("");
    setCardEmail("");
    setCardBlood("");
    setCardAddress("");
    setCardFinMasked(person?.finMasked ?? "");
    setCardPhoneMasked("");
    setCardEmailMasked("");
    const existingKeys = (emp.roleBindings ?? []).map((b) => b.satelliteKey);
    setCardSatelliteKeys(existingKeys);
    setCardGrantAccess(existingKeys.length > 0);
    setCardLogin(displayStaffLogin(emp));
    setCardPin("");
    setCardLoginDirty(Boolean(emp.satelliteStaffLogin?.trim()));
    setCardOrders([]);

    const [opsRes, hrRes, ordersRes] = await Promise.all([
      mdmWorkforceFetch(`${emp.globalPersonId}/ops-profile`),
      mdmWorkforceFetch(`${emp.globalPersonId}/hr-profile`),
      workforceFetch(`personnel-orders?employmentId=${encodeURIComponent(emp.id)}`),
    ]);
    setBusy(false);
    if (opsRes.ok) {
      const ops = (await opsRes.json()) as {
        fullName?: string | null;
        firstName?: string | null;
        middleName?: string | null;
        lastName?: string | null;
        sex?: string | null;
        birthDate?: string | null;
        phoneMasked?: string | null;
        emailMasked?: string | null;
        primaryIdentifierMasked?: string | null;
      };
      if (ops.firstName || ops.lastName) {
        const scrambled =
          isPatronymicParticle(ops.lastName) ||
          (ops.fullName &&
            (() => {
              const tokens = ops.fullName.trim().split(/\s+/).filter(Boolean);
              return (
                tokens.length >= 3 &&
                isPatronymicParticle(tokens[tokens.length - 1]) &&
                ops.lastName === tokens[tokens.length - 1]
              );
            })());
        if (scrambled && ops.fullName) {
          const parts = splitFullNameToParts(ops.fullName);
          setCardFirstName(parts.firstName ?? "");
          setCardMiddleName(parts.middleName ?? "");
          setCardLastName(parts.lastName ?? "");
        } else {
          setCardFirstName(ops.firstName ?? "");
          setCardMiddleName(ops.middleName ?? "");
          setCardLastName(ops.lastName ?? "");
        }
      } else if (ops.fullName) {
        const parts = splitFullNameToParts(ops.fullName);
        setCardFirstName(parts.firstName ?? "");
        setCardMiddleName(parts.middleName ?? "");
        setCardLastName(parts.lastName ?? "");
      }
      if (ops.sex) setCardSex(ops.sex);
      if (ops.birthDate) setCardBirthDate(ops.birthDate);
      if (ops.phoneMasked) setCardPhoneMasked(ops.phoneMasked);
      if (ops.emailMasked) setCardEmailMasked(ops.emailMasked);
      if (ops.primaryIdentifierMasked) setCardFinMasked(ops.primaryIdentifierMasked);
    }
    if (hrRes.ok) {
      const hr = (await hrRes.json()) as {
        accessDenied?: boolean;
        hrProfile?: {
          bloodGroup?: string | null;
          addresses?: Array<{ kind?: string; line?: string | null }>;
        } | null;
      };
      if (!hr.accessDenied && hr.hrProfile) {
        if (hr.hrProfile.bloodGroup) setCardBlood(hr.hrProfile.bloodGroup);
        const addr =
          hr.hrProfile.addresses?.find((a) => a.kind === "ACTUAL" && a.line) ??
          hr.hrProfile.addresses?.find((a) => a.line);
        if (addr?.line) setCardAddress(addr.line);
      }
    } else if (!opsRes.ok) {
      setModalError(await hrRes.text().catch(() => t("cardLoadFailed")));
    }
    if (ordersRes.ok) {
      const data = (await ordersRes.json()) as { items?: PersonnelOrderRef[] };
      setCardOrders(
        (data.items ?? []).map((o) => ({
          id: o.id,
          type: o.type,
          status: o.status,
          orderNumber: o.orderNumber,
          employmentId: o.employmentId ?? emp.id,
        })),
      );
    }
  }

  async function saveEmployeeCard(e: React.FormEvent) {
    e.preventDefault();
    if (!actionEmp || !cardFirstName.trim() || !cardLastName.trim()) return;
    if (!cardSex || cardSex === "UNKNOWN") {
      setModalError(t("selectSex"));
      return;
    }
    if (!cardBirthDate.trim()) {
      setModalError(t("birthDateRequired"));
      return;
    }
    if (!cardPhone.trim() && !cardPhoneMasked) {
      setModalError(t("phoneRequired"));
      return;
    }
    const accessKeys = cardGrantAccess ? cardSatelliteKeys : [];
    if (accessKeys.length > 0 && !cardPin.trim()) {
      const hadBindings = (actionEmp.roleBindings?.length ?? 0) > 0;
      if (!hadBindings) {
        setModalError(t("pinRequired"));
        return;
      }
    }
    const existingKeys = [...(actionEmp.roleBindings ?? []).map((b) => b.satelliteKey)].sort();
    const nextKeys = [...accessKeys].sort();
    const loginChanged =
      cardGrantAccess &&
      cardLogin.trim().toLowerCase() !== displayStaffLogin(actionEmp).toLowerCase();
    const accessChanged =
      existingKeys.join(",") !== nextKeys.join(",") ||
      loginChanged ||
      Boolean(cardPin.trim());

    setBusy(true);
    setModalError(null);

    const resolveRes = await mdmWorkforceFetch("workforce-resolve", {
      method: "POST",
      body: JSON.stringify({
        globalPersonId: actionEmp.globalPersonId,
        firstName: cardFirstName.trim(),
        middleName: cardMiddleName.trim() || undefined,
        lastName: cardLastName.trim(),
        sex: cardSex || undefined,
        birthDate: cardBirthDate || undefined,
        phone: cardPhone.trim() || undefined,
        email: cardEmail.trim() || undefined,
      }),
    });
    if (!resolveRes.ok) {
      setModalError(await describeWorkforceError(resolveRes));
      setBusy(false);
      return;
    }

    const hrRes = await patchHrProfile(
      actionEmp.globalPersonId,
      cardBlood,
      cardAddress,
    );
    if (!hrRes.ok) {
      setModalError(await describeWorkforceError(hrRes));
      setBusy(false);
      return;
    }

    if (actionEmp.status === "ACTIVE" && accessChanged) {
      const ok = await submitReprovision(actionEmp, {
        login: cardGrantAccess ? cardLogin : undefined,
        pin: cardGrantAccess && cardPin.trim() ? cardPin : undefined,
        satelliteKeys: accessKeys,
      });
      if (!ok) {
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
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openHire}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              {t("addEmployee")}
            </button>
          }
        />
      </div>

      </div>

      {dualVoenBanner ? (
        <div className={`${CARD_CONTAINER_CLASS} flex shrink-0 flex-wrap items-start justify-between gap-3 p-4`}>
          <p className="text-sm text-[#34495E]">
            {t("dualVoenBanner", { orgs: dualVoenBanner.orgNames.join(", ") })}{" "}
            {dualVoenBanner.holdingId ? (
              <Link
                href={`/workspace/workforce/group/persons/${dualVoenBanner.globalPersonId}?holdingId=${dualVoenBanner.holdingId}`}
                className="text-[#2980B9] hover:underline"
              >
                {t("dualVoenBannerLink")}
              </Link>
            ) : (
              <span>{t("dualVoenBannerNoGroup")}</span>
            )}
          </p>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setDualVoenBanner(null)}
          >
            {t("dualVoenDismiss")}
          </button>
        </div>
      ) : null}

      {error ? <p className="shrink-0 text-sm text-red-700">{error}</p> : null}

      <EraListWorkspace
        filter={
      <EraListFilterBar
        className="!mb-0"
        onReset={() => {
          setFilterText("");
          setFilterOrgUnitId("");
          setFilterPositionId("");
          setFilterSex("");
          setFilterAge("");
          setFilterStatus("");
          setFilterSatellite("");
        }}
        resetLabel={tCommon("filterReset")}
      >
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
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("filterStatus")}
          value={filterStatus}
          onChange={(next) => setFilterStatus(String(next))}
          options={[
            { value: "ACTIVE", label: t("statusActive") },
            { value: "TERMINATED", label: t("statusTerminated") },
          ]}
          emptyLabel={t("filterAll")}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("filterSatellite")}
          value={filterSatellite}
          onChange={(next) => setFilterSatellite(String(next))}
          options={satelliteFilterOptions.map((s) => ({
            value: s.key,
            label: s.label,
          }))}
          emptyLabel={t("filterAll")}
        />
      </EraListFilterBar>
        }
        table={
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
              {pagedRows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td
                    className={`${DATA_TABLE_TD_CLASS} py-8 text-center text-[#7F8C8D]`}
                    colSpan={9}
                  >
                    {loading ? t("loading") : t("empty")}
                  </td>
                </tr>
              ) : (
              pagedRows.map((r) => {
                const hasBindings = (r.roleBindings?.length ?? 0) > 0;
                const canReprovision =
                  r.status !== "TERMINATED" && hasBindings;
                const canLoginAccess = r.status !== "TERMINATED";
                const loginAccessTitle = !canLoginAccess
                  ? t("reprovisionTerminated")
                  : t("loginInfo");
                const reprovisionTitle = !canReprovision
                  ? r.status === "TERMINATED"
                    ? t("reprovisionTerminated")
                    : t("reprovisionNoBindings")
                  : t("reprovision");
                return (
                  <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {persons[r.globalPersonId]?.displayName ??
                        (persons[r.globalPersonId]?.accessDenied
                          ? t("maskedPerson")
                          : tCommon("unnamedPerson"))}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>
                      {persons[r.globalPersonId]?.finMasked ?? "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {formatSex(persons[r.globalPersonId]?.sex)}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} tabular-nums`}>
                      {persons[r.globalPersonId]?.birthDate
                        ? bakuDateDisplay(
                            persons[r.globalPersonId]!.birthDate as string,
                          )
                        : "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {r.orgUnit?.name ?? "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {r.position?.name ?? "—"}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} tabular-nums`}>
                      {bakuDateDisplay(r.hireDate)}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="flex flex-col gap-1">
                        <span>{formatStatus(r.status)}</span>
                        {(draftOrdersByEmployment[r.id]?.length ?? 0) > 0 ? (
                          <Link
                            href={`/workspace/workforce/personnel-orders?employmentId=${r.id}`}
                            className="text-[11px] text-[#2980B9] hover:underline"
                          >
                            {t("draftOrderBanner", {
                              count: draftOrdersByEmployment[r.id]!.length,
                            })}
                          </Link>
                        ) : null}
                      </div>
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
                          onClick={() => openTransfer(r)}
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
                        <div className="relative" data-employment-more-menu="">
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
                            <div className="absolute right-0 z-10 mt-1 min-w-[11rem] rounded-lg border border-[#D5DADF] bg-white py-1 shadow-md">
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#34495E] hover:bg-[#F4F6F7] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={busy || !canLoginAccess}
                                title={loginAccessTitle}
                                onClick={() => {
                                  if (!canLoginAccess) return;
                                  setMoreMenuId(null);
                                  setLoginEmp(r);
                                  setLoginEditLogin(displayStaffLogin(r));
                                  setLoginEditPin("");
                                  setLoginEditSatelliteKeys([
                                    ...new Set(
                                      (r.roleBindings ?? [])
                                        .map((b) => b.satelliteKey)
                                        .filter(Boolean),
                                    ),
                                  ]);
                                  setLoginModalError(null);
                                  setLoginCopied(false);
                                  setLoginOpen(true);
                                }}
                              >
                                <KeyRound className="h-3.5 w-3.5" aria-hidden />
                                {t("loginInfo")}
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#34495E] hover:bg-[#F4F6F7] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={busy || !canReprovision}
                                title={reprovisionTitle}
                                onClick={() => void reprovisionEmployment(r)}
                              >
                                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                                {t("reprovision")}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        }
        footer={
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={listTotal}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            labels={{
              rowsPerPage: tCommon("paginationRowsPerPage"),
              pageOf: tCommon("paginationPageOf"),
              prev: tCommon("paginationPrev"),
              next: tCommon("paginationNext"),
            }}
          />
        }
      />

      <ModalShell
        open={hireOpen}
        title={t("hireTitle")}
        maxWidthClass="max-w-5xl"
        onClose={() => !busy && setHireOpen(false)}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            formId="workforce-hire-form"
            onCancel={() => setHireOpen(false)}
            busy={busy}
            submitDisabled={
              !orgUnitId ||
              !positionId ||
              !resolveFirstName.trim() ||
              !resolveLastName.trim() ||
              !resolveSex ||
              !resolveBirthDate.trim() ||
              !hirePhone.trim() ||
              (hireGrantAccess && satelliteKeys.length > 0 && !hirePin.trim())
            }
            cancelLabel={tCommon("cancel")}
            submitLabel={busy ? t("busy") : t("hire")}
          />
        }
      >
        <form
          id="workforce-hire-form"
          onSubmit={(e) => void onHire(e)}
          className="grid gap-4"
        >
          <fieldset className={ZONE_CLASS}>
            <legend className="px-1 text-xs font-semibold text-[#34495E]">
              {t("zoneIdentity")}
            </legend>
            <div className="flex min-w-0 items-end gap-2">
              <label className="block min-w-0 flex-1 text-[13px] font-medium text-[#34495E]">
                {t("resolveFin")}
                <input
                  className={FIELD_INPUT_CLASS}
                  value={resolveFin}
                  onChange={(e) => setResolveFin(e.target.value.toUpperCase())}
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                className={`${SECONDARY_BUTTON_CLASS} mb-0 shrink-0`}
                disabled={busy || mdmSearchBusy}
                onClick={() => void searchMdmByFin()}
              >
                {mdmSearchBusy ? t("busy") : t("resolvePerson")}
              </button>
            </div>
            {resolvedLabel ? (
              <p className="text-xs text-[#27AE60]">{resolvedLabel}</p>
            ) : null}
            {hireFinMasked ? (
              <p className="font-mono text-xs text-[#7F8C8D]">{hireFinMasked}</p>
            ) : null}
            <div className={ROW3_CLASS}>
              <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
                {t("fieldFirstName")}
                {REQ_STAR}
                <input
                  className={FIELD_INPUT_CLASS}
                  value={resolveFirstName}
                  onChange={(e) => setResolveFirstName(e.target.value)}
                  required
                />
              </label>
              <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
                {t("fieldMiddleName")}
                <input
                  className={FIELD_INPUT_CLASS}
                  value={resolveMiddleName}
                  onChange={(e) => setResolveMiddleName(e.target.value)}
                />
              </label>
              <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
                {t("fieldLastName")}
                {REQ_STAR}
                <input
                  className={FIELD_INPUT_CLASS}
                  value={resolveLastName}
                  onChange={(e) => setResolveLastName(e.target.value)}
                  required
                />
              </label>
            </div>
            <div className={ROW3_CLASS}>
              <CatalogField
                kind="CLOSED_SMALL"
                className="min-w-0"
                widthPreset="selectWide"
                label={t("fieldSex")}
                value={resolveSex}
                onChange={(next) => setResolveSex(String(next))}
                options={sexOptions.filter((o) => o.value !== "UNKNOWN")}
                emptyLabel={t("selectSex")}
                required
              />
              <DatePicker
                label={t("fieldBirthDate")}
                value={resolveBirthDate}
                onChange={setResolveBirthDate}
                placeholder={tCommon("datePlaceholder")}
                fluid
                required
              />
              <CatalogField
                kind="CLOSED_SMALL"
                className="min-w-0"
                widthPreset="selectWide"
                label={t("fieldBloodGroup")}
                value={resolveBlood}
                onChange={(next) => setResolveBlood(String(next))}
                options={bloodOptions}
                emptyLabel={t("bloodOptional")}
              />
            </div>
          </fieldset>

          <fieldset className={ZONE_CLASS}>
            <legend className="px-1 text-xs font-semibold text-[#34495E]">
              {t("zoneContacts")}
            </legend>
            <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
              {t("fieldPhone")}
              {REQ_STAR}
              <input
                className={FIELD_INPUT_CLASS}
                value={hirePhone}
                onChange={(e) => setHirePhone(e.target.value)}
                placeholder="+994…"
                required
              />
            </label>
            <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
              {t("fieldAddress")}
              <input
                className={FIELD_INPUT_CLASS}
                value={hireAddress}
                onChange={(e) => setHireAddress(e.target.value)}
              />
            </label>
            <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
              {t("fieldEmail")}
              <input
                className={FIELD_INPUT_CLASS}
                type="email"
                value={hireEmail}
                onChange={(e) => setHireEmail(e.target.value)}
              />
            </label>
          </fieldset>

          <fieldset className={ZONE_CLASS}>
            <legend className="px-1 text-xs font-semibold text-[#34495E]">
              {t("zoneEmployment")}
            </legend>
            <div className={ROW3_CLASS}>
              <CatalogField
                kind="ENTITY_REF"
                className="min-w-0"
                widthPreset="selectWide"
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
                className="min-w-0"
                widthPreset="selectWide"
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
              <DatePicker
                label={t("hireDate")}
                value={hireDate}
                onChange={setHireDate}
                placeholder={tCommon("datePlaceholder")}
                required
                fluid
              />
            </div>
          </fieldset>

          <fieldset className={ZONE_CLASS}>
            <legend className="px-1 text-xs font-semibold text-[#34495E]">
              {t("zoneAccess")}
            </legend>
            <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                type="checkbox"
                checked={hireGrantAccess}
                onChange={(e) => {
                  setHireGrantAccess(e.target.checked);
                  if (!e.target.checked) {
                    setSatelliteKeys([]);
                    setHirePin("");
                    setHireLogin("");
                    setHireLoginDirty(false);
                  } else {
                    setHirePin((prev) => prev || "0000");
                  }
                }}
              />
              {t("grantAccess")}
            </label>
            {hireGrantAccess ? (
              <>
                <div className={ROW2_CLASS}>
                  <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
                    {t("fieldStaffLogin")}
                    <input
                      className={`${FIELD_INPUT_CLASS} font-mono`}
                      value={hireLogin}
                      onChange={(e) => {
                        setHireLoginDirty(true);
                        setHireLogin(e.target.value);
                      }}
                      placeholder={t("fieldStaffLoginAutoPlaceholder")}
                    />
                  </label>
                  <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
                    {t("fieldStaffPin")}
                    <input
                      className={`${FIELD_INPUT_CLASS} font-mono`}
                      value={hirePin}
                      onChange={(e) => setHirePin(e.target.value)}
                      required={satelliteKeys.length > 0}
                      aria-required={satelliteKeys.length > 0}
                    />
                  </label>
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-medium text-[#34495E]">
                    {t("satelliteAccess")}
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {satelliteFilterOptions.map((s) => (
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
                </div>
              </>
            ) : null}
          </fieldset>
          {modalError && hireOpen ? (
            <p className="text-sm text-red-700">{modalError}</p>
          ) : null}
          {!resolveFin.trim() &&
          !hireFinMasked &&
          resolveFirstName.trim() &&
          resolveLastName.trim() ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              {t("hireWithoutFinBanner")}
            </p>
          ) : null}
        </form>
      </ModalShell>

      <ModalShell
        open={transferOpen}
        title={t("transferTitle")}
        subtitle={
          actionEmp
            ? (persons[actionEmp.globalPersonId]?.displayName ??
              tCommon("unnamedPerson"))
            : undefined
        }
        onClose={() => !busy && setTransferOpen(false)}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            formId="workforce-transfer-form"
            onCancel={() => setTransferOpen(false)}
            busy={busy}
            submitDisabled={
              !transferOrgUnitId ||
              !transferPositionId ||
              (transferOrgUnitId ===
                (actionEmp?.orgUnitId ?? actionEmp?.orgUnit?.id ?? "") &&
                transferPositionId ===
                  (actionEmp?.positionId ?? actionEmp?.position?.id ?? ""))
            }
            cancelLabel={tCommon("cancel")}
            submitLabel={t("transfer")}
          />
        }
      >
        <form
          id="workforce-transfer-form"
          onSubmit={(e) => void submitTransfer(e)}
          className="grid gap-3"
        >
          <CatalogField
            kind="ENTITY_REF"
            className="min-w-0"
            widthPreset="selectWide"
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
            className="min-w-0"
            widthPreset="selectWide"
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
          {actionEmp &&
          transferOrgUnitId ===
            (actionEmp.orgUnitId ?? actionEmp.orgUnit?.id ?? "") &&
          transferPositionId ===
            (actionEmp.positionId ?? actionEmp.position?.id ?? "") ? (
            <p className="text-xs text-[#7F8C8D]">{t("transferUnchanged")}</p>
          ) : null}
        </form>
      </ModalShell>

      <ModalShell
        open={cardOpen}
        title={t("cardTitle")}
        maxWidthClass="max-w-5xl"
        onClose={() => !busy && setCardOpen(false)}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            formId="workforce-card-form"
            onCancel={() => setCardOpen(false)}
            busy={busy}
            submitDisabled={
              !cardFirstName.trim() ||
              !cardLastName.trim() ||
              !cardSex ||
              !cardBirthDate.trim() ||
              (!cardPhone.trim() && !cardPhoneMasked)
            }
            cancelLabel={tCommon("cancel")}
            submitLabel={busy ? t("busy") : tCommon("save")}
          />
        }
      >
        <form
          id="workforce-card-form"
          onSubmit={(e) => void saveEmployeeCard(e)}
          className="grid gap-4"
        >
          <fieldset className={ZONE_CLASS}>
            <legend className="px-1 text-xs font-semibold text-[#34495E]">
              {t("zoneIdentity")}
            </legend>
            <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
              {t("resolveFin")}
              <input
                className={`${FIELD_INPUT_CLASS} font-mono`}
                value={cardFinMasked}
                readOnly
              />
            </label>
            <div className={ROW3_CLASS}>
              <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
                {t("fieldFirstName")}
                {REQ_STAR}
                <input
                  className={FIELD_INPUT_CLASS}
                  value={cardFirstName}
                  onChange={(e) => setCardFirstName(e.target.value)}
                  required
                />
              </label>
              <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
                {t("fieldMiddleName")}
                <input
                  className={FIELD_INPUT_CLASS}
                  value={cardMiddleName}
                  onChange={(e) => setCardMiddleName(e.target.value)}
                />
              </label>
              <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
                {t("fieldLastName")}
                {REQ_STAR}
                <input
                  className={FIELD_INPUT_CLASS}
                  value={cardLastName}
                  onChange={(e) => setCardLastName(e.target.value)}
                  required
                />
              </label>
            </div>
            <div className={ROW3_CLASS}>
              <CatalogField
                kind="CLOSED_SMALL"
                className="min-w-0"
                widthPreset="selectWide"
                label={t("fieldSex")}
                value={cardSex}
                onChange={(next) => setCardSex(String(next))}
                options={sexOptions.filter((o) => o.value !== "UNKNOWN")}
                emptyLabel={t("selectSex")}
                required
              />
              <DatePicker
                label={t("fieldBirthDate")}
                value={cardBirthDate}
                onChange={setCardBirthDate}
                placeholder={tCommon("datePlaceholder")}
                fluid
                required
              />
              <CatalogField
                kind="CLOSED_SMALL"
                className="min-w-0"
                widthPreset="selectWide"
                label={t("fieldBloodGroup")}
                value={cardBlood}
                onChange={(next) => setCardBlood(String(next))}
                options={bloodOptions}
                emptyLabel={tCommon("select")}
              />
            </div>
          </fieldset>

          <fieldset className={ZONE_CLASS}>
            <legend className="px-1 text-xs font-semibold text-[#34495E]">
              {t("zoneContacts")}
            </legend>
            <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
              {t("fieldPhone")}
              {REQ_STAR}
              <input
                className={FIELD_INPUT_CLASS}
                value={cardPhone}
                onChange={(e) => setCardPhone(e.target.value)}
                placeholder={cardPhoneMasked || "+994…"}
                required={!cardPhoneMasked}
              />
            </label>
            <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
              {t("fieldAddress")}
              <input
                className={FIELD_INPUT_CLASS}
                value={cardAddress}
                onChange={(e) => setCardAddress(e.target.value)}
              />
            </label>
            <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
              {t("fieldEmail")}
              <input
                className={FIELD_INPUT_CLASS}
                type="email"
                value={cardEmail}
                onChange={(e) => setCardEmail(e.target.value)}
                placeholder={cardEmailMasked || undefined}
              />
            </label>
          </fieldset>

          <fieldset className={ZONE_CLASS}>
            <legend className="px-1 text-xs font-semibold text-[#34495E]">
              {t("zoneEmployment")}
            </legend>
            <div className={ROW3_CLASS}>
              <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
                {t("orgUnit")}
                <input
                  className={FIELD_INPUT_CLASS}
                  value={actionEmp?.orgUnit?.name ?? "—"}
                  readOnly
                />
              </label>
              <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
                {t("position")}
                <input
                  className={FIELD_INPUT_CLASS}
                  value={actionEmp?.position?.name ?? "—"}
                  readOnly
                />
              </label>
              <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
                {t("hireDate")}
                <input
                  className={FIELD_INPUT_CLASS}
                  value={actionEmp ? String(actionEmp.hireDate).slice(0, 10) : "—"}
                  readOnly
                />
              </label>
            </div>
            {actionEmp?.status === "ACTIVE" ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => openTransfer(actionEmp)}
              >
                {t("transfer")}
              </button>
            ) : null}
          </fieldset>

          <fieldset className={ZONE_CLASS}>
            <legend className="px-1 text-xs font-semibold text-[#34495E]">
              {t("zoneAccess")}
            </legend>
            <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                type="checkbox"
                checked={cardGrantAccess}
                disabled={actionEmp?.status === "TERMINATED"}
                onChange={(e) => {
                  setCardGrantAccess(e.target.checked);
                  if (!e.target.checked) {
                    setCardSatelliteKeys([]);
                    setCardPin("");
                  } else if ((actionEmp?.roleBindings?.length ?? 0) === 0) {
                    setCardPin((prev) => prev || "0000");
                  }
                }}
              />
              {t("grantAccess")}
            </label>
            {cardGrantAccess && actionEmp?.status === "ACTIVE" ? (
              <>
                <div className={ROW2_CLASS}>
                  <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
                    {t("fieldStaffLogin")}
                    <input
                      className={`${FIELD_INPUT_CLASS} font-mono`}
                      value={cardLogin}
                      onChange={(e) => {
                        setCardLoginDirty(true);
                        setCardLogin(e.target.value);
                      }}
                    />
                  </label>
                  <label className="block min-w-0 text-[13px] font-medium text-[#34495E]">
                    {t("fieldStaffPin")}
                    <input
                      className={`${FIELD_INPUT_CLASS} font-mono`}
                      value={cardPin}
                      onChange={(e) => setCardPin(e.target.value)}
                      placeholder={
                        (actionEmp?.roleBindings?.length ?? 0) > 0
                          ? t("pinKeepHint")
                          : "0000"
                      }
                    />
                  </label>
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-medium text-[#34495E]">
                    {t("satelliteAccess")}
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {satelliteFilterOptions.map((s) => (
                      <label
                        key={s.key}
                        className="flex items-center gap-2 text-xs text-[#34495E]"
                      >
                        <input
                          type="checkbox"
                          checked={cardSatelliteKeys.includes(s.key)}
                          onChange={(e) => {
                            setCardSatelliteKeys((prev) =>
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
                </div>
              </>
            ) : null}
          </fieldset>

          <fieldset className={ZONE_CLASS}>
            <legend className="px-1 text-xs font-semibold text-[#34495E]">
              {t("zoneOrders")}
            </legend>
            {cardOrders.length === 0 ? (
              <p className="text-xs text-[#7F8C8D]">{t("ordersEmpty")}</p>
            ) : (
              <ul className="grid gap-2">
                {cardOrders.map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-[13px]"
                  >
                    <span>
                      <span className="font-mono">{o.orderNumber}</span>
                      {" · "}
                      {tOrders(`type.${o.type}` as "type.HIRE")}
                      {" · "}
                      {tOrders(`status.${o.status}` as "status.DRAFT")}
                    </span>
                    <span className="flex gap-2">
                      {o.status === "DRAFT" ? (
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          disabled={orderBridgeBusy}
                          onClick={() => void issueOrder(o.id)}
                        >
                          {tOrders("issue")}
                        </button>
                      ) : null}
                      {o.status === "ISSUED" ? (
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          disabled={orderBridgeBusy}
                          onClick={() => void downloadOrderPdf(o.id)}
                        >
                          {tOrders("pdf")}
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {actionEmp ? (
              <Link
                href={`/workspace/workforce/personnel-orders?employmentId=${actionEmp.id}`}
                className="text-xs text-[#2980B9] hover:underline"
              >
                {t("openOrdersList")}
              </Link>
            ) : null}
          </fieldset>

          {modalError && cardOpen ? (
            <p className="text-sm text-red-700">{modalError}</p>
          ) : null}
        </form>
      </ModalShell>

      <ModalShell
        open={!!orderBridge}
        title={t("orderBridgeTitle")}
        onClose={() => setOrderBridge(null)}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            onCancel={() => setOrderBridge(null)}
            cancelLabel={tCommon("close")}
            submitLabel={
              orderBridge?.status === "ISSUED" ? tOrders("pdf") : tOrders("issue")
            }
            busy={orderBridgeBusy}
            submitDisabled={!orderBridge?.id}
            onSubmit={() => {
              if (!orderBridge?.id) return;
              if (orderBridge.status === "DRAFT") void issueOrder(orderBridge.id);
              else void downloadOrderPdf(orderBridge.id);
            }}
          />
        }
      >
        {orderBridge ? (
          <div className="grid gap-3 text-[13px] text-[#34495E]">
            {orderBridge.id ? (
              <>
                <p>
                  <span className="font-mono text-[15px]">{orderBridge.orderNumber}</span>
                  {" · "}
                  {tOrders(`type.${orderBridge.type}` as "type.HIRE")}
                  {" · "}
                  {tOrders(`status.${orderBridge.status}` as "status.DRAFT")}
                </p>
                <p className="text-xs text-[#7F8C8D]">{t("orderBridgeHint")}</p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/workspace/workforce/personnel-orders?employmentId=${orderBridge.employmentId ?? ""}`}
                    className={`${SECONDARY_BUTTON_CLASS} inline-flex items-center`}
                  >
                    {t("openOrdersList")}
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-[#7F8C8D]">
                {t("orderDraftMissing")}{" "}
                {orderBridge.employmentId ? (
                  <Link
                    href={`/workspace/workforce/personnel-orders?employmentId=${orderBridge.employmentId}`}
                    className="text-[#2980B9] hover:underline"
                  >
                    {t("openOrdersList")}
                  </Link>
                ) : null}
              </p>
            )}
            {modalError && orderBridge ? (
              <p className="text-sm text-red-700">{modalError}</p>
            ) : null}
          </div>
        ) : null}
      </ModalShell>

      <ModalShell
        open={loginOpen && !!loginEmp}
        title={t("loginInfoTitle")}
        subtitle={t("loginInfoSubtitle")}
        onClose={() => {
          setLoginOpen(false);
          setLoginEmp(null);
          setLoginCopied(false);
          setOrgCopied(false);
          setLoginModalError(null);
        }}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            formId="workforce-login-form"
            onCancel={() => {
              setLoginOpen(false);
              setLoginEmp(null);
              setLoginCopied(false);
              setOrgCopied(false);
              setLoginModalError(null);
            }}
            busy={busy}
            submitDisabled={
              !!loginEmp &&
              loginEditSatelliteKeys.length > 0 &&
              !loginEditPin.trim() &&
              (loginEmp.roleBindings?.length ?? 0) === 0
            }
            cancelLabel={tCommon("cancel")}
            submitLabel={busy ? t("busy") : t("saveLoginAccess")}
          />
        }
      >
        {loginEmp ? (
          <form
            id="workforce-login-form"
            onSubmit={(e) => void saveLoginAccess(e)}
            className="space-y-4 text-[13px] text-[#34495E]"
          >
            <fieldset className="rounded-lg border border-[#D5DADF] p-3">
              <legend className="px-1 text-[11px] font-medium uppercase tracking-wide text-[#7F8C8D]">
                {t("satellitesAccess")}
              </legend>
              <p className="mb-2 text-xs text-[#7F8C8D]">{t("satelliteAccessEditHint")}</p>
              <div className="space-y-2">
                {satelliteFilterOptions.map((s) => {
                  const binding = (loginEmp.roleBindings ?? []).find(
                    (b) => b.satelliteKey === s.key,
                  );
                  const checked = loginEditSatelliteKeys.includes(s.key);
                  const href = satelliteLoginHref(s.key, workspaceOrgNo);
                  return (
                    <div
                      key={s.key}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-[#E8ECF0] px-3 py-2"
                    >
                      <label className="flex min-w-0 flex-1 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setLoginEditSatelliteKeys((prev) =>
                              e.target.checked
                                ? [...prev, s.key]
                                : prev.filter((k) => k !== s.key),
                            );
                          }}
                        />
                        <span className="font-medium text-[#2C3E50]">{s.label}</span>
                        {checked ? (
                          <span className="text-[#7F8C8D]">
                            {binding?.satelliteRole
                              ? humanizeSatelliteRole(binding.satelliteRole)
                              : t("roleFromMatrix")}
                          </span>
                        ) : null}
                        {binding?.provisionState === "FAILED" ? (
                          <span
                            className="text-[12px] text-[#C0392B]"
                            title={binding.lastProvisionError ?? undefined}
                          >
                            {t("provisionFailedBadge")}
                          </span>
                        ) : null}
                      </label>
                      {checked && href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] text-[#2980B9] hover:underline"
                        >
                          {t("openSatelliteLogin")}
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#7F8C8D]">
                {t("loginLabel")}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="min-w-[12rem] rounded-lg border border-[#D5DADF] px-2 py-1.5 font-mono text-[14px] text-[#2C3E50]"
                  value={loginEditLogin}
                  onChange={(e) => setLoginEditLogin(e.target.value)}
                  required={loginEditSatelliteKeys.length > 0}
                  disabled={loginEditSatelliteKeys.length === 0}
                  readOnly={loginEditSatelliteKeys.length === 0}
                />
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    void navigator.clipboard?.writeText(loginEditLogin).then(() => {
                      setLoginCopied(true);
                      window.setTimeout(() => setLoginCopied(false), 2000);
                    });
                  }}
                >
                  {loginCopied ? t("loginCopied") : t("copyLogin")}
                </button>
              </div>
              <p className="mt-1 text-[12px] text-[#7F8C8D]">{t("fieldStaffLoginHint")}</p>
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#7F8C8D]">
                {t("fieldStaffPin")}
              </span>
              <input
                className="block w-full max-w-[10rem] rounded-lg border border-[#D5DADF] px-2 py-1.5 font-mono text-[14px]"
                value={loginEditPin}
                onChange={(e) => setLoginEditPin(e.target.value)}
                required={
                  loginEditSatelliteKeys.length > 0 &&
                  (loginEmp.roleBindings?.length ?? 0) === 0
                }
                disabled={loginEditSatelliteKeys.length === 0}
                readOnly={loginEditSatelliteKeys.length === 0}
              />
              {loginEditSatelliteKeys.length > 0 ? (
                <p className="mt-1 text-[12px] text-[#7F8C8D]">{t("pinKeepHint")}</p>
              ) : null}
            </label>
            {workspaceOrgNo ? (
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#7F8C8D]">
                  {t("organizationIdLabel")}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="break-all rounded bg-[#F4F6F7] px-2 py-1 font-mono text-[12px] text-[#2C3E50]">
                    {workspaceOrgNo}
                  </code>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => {
                      void navigator.clipboard?.writeText(workspaceOrgNo).then(() => {
                        setOrgCopied(true);
                        window.setTimeout(() => setOrgCopied(false), 2000);
                      });
                    }}
                  >
                    {orgCopied ? t("loginCopied") : t("copyOrganizationId")}
                  </button>
                </div>
                <p className="mt-1 text-[12px] text-[#7F8C8D]">{t("organizationIdSharedHint")}</p>
              </div>
            ) : null}
            <p className="text-[12px] text-[#7F8C8D]">{t("syncEventualHint")}</p>
            {loginModalError ? (
              <p className="text-[13px] text-[#C0392B]">{loginModalError}</p>
            ) : null}
          </form>
        ) : null}
      </ModalShell>
      <WorkforceConfirmDialog
        open={pendingConfirm !== null}
        title={
          pendingConfirm?.kind === "terminate"
            ? t("terminateConfirm")
            : pendingConfirm?.kind === "reprovision"
              ? t("reprovisionConfirm")
              : t("hireWithoutFinConfirm")
        }
        body={
          pendingConfirm?.kind === "terminate"
            ? t("terminateConfirm")
            : pendingConfirm?.kind === "reprovision"
              ? t("reprovisionConfirm")
              : t("hireWithoutFinConfirm")
        }
        confirmLabel={tCommon("confirm")}
        cancelLabel={tCommon("cancel")}
        busy={busy}
        danger={pendingConfirm?.kind === "terminate"}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          const next = pendingConfirm;
          setPendingConfirm(null);
          if (!next) return;
          if (next.kind === "hireWithoutFin") void submitHire();
          else if (next.kind === "terminate") void submitTerminate(next.emp);
          else void submitReprovision(next.emp);
        }}
      />
    </div>
  );
}
