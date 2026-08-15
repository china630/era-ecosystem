"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { localizedCatalogDescription } from "@era/clinic-domain";
import { PractitionerScheduleModal } from "@/components/PractitionerScheduleModal";
import {
  CARD_CONTAINER_CLASS,
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
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SUBSECTION_SURFACE_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
} from "@era/satellite-kit/ui";

type Practitioner = {
  id: string;
  code: string;
  fullName: string;
  specialty?: string | null;
  globalPersonId?: string | null;
  financeEmployeeId?: string | null;
  defaultSlotMinutes?: number | null;
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
  resourceCode?: string | null;
  bodyPart?: string | null;
  extendedEndHour?: number | null;
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

type Tab = "practitioners" | "rooms" | "resources" | "procedureTypes";

function maskPersonId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function displayProcedureResourceCode(row: ProcedureType): string {
  const physical = row.requirements?.find(
    (r) => r.role === "LOCATION" || r.role === "EQUIPMENT",
  );
  return physical?.resourceCode?.trim() || row.resourceCode?.trim() || "—";
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
  const [catalogPick, setCatalogPick] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [mdmStatus, setMdmStatus] = useState<string | null>(null);
  const [globalPersonId, setGlobalPersonId] = useState<string | null>(null);
  const [identifierTypes, setIdentifierTypes] = useState<IdentifierChip[]>([]);
  const [workforcePolicy, setWorkforcePolicy] = useState<WorkforcePolicy | null>(null);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [skillCoverageMsg, setSkillCoverageMsg] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<{ id: string; name: string } | null>(null);

  const cpWorkforceMode = workforcePolicy?.hireMode === "cp_workforce";
  const blockPractitionerCreate = cpWorkforceMode;

  const loadAll = useCallback(async () => {
    const [p, r, res, pt, wp, cat] = await Promise.all([
      fetch("/api/admin/practitioners").then((x) => x.json()),
      fetch("/api/admin/rooms").then((x) => x.json()),
      fetch("/api/admin/resources").then((x) => x.json()),
      fetch(`/api/admin/procedure-types?locale=${encodeURIComponent(locale)}`).then((x) =>
        x.json(),
      ),
      fetch("/api/admin/workforce-policy").then((x) => x.json()),
      fetch("/api/admin/catalog?kind=PROCEDURE").then((x) => x.json()),
    ]);
    setPractitioners((p.data ?? p) as Practitioner[]);
    setRooms((r.data ?? r) as Room[]);
    setResources((res.data ?? res) as Resource[]);
    setProcedureTypes((pt.data ?? pt) as ProcedureType[]);
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
    const policyPayload = (wp.data ?? wp) as WorkforcePolicy;
    if (policyPayload?.hireMode) setWorkforcePolicy(policyPayload);
  }, [locale]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    setQ("");
  }, [tab]);

  const filteredPractitioners = useMemo(
    () =>
      practitioners.filter((row) =>
        matchesFilter(debouncedQ, [row.code, row.fullName, row.specialty]),
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
        matchesFilter(debouncedQ, [row.code, row.name, row.kind, row.room?.code]),
      ),
    [resources, debouncedQ],
  );
  const filteredProcedureTypes = useMemo(
    () =>
      procedureTypes.filter((row) =>
        matchesFilter(debouncedQ, [row.code, row.name, row.resourceCode]),
      ),
    [procedureTypes, debouncedQ],
  );

  function resetModalExtras() {
    setMdmStatus(null);
    setGlobalPersonId(null);
    setIdentifierTypes([]);
    setSelectedSkillIds([]);
    setRequirements([]);
    setSkillCoverageMsg(null);
  }

  function openCreate() {
    if (tab === "practitioners" && blockPractitionerCreate) return;
    setEditingId(null);
    setForm({});
    setCatalogPick("");
    resetModalExtras();
    if (tab === "procedureTypes") {
      setRequirements(defaultProcedureRequirements());
    }
    setModalOpen(true);
  }

  async function openEditPractitioner(row: Practitioner) {
    setEditingId(row.id);
    setForm({
      code: row.code ?? "",
      fullName: row.fullName ?? "",
      specialty: row.specialty ?? "",
      finCode: "",
      passportNumber: "",
      issuingCountry: "",
      defaultSlotMinutes: String(row.defaultSlotMinutes ?? "30"),
    });
    setGlobalPersonId(row.globalPersonId ?? null);
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
    setCatalogPick("");
    setForm({
      code: row.code,
      name: row.name,
      durationMin: String(row.durationMin),
      bodyPart: row.bodyPart ?? "",
      extendedEndHour: row.extendedEndHour != null ? String(row.extendedEndHour) : "",
    });
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
    setMsg(null);
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
              specialty: form.specialty || null,
              defaultSlotMinutes: form.defaultSlotMinutes
                ? Number(form.defaultSlotMinutes)
                : undefined,
            }
          : {
              fullName: form.fullName ?? form.name,
              specialty: form.specialty || null,
              finCode: form.finCode?.trim() || undefined,
              passportNumber: form.passportNumber?.trim() || undefined,
              issuingCountry: form.issuingCountry?.trim() || undefined,
              globalPersonId: globalPersonId || undefined,
              defaultSlotMinutes: form.defaultSlotMinutes
                ? Number(form.defaultSlotMinutes)
                : undefined,
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
          bodyPart: form.bodyPart?.trim() ? form.bodyPart.trim() : null,
          extendedEndHour: form.extendedEndHour?.trim()
            ? Number(form.extendedEndHour)
            : null,
        };
      }
    } else if (tab === "practitioners") {
      payload = {
        code: form.code,
        fullName: form.fullName ?? form.name,
        specialty: form.specialty || undefined,
        finCode: form.finCode?.trim() || undefined,
        passportNumber: form.passportNumber?.trim() || undefined,
        issuingCountry: form.issuingCountry?.trim() || undefined,
        globalPersonId: globalPersonId || undefined,
        defaultSlotMinutes: form.defaultSlotMinutes
          ? Number(form.defaultSlotMinutes)
          : undefined,
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
        name: form.name,
        durationMin: Number(form.durationMin || "30"),
        bodyPart: form.bodyPart?.trim() ? form.bodyPart.trim() : null,
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
      setMsg(tc("saveFailed"));
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
        setMsg(tc("saveFailed"));
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
          setMsg(tc("saveFailed"));
          return;
        }
        const physicalReq = requirements.find(
          (r) =>
            (r.role === "LOCATION" || r.role === "EQUIPMENT") &&
            r.resourceCode?.trim(),
        );
        if (physicalReq?.resourceCode?.trim()) {
          const linked = resources.find((r) => r.code === physicalReq.resourceCode);
          await fetch(`/api/admin/procedure-types/${typeId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resourceCode: physicalReq.resourceCode.trim(),
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
    setMsg(tc("saved"));
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
    await fetch(base, { method: "DELETE" });
    await loadAll();
  }

  function toggleSkill(procedureTypeId: string) {
    setSelectedSkillIds((prev) =>
      prev.includes(procedureTypeId)
        ? prev.filter((x) => x !== procedureTypeId)
        : [...prev, procedureTypeId],
    );
  }

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
            <Link href="/admin/wards" className={SECONDARY_BUTTON_CLASS}>
              {t("wardsLink")}
            </Link>
            {!(tab === "practitioners" && blockPractitionerCreate) ? (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
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
      {msg ? <p className="mb-3 text-[13px]">{msg}</p> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            className={tab === x.id ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => setTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
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
      </EraListFilterBar>
      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          {tab === "practitioners" && (
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("name")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("specialty")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("mdmBadge")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("financeLinked")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("defaultSlotMinutes")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPractitioners.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.fullName}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.specialty ?? "—"}</td>
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
                    <td className={DATA_TABLE_TD_CLASS}>{row.defaultSlotMinutes ?? "—"}</td>
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
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("name")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((row) => (
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
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("name")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("kind")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("room")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredResources.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.kind}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.room?.code ?? "—"}</td>
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
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("name")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("durationMin")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("resourceCode")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcedureTypes.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.durationMin}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{displayProcedureResourceCode(row)}</td>
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
      </div>

      <ModalShell
        open={modalOpen}
        title={editingId ? tc("edit") : tc("add")}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          {!editingId && tab === "procedureTypes" && catalogOptions.length > 0 ? (
            <FieldSelect
              label={t("pickFromCatalog")}
              preset="select"
              value={catalogPick}
              onChange={(e) => {
                const code = e.target.value;
                setCatalogPick(code);
                if (!code) return;
                const match = catalogOptions.find((c) => c.code === code);
                if (match) {
                  setForm({ ...form, code: match.code, name: match.description });
                }
              }}
            >
              <option value="">{t("manualCode")}</option>
              {catalogOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.description}
                </option>
              ))}
            </FieldSelect>
          ) : null}
          {!editingId &&
            (tab === "practitioners" ||
              tab === "rooms" ||
              tab === "resources" ||
              tab === "procedureTypes") && (
              <Field
                label={t("code")}
                preset="code"
                value={form.code ?? ""}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            )}
          {(tab === "practitioners" || tab === "resources" || tab === "procedureTypes") && (
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
              {opsLocked ? (
                <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
                  {form.fullName} · {form.code}
                </p>
              ) : null}
              {!opsLocked ? (
                <>
                  <Field
                    label={t("specialty")}
                    preset="shortText"
                    value={form.specialty ?? ""}
                    onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  />
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
                  <FieldRow cols={2}>
                    <Field
                      label={t("passportNumber")}
                      preset="code"
                      value={form.passportNumber ?? ""}
                      onChange={(e) => setForm({ ...form, passportNumber: e.target.value })}
                    />
                    <Field
                      label={t("issuingCountry")}
                      preset="code"
                      value={form.issuingCountry ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, issuingCountry: e.target.value.toUpperCase() })
                      }
                    />
                  </FieldRow>
                </>
              ) : (
                <Field
                  label={t("specialty")}
                  preset="shortText"
                  value={form.specialty ?? ""}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                />
              )}
              <Field
                label={t("defaultSlotMinutes")}
                preset="count"
                value={form.defaultSlotMinutes ?? "30"}
                onChange={(e) => setForm({ ...form, defaultSlotMinutes: e.target.value })}
              />
              {editingId ? (
                <div className="space-y-2">
                  <p className={MODAL_FIELD_LABEL_CLASS}>{t("skills")}</p>
                  <div className={`${FIELD_SECTION_CLASS} max-h-40 space-y-1 overflow-y-auto p-2`}>
                    {procedureTypes.map((pt) => (
                      <label
                        key={pt.id}
                        className="flex items-center gap-2 text-[13px]"
                      >
                        <input
                          type="checkbox"
                          className={MODAL_CHECKBOX_CLASS}
                          checked={selectedSkillIds.includes(pt.id)}
                          onChange={() => toggleSkill(pt.id)}
                        />
                        <span>
                          {pt.code} — {pt.name}
                        </span>
                      </label>
                    ))}
                  </div>
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
              <FieldSelect
                label={t("room")}
                preset="select"
                value={form.roomId ?? ""}
                onChange={(e) => setForm({ ...form, roomId: e.target.value })}
              >
                <option value="">—</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </FieldSelect>
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
              <Field
                label={t("durationMin")}
                preset="count"
                value={form.durationMin ?? "30"}
                onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
              />
              <FieldSelect
                label={t("bodyPart")}
                preset="select"
                value={form.bodyPart ?? ""}
                onChange={(e) => setForm({ ...form, bodyPart: e.target.value })}
              >
                <option value="">—</option>
                {[
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
                ].map((bp) => (
                  <option key={bp} value={bp}>
                    {bp}
                  </option>
                ))}
              </FieldSelect>
              <Field
                label={t("extendedEndHour")}
                preset="count"
                value={form.extendedEndHour ?? ""}
                onChange={(e) => setForm({ ...form, extendedEndHour: e.target.value })}
              />
              {skillCoverageMsg ? (
                <p className={`text-xs ${TEXT_MUTED_CLASS}`}>{skillCoverageMsg}</p>
              ) : null}
              <div className={`${FIELD_SECTION_CLASS} space-y-3 p-3`}>
                <p className={MODAL_FIELD_LABEL_CLASS}>{t("requirements")}</p>
                {requirements.length === 0 ? (
                  <p className={`text-xs ${TEXT_MUTED_CLASS}`}>—</p>
                ) : (
                  requirements.map((req, index) => (
                    <div key={req.id ?? `${req.role}-${index}`} className="space-y-2">
                      <p className={`text-xs font-semibold ${TEXT_MUTED_CLASS}`}>{req.role}</p>
                      {req.role === "STAFF" ? (
                        <FieldSelect
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
                      ) : null}
                      {req.role === "LOCATION" || req.role === "EQUIPMENT" ? (
                        <FieldSelect
                          label={t("resourceCode")}
                          preset="select"
                          value={req.resourceCode ?? ""}
                          onChange={(e) => {
                            const code = e.target.value || null;
                            const linked = resources.find((r) => r.code === code);
                            const isRoom = linked?.kind === "ROOM";
                            updateRequirement(index, {
                              resourceCode: code,
                              role: isRoom ? "LOCATION" : "EQUIPMENT",
                              resourceKind: isRoom ? "ROOM" : "EQUIPMENT",
                            });
                          }}
                        >
                          <option value="">—</option>
                          {resources.map((res) => (
                            <option key={res.id} value={res.code}>
                              {res.code} — {res.name}
                            </option>
                          ))}
                        </FieldSelect>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        <ModalFooter
          onCancel={() => setModalOpen(false)}
          onSubmit={() => void save()}
          submitLabel={tc("save")}
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
