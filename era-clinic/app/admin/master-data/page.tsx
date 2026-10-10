"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { localizedCatalogDescription } from "@era/clinic-domain";
import { PractitionerScheduleModal } from "@/components/PractitionerScheduleModal";
import { CatalogMultiAdder, catalogNameThenCode } from "@/components/catalog-multi-adder";
import {
  SortableTh,
  sortRows,
  toggleColumnSort,
  type ColumnSort,
} from "@/components/sortable-column-header";
import { PHYSIO_ORDER_FIELD_CODES } from "@/domain/physio/physio-order-fields";
import { inferPhysioTypeGate } from "@/domain/physio/physio-type-gate";
import {
  applyPhysicalResourcePool,
  physicalResourceCodesFromRequirements,
} from "@/domain/procedure/procedure-physical-pool";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  countryOptions,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FieldRow,
  FieldSelect,
  FIELD_SECTION_CLASS,
  LINK_ACCENT_CLASS,
  ListPaginationFooter,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SUBSECTION_SURFACE_CLASS,
  TAB_ITEM_ACTIVE_CLASS,
  TAB_ITEM_CLASS,
  TAB_STRIP_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

type Practitioner = {
  id: string;
  code: string;
  fullName: string;
  specialty?: string | null;
  staffKind?: "DOCTOR" | "NURSE" | "LAB" | "BATH" | "MASSAGE";
  globalPersonId?: string | null;
  financeEmployeeId?: string | null;
  defaultSlotMinutes?: number | null;
  active?: boolean;
};

type WorkforcePolicy = {
  hireMode: "cp_workforce" | "disabled";
};

type IdentifierChip = { type: string; isPrimary: boolean };

type Room = { id: string; code: string; name: string };

type Resource = {
  id: string;
  code: string;
  name: string;
  kind: string;
  capacity: number;
  roomId?: string | null;
  room?: { code: string; name?: string } | null;
  extendedEndHour?: number | null;
};

type ProcedureType = {
  id: string;
  code: string;
  name: string;
  durationMin: number;
  resourceGapMinutes?: number;
  patientRestMinutes?: number;
  resourceCode?: string | null;
  bodyPart?: string | null;
  needsSite?: boolean;
  physioOrderFields?: string[];
  allowedSiteCodes?: string[];
  extendedEndHour?: number | null;
  financeSku?: string | null;
  skillCoverage?: number | null;
  requirements?: RequirementRow[];
  _count?: { skills?: number };
};

type CatalogOption = {
  code: string;
  description: string;
  descriptionAz?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
};

type RequirementRow = {
  id?: string;
  role: "LOCATION" | "EQUIPMENT" | "STAFF";
  resourceKind?: "ROOM" | "EQUIPMENT" | null;
  resourceCode?: string | null;
  quantity?: number;
  staffMode?: "HARD" | "SOFT";
  required?: boolean;
};

type ConsumableRow = {
  id?: string;
  sku: string;
  financeProductId?: string | null;
  qtyPerSession: number;
  wasteFactor?: number;
  label?: string;
};

type FinanceProductOption = { value: string; label: string; id?: string; name?: string };

type Tab = "practitioners" | "rooms" | "resources" | "procedureTypes";

function maskPersonId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

const BODY_PARTS = [
  "HEAD",
  "NECK",
  "CHEST",
  "BACK",
  "ABDOMEN",
  "ARM_LEFT",
  "ARM_RIGHT",
  "LEG_LEFT",
  "LEG_RIGHT",
  "FULL_BODY",
] as const;

function displayProcedureResourceNames(
  row: ProcedureType,
  resources: Array<{ code: string; name: string }>,
): string {
  const fromReqs = row.requirements?.length
    ? physicalResourceCodesFromRequirements(row.requirements)
    : [];
  const codes = fromReqs.length > 0 ? fromReqs : row.resourceCode?.trim() ? [row.resourceCode.trim()] : [];
  if (codes.length === 0) return "—";
  return codes
    .map((code) => resources.find((resource) => resource.code === code)?.name?.trim() || code)
    .join(", ");
}

function defaultProcedureRequirements(): RequirementRow[] {
  return [
    {
      role: "EQUIPMENT",
      resourceKind: "EQUIPMENT",
      resourceCode: null,
      quantity: 1,
      staffMode: "HARD",
      required: true,
    },
    {
      role: "STAFF",
      staffMode: "SOFT",
      quantity: 1,
      required: true,
    },
  ];
}

function matchesFilter(
  q: string,
  fields: Array<string | null | undefined>,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(needle));
}

