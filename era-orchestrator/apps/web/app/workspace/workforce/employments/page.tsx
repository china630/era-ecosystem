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
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  DEFAULT_LIST_PAGE_SIZE,
  EraListFilterBar,
  ListPaginationFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { todayBakuYmd } from "@era/satellite-kit/time";
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
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [notEntitled, setNotEntitled] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [satelliteKeys, setSatelliteKeys] = useState<string[]>([]);
  const [hireLogin, setHireLogin] = useState("");
  const [hirePin, setHirePin] = useState("");
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
  const [cardBlood, setCardBlood] = useState("");
  const [cardOrgUnitId, setCardOrgUnitId] = useState("");
  const [cardPositionId, setCardPositionId] = useState("");

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
    setModalError(null);
    setHireOpen(true);
    const opsRes = await mdmWorkforceFetch(`${personId}/ops-profile`);
    if (opsRes.ok) {
      const ops = (await opsRes.json()) as {
        displayName?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        finMasked?: string | null;
        primaryIdentifierMasked?: string | null;
      };
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
      setLoginEditPin(emp.satelliteStaffPin?.trim() || "");
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

  async function onResolvePerson() {
    if (
      busy ||
      !resolveFin.trim() ||
      !resolveFirstName.trim() ||
      !resolveLastName.trim()
    ) {
      return;
    }
    setBusy(true);
    setModalError(null);
    const res = await mdmWorkforceFetch("workforce-resolve", {
      method: "POST",
      body: JSON.stringify({
        fin: resolveFin.trim(),
        firstName: resolveFirstName.trim(),
        middleName: resolveMiddleName.trim() || undefined,
        lastName: resolveLastName.trim(),
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
        : tCommon("unnamedPerson"),
    );
    const fin = data.opsProfile?.primaryIdentifierMasked?.trim();
    setHireFinMasked(fin && fin !== "—" ? fin : resolveFin.trim() || null);

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
    if (busy || !globalPersonId.trim() || !orgUnitId || !positionId) return;
    if (satelliteKeys.length > 0 && !hirePin.trim()) {
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

  async function submitHire() {
    const hiredGpid = globalPersonId.trim();
    setBusy(true);
    setModalError(null);
    const res = await workforceFetch("employments/hire", {
      method: "POST",
      body: JSON.stringify({
        globalPersonId: hiredGpid,
        hireDate,
        orgUnitId,
        positionId,
        satelliteKeys,
        ...(hireLogin.trim() ? { login: hireLogin.trim().toLowerCase() } : {}),
        ...(hirePin.trim() ? { pin: hirePin.trim() } : {}),
      }),
    });
    if (!res.ok) {
      setModalError(await describeWorkforceError(res));
      setBusy(false);
      return;
    }
    setGlobalPersonId("");
    setSatelliteKeys([]);
    setHireLogin("");
    setHirePin("");
    setHireOpen(false);
    await load();
    void checkDualVoenAfterHire(hiredGpid);
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
    await load();
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
    if (hasSatellites && !loginEditPin.trim()) {
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
    setCardFirstName(person?.firstName ?? "");
    setCardMiddleName(person?.middleName ?? "");
    setCardLastName(person?.lastName ?? "");
    setCardSex(person?.sex && person.sex !== "UNKNOWN" ? person.sex : "");
    setCardBirthDate(person?.birthDate ?? "");
    setCardPhone("");
    setCardBlood("");
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
        firstName?: string | null;
        middleName?: string | null;
        lastName?: string | null;
        sex?: string | null;
        birthDate?: string | null;
        phoneMasked?: string | null;
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
    if (!actionEmp || !cardFirstName.trim() || !cardLastName.trim()) return;
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

      {dualVoenBanner ? (
        <div className={`${CARD_CONTAINER_CLASS} mb-4 flex flex-wrap items-start justify-between gap-3 p-4`}>
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

      <EraListFilterBar
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

      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : pagedRows.length === 0 ? (
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
                                  setLoginEditPin(r.satelliteStaffPin?.trim() || "");
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
              })}
            </tbody>
          </table>
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
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("fieldFirstName")}
              <input
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                value={resolveFirstName}
                onChange={(e) => setResolveFirstName(e.target.value)}
                required
              />
            </label>
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("fieldMiddleName")}
              <input
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                value={resolveMiddleName}
                onChange={(e) => setResolveMiddleName(e.target.value)}
              />
            </label>
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("fieldLastName")}
              <input
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                value={resolveLastName}
                onChange={(e) => setResolveLastName(e.target.value)}
                required
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("resolveFin")}
              <input
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                value={resolveFin}
                onChange={(e) => setResolveFin(e.target.value.toUpperCase())}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CatalogField
              kind="CLOSED_SMALL"
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
            />
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
            disabled={
              busy ||
              !resolveFin.trim() ||
              !resolveFirstName.trim() ||
              !resolveLastName.trim()
            }
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
          <DatePicker
            label={t("hireDate")}
            value={hireDate}
            onChange={setHireDate}
            placeholder={tCommon("datePlaceholder")}
            required
            fluid
          />
          <fieldset className="rounded-lg border border-[#D5DADF] p-3">
            <legend className="px-1 text-xs font-medium text-[#34495E]">
              {t("satelliteAccess")}
            </legend>
            <p className="mb-2 text-xs text-[#7F8C8D]">
              {t("satelliteAccessHint")}
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
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("fieldStaffLogin")}
              <input
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 font-mono text-[13px]"
                value={hireLogin}
                onChange={(e) => setHireLogin(e.target.value)}
                placeholder={t("fieldStaffLoginAutoPlaceholder")}
              />
            </label>
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("fieldStaffPin")}
              <input
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 font-mono text-[13px]"
                value={hirePin}
                onChange={(e) => setHirePin(e.target.value)}
                required={satelliteKeys.length > 0}
                aria-required={satelliteKeys.length > 0}
              />
              {satelliteKeys.length > 0 ? (
                <p className="mt-1 text-xs text-[#7F8C8D]">{t("pinRequired")}</p>
              ) : null}
            </label>
          </div>
          <p className="text-xs text-[#7F8C8D]">{t("fieldStaffLoginHint")}</p>
          <p className="text-xs text-[#7F8C8D]">{t("mdmHint")}</p>
          {modalError && hireOpen ? (
            <p className="text-sm text-red-700">{modalError}</p>
          ) : null}
          {!resolveFin.trim() && !hireFinMasked && globalPersonId ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              {t("hireWithoutFinBanner")}
            </p>
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
              disabled={
                busy ||
                !orgUnitId ||
                !positionId ||
                !globalPersonId ||
                (satelliteKeys.length > 0 && !hirePin.trim())
              }
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
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-[13px] font-medium text-[#34495E]">
                {t("fieldFirstName")}
                <input
                  className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                  value={cardFirstName}
                  onChange={(e) => setCardFirstName(e.target.value)}
                  required
                />
              </label>
              <label className="block text-[13px] font-medium text-[#34495E]">
                {t("fieldMiddleName")}
                <input
                  className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                  value={cardMiddleName}
                  onChange={(e) => setCardMiddleName(e.target.value)}
                />
              </label>
              <label className="block text-[13px] font-medium text-[#34495E]">
                {t("fieldLastName")}
                <input
                  className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                  value={cardLastName}
                  onChange={(e) => setCardLastName(e.target.value)}
                  required
                />
              </label>
            </div>
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
                emptyLabel={tCommon("select")}
              />
              <DatePicker
                label={t("fieldBirthDate")}
                value={cardBirthDate}
                onChange={setCardBirthDate}
                placeholder={tCommon("datePlaceholder")}
                fluid
              />
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
              emptyLabel={tCommon("select")}
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
              disabled={busy || !cardFirstName.trim() || !cardLastName.trim()}
            >
              {busy ? t("busy") : tCommon("save")}
            </button>
          </div>
        </form>
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
      >
        {loginEmp ? (
          <form onSubmit={(e) => void saveLoginAccess(e)} className="space-y-4 text-[13px] text-[#34495E]">
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
                required={loginEditSatelliteKeys.length > 0}
                disabled={loginEditSatelliteKeys.length === 0}
                readOnly={loginEditSatelliteKeys.length === 0}
              />
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
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => {
                  setLoginOpen(false);
                  setLoginEmp(null);
                  setLoginCopied(false);
                  setOrgCopied(false);
                  setLoginModalError(null);
                }}
              >
                {tCommon("cancel")}
              </button>
              <button
                type="submit"
                className={PRIMARY_BUTTON_CLASS}
                disabled={
                  busy ||
                  (loginEditSatelliteKeys.length > 0 && !loginEditPin.trim())
                }
              >
                {busy ? t("busy") : t("saveLoginAccess")}
              </button>
            </div>
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
    </>
  );
}