export default function MasterDataPage() {
  const t = useTranslations("masterData");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("practitioners");
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [needsSite, setNeedsSite] = useState(true);
  const [needsExtraFields, setNeedsExtraFields] = useState(false);
  const [physioOrderFields, setPhysioOrderFields] = useState<string[]>([]);
  const [allowedSiteCodes, setAllowedSiteCodes] = useState<string[]>([]);
  const [physioSiteOptions, setPhysioSiteOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [mdmStatus, setMdmStatus] = useState<string | null>(null);
  const [mdmEditorOpen, setMdmEditorOpen] = useState(true);
  const [globalPersonId, setGlobalPersonId] = useState<string | null>(null);
  const [identifierTypes, setIdentifierTypes] = useState<IdentifierChip[]>([]);
  const [workforcePolicy, setWorkforcePolicy] = useState<WorkforcePolicy | null>(null);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [consumables, setConsumables] = useState<ConsumableRow[]>([]);
  const [financeProductOptions, setFinanceProductOptions] = useState<FinanceProductOption[]>([]);
  const [financeServiceOptions, setFinanceServiceOptions] = useState<FinanceProductOption[]>([]);
  const [financeProductQ, setFinanceProductQ] = useState("");
  const debouncedFinanceQ = useDebouncedValue(financeProductQ, 300);
  const [financeServiceQ, setFinanceServiceQ] = useState("");
  const debouncedFinanceServiceQ = useDebouncedValue(financeServiceQ, 300);
  const [skillCoverageMsg, setSkillCoverageMsg] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<{ id: string; name: string } | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [blockedNonCabin, setBlockedNonCabin] = useState<Array<{ code: string; name: string }>>(
    [],
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<ColumnSort | null>(null);

  const cpWorkforceMode = workforcePolicy?.hireMode === "cp_workforce";
  const blockPractitionerCreate = cpWorkforceMode;

  const loadAll = useCallback(async () => {
    const [p, r, res, pt, wp, cat, sites] = await Promise.all([
      fetch(
        showInactive ? "/api/admin/practitioners?includeInactive=1" : "/api/admin/practitioners",
      ).then((x) => x.json()),
      fetch("/api/admin/rooms").then((x) => x.json()),
      fetch("/api/admin/resources").then((x) => x.json()),
      fetch(`/api/admin/procedure-types?locale=${encodeURIComponent(locale)}`).then((x) =>
        x.json(),
      ),
      fetch("/api/admin/workforce-policy").then((x) => x.json()),
      fetch("/api/admin/catalog?kind=PROCEDURE").then((x) => x.json()),
      fetch("/api/admin/physio-sites").then((x) => x.json()),
    ]);
    setPractitioners((p.data ?? p) as Practitioner[]);
    setRooms((r.data ?? r) as Room[]);
    setResources((res.data ?? res) as Resource[]);
    const ptRaw = (pt.data ?? pt) as
      | ProcedureType[]
      | { items?: ProcedureType[]; blockedNonCabin?: Array<{ code: string; name: string }> };
    setProcedureTypes(Array.isArray(ptRaw) ? ptRaw : (ptRaw.items ?? []));
    setBlockedNonCabin(Array.isArray(ptRaw) ? [] : (ptRaw.blockedNonCabin ?? []));
    const catalogRows = (cat.data ?? cat) as CatalogOption[];
    setCatalogOptions(
      Array.isArray(catalogRows)
        ? catalogRows.map((row) => ({
            code: row.code,
            description: localizedCatalogDescription(row, locale),
            descriptionAz: row.descriptionAz,
            descriptionRu: row.descriptionRu,
            descriptionEn: row.descriptionEn,
          }))
        : [],
    );
    const siteRows = (sites.data ?? sites) as Array<{
      code: string;
      titleAz?: string;
      titleRu?: string;
      titleEn?: string;
      active?: boolean;
    }>;
    setPhysioSiteOptions(
      Array.isArray(siteRows)
        ? siteRows
            .filter((s) => s.active !== false)
            .map((s) => ({
              value: s.code,
              label: catalogNameThenCode(
                (locale.startsWith("ru")
                  ? s.titleRu
                  : locale.startsWith("az")
                    ? s.titleAz
                    : s.titleEn) || s.code,
                s.code,
              ),
            }))
            .sort((a, b) => a.label.localeCompare(b.label, locale))
        : [],
    );
    const policyPayload = (wp.data ?? wp) as WorkforcePolicy;
    if (policyPayload?.hireMode) setWorkforcePolicy(policyPayload);
  }, [locale, showInactive]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!modalOpen || tab !== "procedureTypes") return;
    let cancelled = false;
    void (async () => {
      const params = new URLSearchParams({ limit: "30", isService: "false" });
      if (debouncedFinanceQ.trim()) params.set("q", debouncedFinanceQ.trim());
      const res = await fetch(`/api/admin/finance-products?${params}`);
      if (!res.ok || cancelled) return;
      const parsed = await res.json();
      const payload = (parsed.data ?? parsed) as {
        items?: Array<{ value: string; label: string; id?: string; name?: string; sku?: string }>;
      };
      const items = payload.items ?? [];
      if (!cancelled) {
        setFinanceProductOptions(
          items.map((p) => ({
            value: p.sku ?? p.value,
            label: p.label,
            id: p.id,
            name: p.name,
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalOpen, tab, debouncedFinanceQ]);

  useEffect(() => {
    if (!modalOpen || tab !== "procedureTypes") return;
    let cancelled = false;
    void (async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (debouncedFinanceServiceQ.trim()) params.set("q", debouncedFinanceServiceQ.trim());
      const res = await fetch(`/api/admin/catalog?${params}`);
      if (!res.ok || cancelled) return;
      const parsed = await res.json();
      const rows = (parsed.data ?? parsed) as Array<{
        code: string;
        description?: string | null;
        descriptionAz?: string | null;
        descriptionRu?: string | null;
        descriptionEn?: string | null;
      }>;
      if (!cancelled) {
        setFinanceServiceOptions(
          (Array.isArray(rows) ? rows : []).map((row) => {
            const name = localizedCatalogDescription(row, locale);
            return {
              value: row.code,
              label: name && name !== row.code ? `${row.code} — ${name}` : row.code,
            };
          }),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalOpen, tab, debouncedFinanceServiceQ, locale]);

  useEffect(() => {
    setQ("");
    setPage(1);
    setSort(null);
  }, [tab]);

  function onSort(key: string) {
    setSort((current) => toggleColumnSort(current, key));
    setPage(1);
  }

  const filteredPractitioners = useMemo(
    () =>
      practitioners.filter((row) =>
        matchesFilter(debouncedQ, [row.code, row.fullName, row.specialty, row.staffKind]),
      ),
    [practitioners, debouncedQ],
  );
  const filteredRooms = useMemo(
    () => rooms.filter((row) => matchesFilter(debouncedQ, [row.code, row.name])),
    [rooms, debouncedQ],
  );
  const filteredResources = useMemo(
    () =>
      resources.filter((row) =>
        matchesFilter(debouncedQ, [row.code, row.name, row.kind, row.room?.code, row.room?.name]),
      ),
    [resources, debouncedQ],
  );
  const filteredProcedureTypes = useMemo(
    () =>
      procedureTypes.filter((row) =>
        matchesFilter(debouncedQ, [
          row.code,
          row.name,
          row.resourceCode,
          displayProcedureResourceNames(row, resources),
        ]),
      ),
    [procedureTypes, resources, debouncedQ],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, pageSize]);

  const activeFilteredTotal = useMemo(() => {
    switch (tab) {
      case "practitioners":
        return filteredPractitioners.length;
      case "rooms":
        return filteredRooms.length;
      case "resources":
        return filteredResources.length;
      case "procedureTypes":
        return filteredProcedureTypes.length;
    }
  }, [
    tab,
    filteredPractitioners.length,
    filteredRooms.length,
    filteredResources.length,
    filteredProcedureTypes.length,
  ]);

  function slicePage<T>(arr: T[]): T[] {
    const start = (page - 1) * pageSize;
    return arr.slice(start, start + pageSize);
  }

  const sortedPractitioners = useMemo(
    () =>
      sortRows(filteredPractitioners, sort, (row, key) => {
        if (key === "name") return row.fullName;
        if (key === "code") return row.code;
        if (key === "staffKind") {
          if (row.staffKind === "NURSE") return t("staffKindNurse");
          if (row.staffKind === "LAB") return t("staffKindLab");
          if (row.staffKind === "BATH") return t("staffKindBath");
          if (row.staffKind === "MASSAGE") return t("staffKindMassage");
          return t("staffKindDoctor");
        }
        if (key === "specialty") return row.specialty ?? "";
        if (key === "mdm") return row.globalPersonId ? 1 : 0;
        if (key === "finance") return row.financeEmployeeId ? 1 : 0;
        if (key === "slot") return row.defaultSlotMinutes ?? null;
        return "";
      }),
    [filteredPractitioners, sort, t],
  );
  const sortedRooms = useMemo(
    () =>
      sortRows(filteredRooms, sort, (row, key) => (key === "code" ? row.code : row.name)),
    [filteredRooms, sort],
  );
  const sortedResources = useMemo(
    () =>
      sortRows(filteredResources, sort, (row, key) => {
        if (key === "code") return row.code;
        if (key === "kind") return row.kind;
        if (key === "room") return row.room?.name?.trim() || row.room?.code || "";
        return row.name;
      }),
    [filteredResources, sort],
  );
  const sortedProcedureTypes = useMemo(
    () =>
      sortRows(filteredProcedureTypes, sort, (row, key) => {
        if (key === "code") return row.code;
        if (key === "duration") return row.durationMin;
        if (key === "gap") return row.resourceGapMinutes ?? 5;
        if (key === "rest") return row.patientRestMinutes ?? 15;
        if (key === "resource") return displayProcedureResourceNames(row, resources);
        return row.name;
      }),
    [filteredProcedureTypes, resources, sort],
  );

  const pagedPractitioners = useMemo(
    () => slicePage(sortedPractitioners),
    [sortedPractitioners, page, pageSize],
  );
  const pagedRooms = useMemo(() => slicePage(sortedRooms), [sortedRooms, page, pageSize]);
  const pagedResources = useMemo(
    () => slicePage(sortedResources),
    [sortedResources, page, pageSize],
  );
  const pagedProcedureTypes = useMemo(
    () => slicePage(sortedProcedureTypes),
    [sortedProcedureTypes, page, pageSize],
  );

  function resetModalExtras() {
    setMdmStatus(null);
    setMdmEditorOpen(true);
    setGlobalPersonId(null);
    setIdentifierTypes([]);
    setSelectedSkillIds([]);
    setRequirements([]);
    setConsumables([]);
    setFinanceProductQ("");
    setFinanceServiceQ("");
    setSkillCoverageMsg(null);
    setNeedsSite(true);
    setNeedsExtraFields(false);
    setPhysioOrderFields([]);
    setAllowedSiteCodes([]);
  }

  function openCreate() {
    if (tab === "practitioners" && blockPractitionerCreate) return;
    setEditingId(null);
    setForm({});
    resetModalExtras();
    if (tab === "procedureTypes") {
      setRequirements(defaultProcedureRequirements());
      setConsumables([]);
    }
    setModalOpen(true);
  }

  async function openEditPractitioner(row: Practitioner) {
    setEditingId(row.id);
    setForm({
      code: row.code ?? "",
      fullName: row.fullName ?? "",
      staffKind: row.staffKind ?? "DOCTOR",
      finCode: "",
      passportNumber: "",
      issuingCountry: "",
    });
    setGlobalPersonId(row.globalPersonId ?? null);
    setMdmEditorOpen(!row.globalPersonId);
    setMdmStatus(
      row.globalPersonId
        ? t("mdmLinked", { id: maskPersonId(row.globalPersonId) })
        : null,
    );
    setRequirements([]);
    setSkillCoverageMsg(null);
    if (row.globalPersonId) {
      const res = await fetch(
        `/api/mdm/person-identifiers?globalPersonId=${encodeURIComponent(row.globalPersonId)}`,
      );
      const parsed = await res.json();
      const payload = (parsed.data ?? parsed) as { identifiers?: IdentifierChip[] };
      setIdentifierTypes(payload.identifiers ?? []);
    } else {
      setIdentifierTypes([]);
    }
    const skillsRes = await fetch(`/api/admin/practitioners/${row.id}/skills`);
    const skillsParsed = await skillsRes.json();
    const skillsPayload = (skillsParsed.data ?? skillsParsed) as Array<{
      procedureTypeId?: string;
      procedureType?: { id: string };
    }>;
    setSelectedSkillIds(
      (Array.isArray(skillsPayload) ? skillsPayload : []).map(
        (s) => s.procedureTypeId ?? s.procedureType?.id ?? "",
      ).filter(Boolean),
    );
    setModalOpen(true);
  }

  function openEditRoom(row: Room) {
    setEditingId(row.id);
    setForm({ code: row.code, name: row.name });
    resetModalExtras();
    setModalOpen(true);
  }

  function openEditResource(row: Resource) {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      kind: row.kind,
      capacity: String(row.capacity),
      roomId: row.roomId ?? "",
      extendedEndHour: row.extendedEndHour != null ? String(row.extendedEndHour) : "",
    });
    resetModalExtras();
    setModalOpen(true);
  }

  async function openEditProcedureType(row: ProcedureType) {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      durationMin: String(row.durationMin),
      resourceGapMinutes: String(row.resourceGapMinutes ?? 5),
      patientRestMinutes: String(row.patientRestMinutes ?? 15),
      bodyPart: row.bodyPart ?? "",
      extendedEndHour: row.extendedEndHour != null ? String(row.extendedEndHour) : "",
      financeSku: row.financeSku?.trim() || row.code,
    });
    setNeedsSite(row.needsSite !== false);
    setPhysioOrderFields(row.physioOrderFields ?? []);
    setNeedsExtraFields((row.physioOrderFields ?? []).length > 0);
    setAllowedSiteCodes(row.allowedSiteCodes ?? []);
    setFinanceServiceQ(row.financeSku?.trim() || row.code);
    setMdmStatus(null);
    setGlobalPersonId(null);
    setIdentifierTypes([]);
    setSelectedSkillIds([]);
    const coverage = row.skillCoverage ?? row._count?.skills;
    setSkillCoverageMsg(
      coverage != null ? t("skillCoverage", { count: coverage }) : null,
    );
    const reqRes = await fetch(`/api/admin/procedure-types/${row.id}/requirements`);
    const reqParsed = await reqRes.json();
    const reqPayload = (reqParsed.data ?? reqParsed) as RequirementRow[];
    const rows = Array.isArray(reqPayload) ? reqPayload : [];
    setRequirements(rows.length > 0 ? rows : defaultProcedureRequirements());
    const consRes = await fetch(`/api/admin/procedure-types/${row.id}/consumables`);
    const consParsed = await consRes.json();
    const consPayload = (consParsed.data ?? consParsed) as ConsumableRow[];
    setConsumables(
      Array.isArray(consPayload)
        ? consPayload.map((c) => ({
            id: c.id,
            sku: c.sku,
            financeProductId: c.financeProductId ?? null,
            qtyPerSession: Number(c.qtyPerSession) || 1,
            wasteFactor: Number(c.wasteFactor) || 0,
            label: c.sku,
          }))
        : [],
    );
    setModalOpen(true);
  }

  async function lookupMdm() {
    const fullName = (form.fullName ?? form.name ?? "").trim();
    if (!fullName) {
      setMdmStatus(t("nameRequired"));
      return;
    }
    const res = await fetch("/api/mdm/person-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fin: form.finCode?.trim() || undefined,
        passport: form.passportNumber?.trim() || undefined,
        issuingCountry: form.issuingCountry?.trim() || undefined,
        fullName,
        phone: form.phone?.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (data.globalPersonId) {
      setGlobalPersonId(data.globalPersonId);
      setMdmStatus(t("mdmLinked", { id: maskPersonId(data.globalPersonId) }));
    } else {
      setGlobalPersonId(null);
      setMdmStatus(t("mdmNotFound"));
    }
  }

  async function save() {
    const base =
      tab === "practitioners"
        ? "/api/admin/practitioners"
        : tab === "rooms"
          ? "/api/admin/rooms"
          : tab === "resources"
            ? "/api/admin/resources"
            : "/api/admin/procedure-types";

    let payload: Record<string, unknown> = {};
    if (editingId) {
      if (tab === "practitioners") {
        const opsOnly =
          cpWorkforceMode ||
          Boolean(practitioners.find((x) => x.id === editingId)?.financeEmployeeId);
        payload = opsOnly
          ? {
              staffKind: form.staffKind || undefined,
            }
          : {
              fullName: form.fullName ?? form.name,
              staffKind: form.staffKind || undefined,
              finCode: form.finCode?.trim() || undefined,
              passportNumber: form.passportNumber?.trim() || undefined,
              issuingCountry: form.issuingCountry?.trim() || undefined,
              globalPersonId: globalPersonId || undefined,
            };
      } else if (tab === "rooms") {
        payload = { name: form.name };
      } else if (tab === "resources") {
        payload = {
          name: form.name,
          kind: form.kind || "EQUIPMENT",
          capacity: Number(form.capacity || "1"),
          roomId: form.roomId?.trim() ? form.roomId.trim() : null,
          extendedEndHour: form.extendedEndHour?.trim()
            ? Number(form.extendedEndHour)
            : null,
        };
      } else {
        payload = {
          name: form.name ?? form.fullName,
          durationMin: Number(form.durationMin || "30"),
          resourceGapMinutes: Number(form.resourceGapMinutes ?? "5"),
          patientRestMinutes: Number(form.patientRestMinutes ?? "15"),
          bodyPart: form.bodyPart?.trim() ? form.bodyPart.trim() : null,
          needsSite,
          physioOrderFields,
          allowedSiteCodes,
          extendedEndHour: form.extendedEndHour?.trim()
            ? Number(form.extendedEndHour)
            : null,
          financeSku: form.financeSku?.trim() || null,
        };
      }
    } else if (tab === "practitioners") {
      payload = {
        code: form.code,
        fullName: form.fullName ?? form.name,
        staffKind: form.staffKind || undefined,
        finCode: form.finCode?.trim() || undefined,
        passportNumber: form.passportNumber?.trim() || undefined,
        issuingCountry: form.issuingCountry?.trim() || undefined,
        globalPersonId: globalPersonId || undefined,
      };
    } else if (tab === "rooms") {
      payload = { code: form.code, name: form.name };
    } else if (tab === "resources") {
      payload = {
        code: form.code,
        name: form.name,
        kind: form.kind || "EQUIPMENT",
        capacity: Number(form.capacity || "1"),
        roomId: form.roomId?.trim() ? form.roomId.trim() : null,
        extendedEndHour: form.extendedEndHour?.trim()
          ? Number(form.extendedEndHour)
          : null,
      };
    } else {
      payload = {
        code: form.code,
        durationMin: Number(form.durationMin || "30"),
        resourceGapMinutes: Number(form.resourceGapMinutes ?? "5"),
        patientRestMinutes: Number(form.patientRestMinutes ?? "15"),
        bodyPart: form.bodyPart?.trim() ? form.bodyPart.trim() : null,
        needsSite,
        physioOrderFields,
        allowedSiteCodes,
        extendedEndHour: form.extendedEndHour?.trim()
          ? Number(form.extendedEndHour)
          : null,
      };
    }

    const url = editingId ? `${base}/${editingId}` : base;
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({})), tc("saveFailed"));
      return;
    }
    const saved = await res.json();
    const savedData = (saved.data ?? saved) as ProcedureType & { id?: string };

    if (tab === "practitioners" && editingId) {
      const skillsRes = await fetch(`/api/admin/practitioners/${editingId}/skills`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureTypeIds: selectedSkillIds }),
      });
      if (!skillsRes.ok) {
        showApiError(await skillsRes.json().catch(() => ({})), tc("saveFailed"));
        return;
      }
    }

    if (tab === "procedureTypes") {
      const typeId = (editingId ?? savedData.id) as string | undefined;
      if (typeId) {
        const reqRes = await fetch(`/api/admin/procedure-types/${typeId}/requirements`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requirements: requirements.map((r) => ({
              role: r.role,
              resourceKind: r.resourceKind ?? null,
              resourceCode: r.resourceCode?.trim() ? r.resourceCode.trim() : null,
              quantity: r.quantity ?? 1,
              staffMode:
                r.role === "STAFF" ? (r.staffMode ?? "SOFT") : (r.staffMode ?? "HARD"),
              required: r.required ?? true,
            })),
          }),
        });
        if (!reqRes.ok) {
          showApiError(await reqRes.json().catch(() => ({})), tc("saveFailed"));
          return;
        }
        const consRes = await fetch(`/api/admin/procedure-types/${typeId}/consumables`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: consumables
              .filter((c) => c.sku.trim())
              .map((c) => ({
                sku: c.sku.trim(),
                financeProductId: c.financeProductId ?? null,
                qtyPerSession: Number(c.qtyPerSession) || 1,
                wasteFactor: Number(c.wasteFactor) || 0,
              })),
          }),
        });
        if (!consRes.ok) {
          showApiError(await consRes.json().catch(() => ({})), tc("saveFailed"));
          return;
        }
        const poolCodes = physicalResourceCodesFromRequirements(requirements);
        const firstCode = poolCodes[0];
        if (firstCode) {
          const linked = resources.find((r) => r.code === firstCode);
          await fetch(`/api/admin/procedure-types/${typeId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resourceCode: firstCode,
              resourceKind: linked?.kind === "ROOM" ? "ROOM" : "EQUIPMENT",
            }),
          });
        }
      }

      const coverage = savedData.skillCoverage ?? savedData._count?.skills;
      if (coverage != null) {
        setSkillCoverageMsg(t("skillCoverage", { count: coverage }));
      }
    }

    setModalOpen(false);
    showSuccess(tc("saved"));
    await loadAll();
  }

  async function remove(id: string) {
    if (!window.confirm(tc("confirmDelete"))) return;
    const base =
      tab === "practitioners"
        ? `/api/admin/practitioners/${id}`
        : tab === "rooms"
          ? `/api/admin/rooms/${id}`
          : tab === "resources"
            ? `/api/admin/resources/${id}`
            : `/api/admin/procedure-types/${id}`;
    const res = await fetch(base, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { code?: string };
      if (body.code === "WORKFORCE_DEACTIVATE_VIA_CP") showApiError({ error: t("deleteViaWorkforce") });
      else if (body.code === "IN_USE") showApiError({ error: t("deleteInUse") });
      else showApiError(body, tc("failed"));
      return;
    }
    await loadAll();
  }

  const resourcePoolOptions = useMemo(
    () =>
      [...resources]
        .sort((a, b) => a.name.localeCompare(b.name, locale) || a.code.localeCompare(b.code))
        .map((r) => ({
          value: r.code,
          label: catalogNameThenCode(r.name, r.code),
        })),
    [resources, locale],
  );

  function updateRequirement(index: number, patch: Partial<RequirementRow>) {
    setRequirements((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "practitioners", label: t("practitioners") },
    { id: "rooms", label: t("rooms") },
    { id: "resources", label: t("resources") },
    { id: "procedureTypes", label: t("procedureTypes") },
  ];

  const opsLocked =
    Boolean(editingId) &&
    (cpWorkforceMode ||
      Boolean(practitioners.find((x) => x.id === editingId)?.financeEmployeeId));

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            {!(tab === "practitioners" && blockPractitionerCreate) ? (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden />
                {tc("add")}
              </button>
            ) : null}
          </>
        }
      />
      {cpWorkforceMode && tab === "practitioners" ? (
        <p className={`mb-3 ${SUBSECTION_SURFACE_CLASS} p-3 text-[13px]`}>
          {t("workforceHireViaCp")}
        </p>
      ) : null}
      <div className={TAB_STRIP_CLASS}>
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            className={tab === x.id ? TAB_ITEM_ACTIVE_CLASS : TAB_ITEM_CLASS}
            onClick={() => setTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      {tab === "procedureTypes" && blockedNonCabin.length > 0 ? (
        <p className={`mb-3 text-[13px] ${TEXT_DANGER_CLASS}`}>
          {t("blockedNonCabin", { codes: blockedNonCabin.map((row) => row.code).join(", ") })}
        </p>
      ) : null}
      <EraListFilterBar
        className="max-w-md"
        resetLabel={tc("filterReset")}
        onReset={() => setQ("")}
      >
        <Field
          label={t("filterPlaceholder")}
          preset="shortText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {tab === "practitioners" ? (
          <label className="flex items-center gap-2 self-end pb-2 text-[13px]">
            <input
              type="checkbox"
              className={MODAL_CHECKBOX_CLASS}
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            {t("showInactive")}
          </label>
        ) : null}
      </EraListFilterBar>
      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          {tab === "practitioners" && (
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <SortableTh label={t("name")} columnKey="name" sort={sort} onSort={onSort} />
                  <SortableTh label={t("code")} columnKey="code" sort={sort} onSort={onSort} />
                  <SortableTh label={t("staffKind")} columnKey="staffKind" sort={sort} onSort={onSort} />
                  <SortableTh label={t("mdmBadge")} columnKey="mdm" sort={sort} onSort={onSort} />
                  <SortableTh label={t("financeLinked")} columnKey="finance" sort={sort} onSort={onSort} />
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {pagedPractitioners.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.fullName}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.staffKind === "NURSE"
                        ? t("staffKindNurse")
                        : row.staffKind === "LAB"
                          ? t("staffKindLab")
                          : row.staffKind === "BATH"
                            ? t("staffKindBath")
                            : row.staffKind === "MASSAGE"
                              ? t("staffKindMassage")
                              : t("staffKindDoctor")}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.globalPersonId ? (
                        <span className={TEXT_SUCCESS_CLASS}>{maskPersonId(row.globalPersonId)}</span>
                      ) : (
                        <span className={TEXT_DANGER_CLASS}>{t("mdmMissing")}</span>
                      )}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.financeEmployeeId ? (
                        <span className={LINK_ACCENT_CLASS}>{t("financeLinkedYes")}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("edit")}
                          onClick={() => void openEditPractitioner(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={t("scheduleAction")}
                          onClick={() => setScheduleFor({ id: row.id, name: row.fullName })}
                        >
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("delete")}
                          onClick={() => void remove(row.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "rooms" && (
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <SortableTh label={t("name")} columnKey="name" sort={sort} onSort={onSort} />
                  <SortableTh label={t("code")} columnKey="code" sort={sort} onSort={onSort} />
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRooms.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("edit")}
                          onClick={() => openEditRoom(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("delete")}
                          onClick={() => void remove(row.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "resources" && (
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <SortableTh label={t("name")} columnKey="name" sort={sort} onSort={onSort} />
                  <SortableTh label={t("code")} columnKey="code" sort={sort} onSort={onSort} />
                  <SortableTh label={t("kind")} columnKey="kind" sort={sort} onSort={onSort} />
                  <SortableTh label={t("room")} columnKey="room" sort={sort} onSort={onSort} />
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {pagedResources.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.kind}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.room?.name?.trim() || row.room?.code || "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("edit")}
                          onClick={() => openEditResource(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("delete")}
                          onClick={() => void remove(row.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "procedureTypes" && (
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <SortableTh label={t("name")} columnKey="name" sort={sort} onSort={onSort} />
                  <SortableTh label={t("code")} columnKey="code" sort={sort} onSort={onSort} />
                  <SortableTh label={t("durationMin")} columnKey="duration" sort={sort} onSort={onSort} />
                  <SortableTh label={t("resourceGapMinutes")} columnKey="gap" sort={sort} onSort={onSort} />
                  <SortableTh label={t("patientRestMinutes")} columnKey="rest" sort={sort} onSort={onSort} />
                  <SortableTh label={t("resourceCode")} columnKey="resource" sort={sort} onSort={onSort} />
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {pagedProcedureTypes.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-center`}>{row.durationMin}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-center`}>{row.resourceGapMinutes ?? 5}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-center`}>{row.patientRestMinutes ?? 15}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{displayProcedureResourceNames(row, resources)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("edit")}
                          onClick={() => void openEditProcedureType(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("delete")}
                          onClick={() => void remove(row.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={activeFilteredTotal}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          labels={{
            rowsPerPage: tc("rowsPerPage"),
            pageOf: tc("pageOf"),
            prev: tc("prev"),
            next: tc("next"),
          }}
        />
      </div>

      <ModalShell
        open={modalOpen}
        title={editingId ? tc("edit") : tc("add")}
        onClose={() => setModalOpen(false)}
        maxWidthClass={tab === "procedureTypes" ? "max-w-5xl" : "max-w-lg"}
        closeLabel={tc("close")}
      >
        <div className="space-y-4">
          {tab === "procedureTypes" ? (
            <>
              <CatalogField
                kind="SEARCHABLE"
                label={t("serviceFromCatalog")}
                value={form.code ?? ""}
                emptyLabel="—"
                options={catalogOptions.map((c) => ({
                  value: c.code,
                  label: localizedCatalogDescription(c, locale) || c.code,
                }))}
                onChange={(next) => {
                  if (editingId) return;
                  const code = String(next ?? "");
                  const match = catalogOptions.find((c) => c.code === code);
                  if (match) {
                    const gate = inferPhysioTypeGate(match.code, match.description);
                    const sku = form.financeSku ?? "";
                    const follow = !sku.trim() || sku === (form.code ?? "");
                    if (follow) setFinanceServiceQ(match.code);
                    setForm({
                      ...form,
                      code: match.code,
                      ...(follow ? { financeSku: match.code } : {}),
                    });
                    setNeedsSite(gate.needsSite);
                    setPhysioOrderFields(gate.fields);
                    setNeedsExtraFields(gate.fields.length > 0);
                    setAllowedSiteCodes(gate.allowedSiteCodes);
                  } else {
                    const sku = form.financeSku ?? "";
                    const follow = !sku.trim() || sku === (form.code ?? "");
                    if (follow) setFinanceServiceQ(code);
                    setForm({ ...form, code, ...(follow ? { financeSku: code } : {}) });
                  }
                }}
              />
              {form.code ? (
                <div className="flex flex-wrap gap-3 text-[13px]">
                  {(
                    [
                      ["descriptionAz", "AZ"],
                      ["descriptionRu", "RU"],
                      ["descriptionEn", "EN"],
                    ] as const
                  ).map(([key, lang]) => {
                    const match = catalogOptions.find((c) => c.code === form.code);
                    const text = match?.[key]?.trim();
                    return (
                      <a
                        key={key}
                        className="text-[#1F4E79] underline"
                        href={`/admin/catalog?edit=${encodeURIComponent(form.code ?? "")}`}
                      >
                        {text || lang}
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : null}
          {!editingId &&
            (tab === "practitioners" || tab === "rooms" || tab === "resources") && (
              <Field
                label={t("code")}
                preset="code"
                value={form.code ?? ""}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            )}
          {(tab === "practitioners" || tab === "resources") && (
            <Field
              label={t("name")}
              preset="shortText"
              value={form.fullName ?? form.name ?? ""}
              onChange={(e) =>
                setForm({ ...form, fullName: e.target.value, name: e.target.value })
              }
            />
          )}
          {tab === "rooms" && (
            <Field
              label={t("name")}
              preset="shortText"
              value={form.name ?? ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          )}
          {tab === "practitioners" && (
            <>
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("staffKind")}
                value={form.staffKind || "DOCTOR"}
                onChange={(v) => setForm({ ...form, staffKind: String(v) })}
                options={[
                  { value: "DOCTOR", label: t("staffKindDoctor") },
                  { value: "NURSE", label: t("staffKindNurse") },
                  { value: "BATH", label: t("staffKindBath") },
                  { value: "MASSAGE", label: t("staffKindMassage") },
                  { value: "LAB", label: t("staffKindLab") },
                ]}
                emptyLabel={null}
              />
              {opsLocked ? (
                <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
                  {form.fullName} · {form.code}
                </p>
              ) : null}
              {!opsLocked && globalPersonId && !mdmEditorOpen ? (
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <p className={TEXT_MUTED_CLASS}>
                    {t("mdmLinked", { id: maskPersonId(globalPersonId) })}
                  </p>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => setMdmEditorOpen(true)}
                  >
                    {t("mdmChange")}
                  </button>
                </div>
              ) : !opsLocked ? (
                <>
                  <FieldRow cols={2} className="items-end">
                    <Field
                      label={t("finCode")}
                      preset="fin"
                      value={form.finCode ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, finCode: e.target.value.toUpperCase() })
                      }
                    />
                    <button
                      type="button"
                      className={`${SECONDARY_BUTTON_CLASS} self-end`}
                      onClick={() => void lookupMdm()}
                    >
                      {t("mdmLookup")}
                    </button>
                  </FieldRow>
                  {mdmStatus ? <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{mdmStatus}</p> : null}
                  {identifierTypes.length > 0 ? (
                    <p className={`text-xs ${TEXT_MUTED_CLASS}`}>
                      {t("identifierTypes")}: {identifierTypes.map((i) => i.type).join(", ")}
                    </p>
                  ) : null}
                  <Field
                    label={t("passportNumber")}
                    preset="code"
                    value={form.passportNumber ?? ""}
                    onChange={(e) => setForm({ ...form, passportNumber: e.target.value })}
                  />
                  <CatalogField
                    kind="SEARCHABLE"
                    label={t("issuingCountry")}
                    value={form.issuingCountry ?? ""}
                    emptyLabel="—"
                    options={countryOptions(locale, form.issuingCountry)}
                    onChange={(next) =>
                      setForm({ ...form, issuingCountry: String(next ?? "").toUpperCase() })
                    }
                  />
                </>
              ) : null}
              {editingId ? (
                <div className="space-y-2">
                  <CatalogMultiAdder
                    label={t("skills")}
                    list
                    options={[...procedureTypes]
                      .sort((a, b) => a.name.localeCompare(b.name, locale) || a.code.localeCompare(b.code))
                      .map((pt) => ({
                        value: pt.id,
                        label: catalogNameThenCode(pt.name, pt.code),
                      }))}
                    value={selectedSkillIds}
                    onChange={setSelectedSkillIds}
                    selectAllLabel={t("selectAllSkills")}
                    removeLabel={tc("delete")}
                  />
                  <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{t("saveSkills")}</p>
                </div>
              ) : null}
            </>
          )}
          {tab === "resources" && (
            <>
              <FieldSelect
                label={t("kind")}
                preset="select"
                value={form.kind ?? "EQUIPMENT"}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                <option value="EQUIPMENT">EQUIPMENT</option>
                <option value="ROOM">ROOM</option>
              </FieldSelect>
              <Field
                label={t("capacity")}
                preset="count"
                value={form.capacity ?? "1"}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
              <CatalogField
                kind="SEARCHABLE"
                label={t("room")}
                value={form.roomId ?? ""}
                emptyLabel="—"
                options={rooms.map((r) => ({
                  value: r.id,
                  label: catalogNameThenCode(r.name, r.code),
                }))}
                onChange={(next) => setForm({ ...form, roomId: String(next ?? "") })}
              />
              <Field
                label={t("extendedEndHour")}
                preset="count"
                value={form.extendedEndHour ?? ""}
                onChange={(e) => setForm({ ...form, extendedEndHour: e.target.value })}
              />
            </>
          )}
          {tab === "procedureTypes" && (
            <>
              <CatalogField
                kind="SEARCHABLE"
                label={t("financeSku")}
                value={form.financeSku ?? ""}
                serverSearch
                onQueryChange={setFinanceServiceQ}
                options={
                  form.financeSku &&
                  !financeServiceOptions.some((option) => option.value === form.financeSku)
                    ? [{ value: form.financeSku, label: form.financeSku }, ...financeServiceOptions]
                    : financeServiceOptions
                }
                onChange={(next) => setForm({ ...form, financeSku: String(next ?? "") })}
              />
              <FieldRow cols={4}>
                <Field
                  label={t("durationMin")}
                  preset="count"
                  value={form.durationMin ?? "30"}
                  onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
                />
                <Field
                  label={t("resourceGapMinutes")}
                  preset="count"
                  value={form.resourceGapMinutes ?? "5"}
                  onChange={(e) => setForm({ ...form, resourceGapMinutes: e.target.value })}
                />
                <Field
                  label={t("patientRestMinutes")}
                  preset="count"
                  value={form.patientRestMinutes ?? "15"}
                  onChange={(e) => setForm({ ...form, patientRestMinutes: e.target.value })}
                />
                <Field
                  label={t("extendedEndHour")}
                  preset="count"
                  value={form.extendedEndHour ?? ""}
                  onChange={(e) => setForm({ ...form, extendedEndHour: e.target.value })}
                />
              </FieldRow>
              <FieldRow cols={2}>
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t("bodyPart")}
                  value={form.bodyPart ?? ""}
                  onChange={(v) => setForm({ ...form, bodyPart: String(v) })}
                  options={BODY_PARTS.map((bp) => ({
                    value: bp,
                    label: t(`bodyPart_${bp}` as "bodyPart"),
                  }))}
                  emptyLabel="—"
                />
              </FieldRow>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
              <div className={`${FIELD_SECTION_CLASS} space-y-3 p-3`}>
              <label className={`flex items-center gap-2 text-sm ${MODAL_FIELD_LABEL_CLASS}`}>
                <input
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  checked={needsSite}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setNeedsSite(on);
                    if (!on) setAllowedSiteCodes([]);
                  }}
                />
                {t("needsSite")}
              </label>
              {needsSite ? (
                <CatalogMultiAdder
                  label={t("allowedSiteCodes")}
                  options={physioSiteOptions}
                  value={allowedSiteCodes}
                  onChange={setAllowedSiteCodes}
                  removeLabel={tc("delete")}
                />
              ) : null}
              </div>
              <div className={`${FIELD_SECTION_CLASS} space-y-3 p-3`}>
              <label className={`flex items-center gap-2 text-sm ${MODAL_FIELD_LABEL_CLASS}`}>
                <input
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  checked={needsExtraFields}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setNeedsExtraFields(on);
                    if (!on) setPhysioOrderFields([]);
                  }}
                />
                {t("needsExtraFields")}
              </label>
              {needsExtraFields ? (
                <CatalogMultiAdder
                  label={t("physioOrderFields")}
                  options={PHYSIO_ORDER_FIELD_CODES.map((code) => ({
                    value: code,
                    label: catalogNameThenCode(
                      t(`physioField_${code}` as "physioOrderFields", { defaultValue: code }),
                      code,
                    ),
                  }))}
                  value={physioOrderFields}
                  onChange={setPhysioOrderFields}
                  removeLabel={tc("delete")}
                />
              ) : null}
              </div>
              {skillCoverageMsg ? (
                <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{skillCoverageMsg}</p>
              ) : null}
              <div className={`${FIELD_SECTION_CLASS} space-y-3 p-3`}>
                <p className={MODAL_FIELD_LABEL_CLASS}>{t("requirements")}</p>
                <CatalogMultiAdder
                  label={t("resourceCodes")}
                  hint={t("resourceCodesHint")}
                  options={resourcePoolOptions}
                  value={physicalResourceCodesFromRequirements(requirements)}
                  onChange={(codes) =>
                    setRequirements((prev) =>
                      applyPhysicalResourcePool(prev, codes, (code) => {
                        const linked = resources.find((r) => r.code === code);
                        if (!linked) return undefined;
                        return linked.kind === "ROOM" ? "ROOM" : "EQUIPMENT";
                      }),
                    )
                  }
                  removeLabel={tc("delete")}
                />
                {requirements.map((req, index) =>
                  req.role === "STAFF" ? (
                    <FieldSelect
                      key={req.id ?? `staff-${index}`}
                      label={t("staffMode")}
                      preset="select"
                      value={req.staffMode ?? "SOFT"}
                      onChange={(e) =>
                        updateRequirement(index, {
                          staffMode: e.target.value as "HARD" | "SOFT",
                        })
                      }
                    >
                      <option value="SOFT">SOFT</option>
                      <option value="HARD">HARD</option>
                    </FieldSelect>
                  ) : null,
                )}
              </div>
                </div>
              <div className={`${FIELD_SECTION_CLASS} space-y-3 p-3`}>
                <p className={MODAL_FIELD_LABEL_CLASS}>{t("consumableBom")}</p>
                <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{t("consumableBomHint")}</p>
                <Field
                  label={t("financeProductSearch")}
                  preset="shortText"
                  value={financeProductQ}
                  onChange={(e) => setFinanceProductQ(e.target.value)}
                  hint={t("financeProductSearchHint")}
                />
                {consumables.map((line, index) => (
                  <div key={line.id ?? `c-${index}`} className="space-y-2 border-b border-[#ECF0F1] pb-3">
                    <CatalogField
                      kind="ENTITY_REF"
                      label={t("consumableSku")}
                      value={line.sku}
                      onChange={(v) => {
                        const sku = String(v);
                        const opt = financeProductOptions.find((o) => o.value === sku);
                        setConsumables((prev) =>
                          prev.map((row, i) =>
                            i === index
                              ? {
                                  ...row,
                                  sku,
                                  financeProductId: opt?.id ?? row.financeProductId ?? null,
                                  label: opt?.label ?? sku,
                                }
                              : row,
                          ),
                        );
                      }}
                      options={
                        line.sku && !financeProductOptions.some((o) => o.value === line.sku)
                          ? [
                              { value: line.sku, label: line.label ?? line.sku },
                              ...financeProductOptions,
                            ]
                          : financeProductOptions
                      }
                    />
                    <Field
                      label={t("qtyPerSession")}
                      preset="count"
                      value={String(line.qtyPerSession)}
                      onChange={(e) =>
                        setConsumables((prev) =>
                          prev.map((row, i) =>
                            i === index
                              ? { ...row, qtyPerSession: Number(e.target.value) || 1 }
                              : row,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className={`${SECONDARY_BUTTON_CLASS} text-xs`}
                      onClick={() =>
                        setConsumables((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      {t("removeConsumable")}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() =>
                    setConsumables((prev) => [
                      ...prev,
                      { sku: "", qtyPerSession: 1, wasteFactor: 0 },
                    ])
                  }
                >
                  {t("addConsumable")}
                </button>
              </div>
              </div>
            </>
          )}
        </div>
        <ModalFooter
          onCancel={() => setModalOpen(false)}
          onSubmit={() => void save()}
          submitLabel={tc("save")}
          cancelLabel={tc("cancel")}
        />
      </ModalShell>

      <PractitionerScheduleModal
        practitionerId={scheduleFor?.id ?? null}
        practitionerName={scheduleFor?.name ?? ""}
        open={scheduleFor !== null}
        onClose={() => setScheduleFor(null)}
      />
    </>
  );
}
