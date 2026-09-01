"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  DoorClosed,
  Eye,
  LayoutGrid,
  ListChecks,
  Trash2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  CHIP_GROUP_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_SCROLL_CLASS,
  DATA_TABLE_SHELL_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DatePicker,
  EraListFilterBar,
  EraListWorkspace,
  FIELD_SECTION_BODY_CLASS,
  FIELD_SECTION_CLASS,
  Field,
  FieldRow,
  FieldSelect,
  FieldTextarea,
  FORM_STACK_CLASS,
  inferCatalogFieldKind,
  LIST_PAGE_SHELL_CLASS,
  ListPaginationFooter,
  LINK_ACCENT_CLASS,
  LOCALE_TOGGLE_ACTIVE_CLASS,
  ModalFooter,
  ModalShell,
  MODAL_CHECKBOX_CLASS,
  NATIONALITY_OPTIONS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  PageHeader,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
  usePaginatedList,
} from "@era/satellite-kit/ui";
import { composeFullName } from "@/domain/patient/patient-ref-code";
import { PatientCardModal } from "@/components/patients/PatientCardModal";
import { IcdPicker } from "@/components/IcdPicker";
import type { DiagnosticCatalogItem } from "@/domain/catalog/diagnostic-catalog-shared";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { formatNameAndCode } from "@/lib/display-code";

type EpisodeListFilters = {
  q: string;
  origin: string;
  room: string;
  program: string;
};

type ProcedureLine = {
  procedureCode: string;
  quotaTotal: number;
  quotaUsed: number;
};

type ProgramInstance = {
  programCode: string;
  startsOn: string;
  endsOn: string;
  procedureLines: ProcedureLine[];
};

type ProcedureOrder = {
  id: string;
  procedureName: string;
  procedureCode: string;
  scheduledAt: string;
  status: string;
};

type Episode = {
  id: string;
  reservationId: string | null;
  hotelStayId: string | null;
  roomNumber: string | null;
  organizationId: string;
  patientOrigin: string;
  programCode: string | null;
  checkupCompletedAt: string | null;
  status: string;
  openedAt: string;
  canCloseWalkIn?: boolean;
  patientRef: { id: string; fullName: string; refCode: string } | null;
  complaints: { id: string; text: string; recordedAt: string }[];
  diagnoses: {
    id: string;
    note?: string | null;
    icdCode?: {
      code: string;
      titleEn: string;
      titleRu: string;
      titleAz?: string | null;
    } | null;
  }[];
  labOrders: {
    id: string;
    testCode: string;
    status: string;
    items?: Array<{
      serviceCode: string;
      diagnosticService?: {
        code: string;
        serviceCode?: string;
        titleEn?: string;
        titleRu?: string;
        titleAz?: string | null;
      } | null;
    }>;
  }[];
  programInstance?: ProgramInstance | null;
};

type ProgramTemplate = {
  id: string;
  code: string;
  name: string;
  durationDays: number;
};

type WalkInForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  fin: string;
  passport: string;
  phone: string;
  sex: "" | "MALE" | "FEMALE";
  birthDate: string;
  nationality: string;
  programCode: string;
};

const emptyWalkIn = (): WalkInForm => ({
  firstName: "",
  middleName: "",
  lastName: "",
  fin: "",
  passport: "",
  phone: "",
  sex: "",
  birthDate: "",
  nationality: "",
  programCode: "",
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysRemaining(endsOn: string): number {
  const end = new Date(endsOn);
  end.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000));
}

export default function SanatoriumPage() {
  const t = useTranslations("sanatorium");
  const tc = useTranslations("common");
  const tp = useTranslations("patients");
  const locale = useLocale();
  const [procedureTypeNames, setProcedureTypeNames] = useState<Map<string, string>>(new Map());
  const [episodeDetail, setEpisodeDetail] = useState<Episode | null>(null);
  const [scheduleOrders, setScheduleOrders] = useState<ProcedureOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [patientCardId, setPatientCardId] = useState<string | null>(null);
  const [chartDate, setChartDate] = useState(todayIso());
  const [complaint, setComplaint] = useState("");
  const [icdCodeId, setIcdCodeId] = useState("");
  const [diagnosisNote, setDiagnosisNote] = useState("");
  const [icdChapter, setIcdChapter] = useState("");
  const [testCode, setTestCode] = useState("");
  const [labCatalogItems, setLabCatalogItems] = useState<DiagnosticCatalogItem[]>([]);
  const [programTemplates, setProgramTemplates] = useState<ProgramTemplate[]>([]);
  const [programCode, setProgramCode] = useState("");
  const [programStartsOn, setProgramStartsOn] = useState(todayIso());
  const searchParams = useSearchParams();
  const deepLinkHandled = useRef(false);
  const [msg, setMsg] = useState("");
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [diagnosisModalOpen, setDiagnosisModalOpen] = useState(false);
  const [labModalOpen, setLabModalOpen] = useState(false);
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [proceduresModalOpen, setProceduresModalOpen] = useState(false);
  const [rescheduleOrderId, setRescheduleOrderId] = useState<string | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [walkIn, setWalkIn] = useState<WalkInForm>(emptyWalkIn);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [filterOrigin, setFilterOrigin] = useState("");
  const [filterRoom, setFilterRoom] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [hotelRooms, setHotelRooms] = useState<string[]>([]);
  const [programCodes, setProgramCodes] = useState<string[]>([]);
  const [proposedOrders, setProposedOrders] = useState<
    Array<{ id: string; procedureName: string; procedureCode: string; status: string; scheduledAt: string }>
  >([]);
  const [selectedProposed, setSelectedProposed] = useState<Set<string>>(new Set());
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [bulkCancelReason, setBulkCancelReason] = useState("");
  const [bulkCancelReplace, setBulkCancelReplace] = useState("");
  const [labRepeatOpen, setLabRepeatOpen] = useState(false);
  const [pendingLabCode, setPendingLabCode] = useState("");

  const listFilters = useMemo<EpisodeListFilters>(
    () => ({
      q,
      origin: filterOrigin,
      room: filterRoom,
      program: filterProgram,
    }),
    [q, filterOrigin, filterRoom, filterProgram],
  );

  const listFetcher = useCallback(
    async ({
      page,
      pageSize,
      filters: f,
    }: {
      page: number;
      pageSize: number;
      filters: EpisodeListFilters;
    }) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        includeHotelRooms: "1",
        includeProgramCodes: "1",
      });
      if (f.q.trim()) params.set("q", f.q.trim());
      if (f.origin) params.set("origin", f.origin);
      if (f.room.trim()) params.set("roomNumber", f.room.trim());
      if (f.program.trim()) params.set("programCode", f.program.trim());
      const res = await fetch(`/api/sanatorium/episodes?${params}`);
      if (!res.ok) throw new Error("Failed to load episodes");
      const data = await res.json();
      const payload = data.data ?? data;
      if (!Array.isArray(payload)) {
        if (Array.isArray(payload.hotelRooms)) setHotelRooms(payload.hotelRooms);
        if (Array.isArray(payload.programCodes)) setProgramCodes(payload.programCodes);
      }
      return data;
    },
    [],
  );

  const {
    items: episodes,
    total: listTotal,
    page: listPage,
    pageSize: listPageSize,
    setPage: setListPage,
    setPageSize: setListPageSize,
    loading: listLoading,
    reload: loadList,
  } = usePaginatedList<Episode, EpisodeListFilters>({
    fetcher: listFetcher,
    filters: listFilters,
  });

  const loadDetail = useCallback(async (episodeId: string) => {
    const res = await fetch(`/api/sanatorium/episodes/${episodeId}`);
    if (!res.ok) {
      setEpisodeDetail(null);
      return;
    }
    const data = await res.json();
    setEpisodeDetail(data?.data ?? data);
  }, []);

  const loadSchedule = useCallback(async (episodeId: string, date: string) => {
    const day = new Date(`${date}T00:00:00`);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const qs = new URLSearchParams({
      from: day.toISOString(),
      to: next.toISOString(),
      locale,
    });
    const res = await fetch(`/api/sanatorium/episodes/${episodeId}/schedule?${qs}`);
    if (!res.ok) {
      setScheduleOrders([]);
      return;
    }
    const data = await res.json();
    const payload = data?.data ?? data;
    setScheduleOrders(Array.isArray(payload) ? payload : []);
  }, [locale]);

  const loadProposed = useCallback(async (patientRefId: string) => {
    const res = await fetch(`/api/patients/${patientRefId}/card-feed?section=plan&offset=0`);
    if (!res.ok) {
      setProposedOrders([]);
      return;
    }
    const data = await res.json();
    const row = data.data ?? data;
    const events = (row.events ?? []) as Array<{
      id: string;
      title: string;
      status: string;
      at: string;
      codes?: string[];
    }>;
    const proposed = events
      .filter((ev) => ev.status === "PROPOSED")
      .map((ev) => ({
        id: ev.id.startsWith("procedure:") ? ev.id.slice("procedure:".length) : ev.id,
        procedureName: ev.title.replace(/^Procedure · /, ""),
        procedureCode: ev.codes?.[0] ?? "",
        status: ev.status,
        scheduledAt: ev.at,
      }));
    setProposedOrders(proposed);
    // Wave C: default-select first 2–3 for day-1 confirm
    setSelectedProposed(new Set(proposed.slice(0, 3).map((o) => o.id)));
  }, []);

  useEffect(() => {
    void fetch("/api/procedure-types")
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.data ?? d.items ?? d) as Array<{ code: string; name: string }>;
        if (!Array.isArray(rows)) return;
        setProcedureTypeNames(new Map(rows.map((r) => [r.code, r.name])));
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    void fetch("/api/diagnostic-catalog?kinds=lab_panel&applyFavorites=false")
      .then((r) => r.json())
      .then((d) => {
        const row = d.data ?? d;
        const items = (row.items ?? []) as DiagnosticCatalogItem[];
        setLabCatalogItems(items.filter((item) => item.kind === "lab_panel"));
      });
  }, []);

  useEffect(() => {
    void fetch("/api/sanatorium/program-templates")
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.data ?? d) as ProgramTemplate[];
        setProgramTemplates(Array.isArray(rows) ? rows : []);
      });
  }, []);

  /** Deep link /sanatorium?episode=… opens treatment chart (not only PatientCard). */
  useEffect(() => {
    const ep = searchParams.get("episode");
    if (!ep || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    void (async () => {
      setSelectedId(ep);
      setChartModalOpen(true);
      await loadDetail(ep);
    })();
  }, [searchParams, loadDetail]);

  const naftaPackageTemplates = useMemo(() => {
    const codes = new Set(["PKG-STANDART", "PKG-PREMIUM", "PKG-DERMO", "PKG-DETOKS"]);
    const filtered = programTemplates.filter((p) => codes.has(p.code));
    return filtered.length > 0 ? filtered : programTemplates;
  }, [programTemplates]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId);
    void loadSchedule(selectedId, chartDate);
  }, [selectedId, chartDate, loadDetail, loadSchedule]);

  useEffect(() => {
    const patientRefId = episodeDetail?.patientRef?.id;
    if (chartModalOpen && patientRefId && episodeDetail?.programInstance) {
      void loadProposed(patientRefId);
    }
  }, [chartModalOpen, episodeDetail, loadProposed]);

  const selected = episodeDetail?.id === selectedId
    ? episodeDetail
    : episodes.find((e) => e.id === selectedId) ?? null;

  function statusLabel(status: string): string {
    switch (status) {
      case "SCHEDULED":
        return t("statusScheduled");
      case "CHECKED_IN":
      case "IN_PROGRESS":
        return t("statusCheckedIn");
      case "NO_SHOW":
        return t("statusNoShow");
      case "COMPLETED":
        return t("statusCompleted");
      case "CANCELLED":
        return t("statusCancelled");
      case "PROPOSED":
        return t("statusProposed", { defaultValue: "Proposed" });
      default:
        return status;
    }
  }

  function originLabel(origin: string): string {
    if (origin === "WALK_IN") return t("originWalkIn");
    if (origin === "IN_HOUSE") return t("originInHouse");
    return origin;
  }

  async function confirmProposed(orderIds: string[]) {
    if (orderIds.length === 0) return;
    setBusy(true);
    const res = await fetch("/api/procedures/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg(t("failed"));
      return;
    }
    const data = (await res.json().catch(() => ({}))) as {
      softWarn?: string;
    };
    setMsg(
      data.softWarn
        ? t("day1SoftWarn", {
            defaultValue:
              "Plan confirmed (soft warn: Nafta day-1 default is 2–3 procedures).",
          })
        : t("planConfirmed", { defaultValue: "Plan confirmed" }),
    );
    setSelectedProposed(new Set());
    const patientRefId = selected?.patientRef?.id;
    if (patientRefId) await loadProposed(patientRefId);
    if (selectedId) await loadSchedule(selectedId, chartDate);
  }

  async function submitBulkCancel() {
    if (!selectedId || !bulkCancelReason.trim()) return;
    setBusy(true);
    const res = await fetch("/api/procedures/bulk-cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        episodeId: selectedId,
        reason: bulkCancelReason.trim(),
        replaceWithCode: bulkCancelReplace.trim() || undefined,
      }),
    });
    setBusy(false);
    setBulkCancelOpen(false);
    setBulkCancelReason("");
    setBulkCancelReplace("");
    setMsg(res.ok ? t("bulkCancelled", { defaultValue: "Procedures cancelled" }) : t("failed"));
    if (res.ok && selectedId) await loadSchedule(selectedId, chartDate);
  }

  async function reloadEpisode() {
    await loadList();
    if (selectedId) {
      await loadDetail(selectedId);
      await loadSchedule(selectedId, chartDate);
    }
  }

  async function openChart(episodeId: string) {
    setSelectedId(episodeId);
    setChartModalOpen(true);
    await loadDetail(episodeId);
  }

  async function openProcedures(episodeId: string) {
    setSelectedId(episodeId);
    setProceduresModalOpen(true);
    await loadDetail(episodeId);
    await loadSchedule(episodeId, chartDate);
  }

  async function postAction(action: string, body: unknown) {
    if (!selectedId) return;
    setBusy(true);
    const res = await fetch(`/api/sanatorium/episodes/${selectedId}?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (res.status === 409 && data.code === "ANAMNESIS_REQUIRED") {
      setMsg(data.error ?? t("anamnesisRequiredForProgram"));
      return;
    }
    if (action === "instantiate-program" && res.status === 409) {
      setMsg(t("alreadyHasProgram"));
      return;
    }
    if (action === "lab" && res.status === 409 && data.code === "LAB_ALREADY_COMPLETED") {
      const code = (body as { testCode?: string }).testCode ?? testCode;
      setPendingLabCode(code);
      setLabRepeatOpen(true);
      return;
    }
    if (action === "lab" && res.status === 409 && data.code === "LAB_ALREADY_OPEN") {
      setMsg(data.error ?? t("labAlreadyOpen"));
      return;
    }
    setMsg(
      res.ok
        ? action === "instantiate-program" || action === "complete-checkup"
          ? t("programStarted")
          : t("saved")
        : (data.error ?? t("failed")),
    );
    if (res.ok) {
      if (action === "complaint") {
        setComplaint("");
        setComplaintModalOpen(false);
      }
      if (action === "diagnosis") {
        setIcdCodeId("");
        setDiagnosisNote("");
        setIcdChapter("");
        setDiagnosisModalOpen(false);
      }
      if (action === "lab") setLabModalOpen(false);
      if (action === "instantiate-program" || action === "complete-checkup") {
        setProgramModalOpen(false);
      }
      await reloadEpisode();
    }
  }

  function validateWalkIn(): string | null {
    if (!walkIn.firstName.trim() || !walkIn.lastName.trim()) return tp("namePartsRequired");
    if (!walkIn.sex) return t("sexRequired");
    if (!walkIn.fin.trim() && !walkIn.passport.trim()) return t("finOrPassportRequired");
    return null;
  }

  async function registerWalkIn() {
    const validationError = validateWalkIn();
    if (validationError) {
      setMsg(validationError);
      return;
    }
    setBusy(true);
    const firstName = walkIn.firstName.trim();
    const lastName = walkIn.lastName.trim();
    const middleName = walkIn.middleName.trim() || null;
    const res = await fetch("/api/sanatorium/episodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        middleName,
        fullName: composeFullName({ firstName, lastName, middleName }),
        fin: walkIn.fin.trim() || undefined,
        passport: walkIn.passport.trim() || undefined,
        phone: walkIn.phone.trim() || undefined,
        sex: walkIn.sex,
        birthDate: walkIn.birthDate || undefined,
        nationality: walkIn.nationality.trim() || undefined,
        programCode: walkIn.programCode.trim() || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error ?? t("failed"));
      return;
    }
    setWalkInModalOpen(false);
    setWalkIn(emptyWalkIn());
    setMsg(t("walkInRegistered"));
    await loadList();
    const ep = data.data ?? data;
    if (ep?.id) setSelectedId(ep.id);
  }

  async function rescheduleProcedure() {
    if (!rescheduleOrderId) return;
    setBusy(true);
    const scheduledAt = new Date(`${chartDate}T${rescheduleTime}:00`).toISOString();
    const res = await fetch(`/api/procedures/${rescheduleOrderId}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? t("rescheduled") : (data.error ?? t("failed")));
    setRescheduleOrderId(null);
    if (res.ok && selectedId) await loadSchedule(selectedId, chartDate);
  }

  async function cancelProcedure(orderId: string) {
    setBusy(true);
    const res = await fetch(`/api/procedures/${orderId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "reception_episode_chart" }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? t("procedureCancelled") : (data.error ?? t("failed")));
    await reloadEpisode();
  }

  async function deleteComplaintRow(complaintId: string) {
    const patientRefId = selected?.patientRef?.id;
    if (!patientRefId) return;
    setBusy(true);
    const res = await fetch(
      `/api/patients/${patientRefId}/complaints?id=${encodeURIComponent(complaintId)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    setMsg(res.ok ? t("saved") : t("failed"));
    if (res.ok) await reloadEpisode();
  }

  async function deleteDiagnosisRow(diagnosisId: string) {
    const patientRefId = selected?.patientRef?.id;
    if (!patientRefId) return;
    setBusy(true);
    const res = await fetch(
      `/api/patients/${patientRefId}/diagnoses?id=${encodeURIComponent(diagnosisId)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    setMsg(res.ok ? t("saved") : t("failed"));
    if (res.ok) await reloadEpisode();
  }

  async function cancelLabRow(orderId: string) {
    if (!window.confirm(t("labCancelConfirm"))) return;
    setBusy(true);
    const res = await fetch(`/api/lab-orders/${orderId}`, { method: "DELETE" });
    setBusy(false);
    setMsg(res.ok ? t("labCancelled") : t("failed"));
    if (res.ok) await reloadEpisode();
  }

  function labOrderLabel(order: Episode["labOrders"][number]): string {
    const item = order.items?.[0];
    if (item) {
      const svc = item.diagnosticService;
      const name = svc
        ? pickL10n(
            {
              en: svc.titleEn ?? svc.code,
              ru: svc.titleRu ?? svc.titleEn ?? svc.code,
              az: svc.titleAz ?? svc.titleEn ?? svc.code,
            },
            locale,
          )
        : "";
      return formatNameAndCode(name, item.serviceCode);
    }
    return formatNameAndCode("", order.testCode);
  }

  async function closeWalkIn(episodeId: string) {
    if (!window.confirm(t("closeWalkInConfirm"))) return;
    setBusy(true);
    const res = await fetch(`/api/sanatorium/episodes/${episodeId}?action=close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? t("closeWalkInOk") : (data.error ?? t("failed")));
    if (res.ok) {
      if (selectedId === episodeId) {
        setSelectedId("");
        setChartModalOpen(false);
      }
      await loadList();
    }
  }

  const program = selected?.programInstance;
  const canCompleteCheckup =
    selected &&
    !program &&
    (selected.complaints.length > 0 || selected.diagnoses.length > 0);

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setWalkInModalOpen(true)}>
              {t("registerWalkIn")}
            </button>
          }
        />
        {msg ? <p className={`mb-3 text-[13px] ${TEXT_SUCCESS_CLASS}`}>{msg}</p> : null}
      </div>

      <EraListWorkspace
        filter={
          <EraListFilterBar
            className="!mb-0"
            resetLabel={tc("filterReset")}
            onReset={() => {
              setQ("");
              setFilterOrigin("");
              setFilterRoom("");
              setFilterProgram("");
            }}
          >
            <Field
              label={tc("search")}
              preset="shortText"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <FieldSelect
              label={t("filterOrigin")}
              preset="select"
              value={filterOrigin}
              onChange={(e) => setFilterOrigin(e.target.value)}
            >
              <option value="">{tc("all")}</option>
              <option value="IN_HOUSE">{t("originInHouse")}</option>
              <option value="WALK_IN">{t("originWalkIn")}</option>
            </FieldSelect>
            <CatalogField
              kind="SEARCHABLE"
              label={t("filterHotelRoom")}
              value={filterRoom}
              onChange={(v) => setFilterRoom(String(v ?? ""))}
              options={[
                { value: "", label: t("filterHotelRoomAll") },
                ...hotelRooms.map((room) => ({ value: room, label: room })),
              ]}
              emptyLabel={t("filterHotelRoomAll")}
            />
            <CatalogField
              kind={inferCatalogFieldKind({
                optionCount: programCodes.length + 1,
                searchable: programCodes.length > 12,
              })}
              label={t("filterProgramCode")}
              value={filterProgram}
              onChange={(v) => setFilterProgram(String(v ?? ""))}
              options={[
                { value: "", label: t("filterProgramCodeAll") },
                ...programCodes.map((code) => ({ value: code, label: code })),
              ]}
              emptyLabel={null}
            />
          </EraListFilterBar>
        }
        table={
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPatient")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colRef")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colRoom")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colOrigin")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colProgram")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colDaysLeft")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((e) => {
                const prog = e.programInstance;
                const days = prog ? daysRemaining(prog.endsOn) : null;
                return (
                  <tr key={e.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="font-medium">{e.patientRef?.fullName ?? t("guest")}</div>
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{e.patientRef?.refCode ?? "—"}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{e.roomNumber ?? "—"}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{originLabel(e.patientOrigin)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {prog?.programCode ?? e.programCode ?? "—"}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{days != null ? days : "—"}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{e.status}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={t("treatmentChart")}
                          onClick={() => void openChart(e.id)}
                        >
                          <ClipboardList className="h-4 w-4 text-[#2980B9]" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={t("proceduresBtn")}
                          onClick={() => void openProcedures(e.id)}
                        >
                          <ListChecks className="h-4 w-4 text-[#2980B9]" aria-hidden />
                        </button>
                        {e.patientRef?.id ? (
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            aria-label={t("patientCard")}
                            onClick={() => setPatientCardId(e.patientRef!.id)}
                          >
                            <Eye className="h-4 w-4 text-[#2980B9]" aria-hidden />
                          </button>
                        ) : null}
                        {e.patientOrigin === "WALK_IN" && e.status === "OPEN" ? (
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            disabled={busy || e.canCloseWalkIn === false}
                            aria-label={t("closeWalkIn")}
                            title={
                              e.canCloseWalkIn === false
                                ? t("closeWalkInBusyHint")
                                : t("closeWalkIn")
                            }
                            onClick={() => void closeWalkIn(e.id)}
                          >
                            <DoorClosed className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {episodes.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                    {listLoading ? tc("loading") : t("noEpisodes")}
                    <div className="mt-1 text-[12px]">{t("emptyHint")}</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        }
        footer={
          <ListPaginationFooter
            page={listPage}
            pageSize={listPageSize}
            total={listTotal}
            onPageChange={setListPage}
            onPageSizeChange={setListPageSize}
            labels={{
              rowsPerPage: tc("rowsPerPage"),
              pageOf: tc("pageOf"),
              prev: tc("prev"),
              next: tc("next"),
            }}
          />
        }
      />

      <ModalShell
        open={chartModalOpen && Boolean(selected)}
        title={t("treatmentChart")}
        subtitle={selected?.patientRef?.fullName}
        onClose={() => setChartModalOpen(false)}
        maxWidthClass="max-w-2xl"
      >
        {selected ? (
          <div className="space-y-4 text-[13px]">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setComplaintModalOpen(true)}
              >
                {t("addComplaint")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setDiagnosisModalOpen(true)}
              >
                {t("addDiagnosis")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setLabModalOpen(true)}
              >
                {t("orderLab")}
              </button>
            </div>

            <div>
              <h3 className="mb-1 font-semibold">{t("complaints")}</h3>
              <ul className="list-disc pl-5">
                {selected.complaints.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2">
                    <span>{c.text}</span>
                    <button
                      type="button"
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      aria-label={tc("delete")}
                      onClick={() => void deleteComplaintRow(c.id)}
                    >
                      <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                    </button>
                  </li>
                ))}
                {selected.complaints.length === 0 ? (
                  <li className={`list-none ${TEXT_MUTED_CLASS}`}>—</li>
                ) : null}
              </ul>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">{t("diagnoses")}</h3>
              <ul className="list-disc pl-5">
                {selected.diagnoses.map((d) => {
                  const code = d.icdCode?.code;
                  const title = d.icdCode
                    ? locale.startsWith("ru")
                      ? d.icdCode.titleRu
                      : locale.startsWith("az")
                        ? d.icdCode.titleAz?.trim() || d.icdCode.titleRu
                        : d.icdCode.titleEn
                    : null;
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-2">
                      <span>
                        {code ? `${code}${title ? ` — ${title}` : ""}` : "—"}
                        {d.note ? ` (${d.note})` : ""}
                      </span>
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        aria-label={tc("delete")}
                        onClick={() => void deleteDiagnosisRow(d.id)}
                      >
                        <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                      </button>
                    </li>
                  );
                })}
                {selected.diagnoses.length === 0 ? (
                  <li className={`list-none ${TEXT_MUTED_CLASS}`}>—</li>
                ) : null}
              </ul>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">{t("labOrders")}</h3>
              <ul>
                {selected.labOrders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {labOrderLabel(o)} — {o.status}{" "}
                      <Link href={`/lab-orders/${o.id}`} className={LINK_ACCENT_CLASS}>
                        {t("workflow")}
                      </Link>
                    </span>
                    {o.status === "ORDERED" ? (
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        aria-label={t("labCancelOrder")}
                        onClick={() => void cancelLabRow(o.id)}
                      >
                        <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                      </button>
                    ) : null}
                  </li>
                ))}
                {selected.labOrders.length === 0 ? (
                  <li className={TEXT_MUTED_CLASS}>—</li>
                ) : null}
              </ul>
            </div>

            {program ? (
              <div className={`${FIELD_SECTION_CLASS} ${FIELD_SECTION_BODY_CLASS} space-y-3`}>
                <div className="flex flex-wrap gap-4">
                  <span>
                    <strong>{t("programSummary")}:</strong> {program.programCode}
                  </span>
                  <span>
                    {t("daysRemaining")}: {daysRemaining(program.endsOn)}
                  </span>
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">{t("programQuota")}</h3>
                  <ul className="space-y-2">
                    {program.procedureLines.map((line) => {
                      const pct =
                        line.quotaTotal > 0
                          ? Math.min(100, (line.quotaUsed / line.quotaTotal) * 100)
                          : 0;
                      return (
                        <li key={line.procedureCode}>
                          <div className="mb-1 flex justify-between">
                            <span>
                              {formatNameAndCode(
                                procedureTypeNames.get(line.procedureCode) ?? "",
                                line.procedureCode,
                              )}
                            </span>
                            <span>{t("quotaUsed", { used: line.quotaUsed, total: line.quotaTotal })}</span>
                          </div>
                          <div className={`h-2 overflow-hidden rounded-lg ${CHIP_GROUP_CLASS} !p-0`}>
                            <div
                              className={`h-full ${LOCALE_TOGGLE_ACTIVE_CLASS}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">
                      {t("proposedPlanTitle", { defaultValue: "Proposed plan" })}
                    </h3>
                    {proposedOrders.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className={PRIMARY_BUTTON_CLASS}
                          disabled={busy || selectedProposed.size === 0}
                          onClick={() => void confirmProposed([...selectedProposed])}
                        >
                          {t("confirmSelected", { defaultValue: "Confirm selected" })}
                        </button>
                        <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                          {t("firstDayConfirmHint", {
                            defaultValue: "First day: confirm 2–3 procedures (FIFO prefix).",
                          })}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  {proposedOrders.length === 0 ? (
                    <p className={TEXT_MUTED_CLASS}>
                      {t("proposedEmpty", { defaultValue: "No proposed procedures." })}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {proposedOrders.map((o) => (
                        <li
                          key={o.id}
                          className={`flex items-start gap-2 px-3 py-2 ${FIELD_SECTION_CLASS}`}
                        >
                          <input
                            type="checkbox"
                            className={`mt-1 ${MODAL_CHECKBOX_CLASS}`}
                            checked={selectedProposed.has(o.id)}
                            onChange={() => {
                              setSelectedProposed((prev) => {
                                const next = new Set(prev);
                                if (next.has(o.id)) next.delete(o.id);
                                else next.add(o.id);
                                return next;
                              });
                            }}
                          />
                          <div>
                            <span className="font-medium">{o.procedureName}</span>
                            <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                              {o.procedureCode} · {statusLabel(o.status)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className={`border-dashed ${FIELD_SECTION_CLASS} ${FIELD_SECTION_BODY_CLASS} space-y-2`}>
                {!selected.checkupCompletedAt && (
                  <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t("checkupPendingHint")}</p>
                )}
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={!canCompleteCheckup}
                  onClick={() => setProgramModalOpen(true)}
                >
                  {t("completeCheckupSchedule")}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </ModalShell>

      <ModalShell
        open={proceduresModalOpen && Boolean(selected)}
        title={t("proceduresBtn")}
        subtitle={selected?.patientRef?.fullName}
        onClose={() => setProceduresModalOpen(false)}
        maxWidthClass="max-w-3xl"
      >
        <div className="space-y-3 text-[13px]">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <DatePicker
              label={t("chartDate")}
              value={chartDate}
              onChange={setChartDate}
              placeholder={tc("datePlaceholder")}
              openCalendarLabel={tc("openCalendar")}
            />
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setBulkCancelOpen(true)}
            >
              {t("bulkCancel", { defaultValue: "Bulk cancel" })}
            </button>
          </div>
          <div className={DATA_TABLE_SHELL_CLASS}>
            <div className={DATA_TABLE_SCROLL_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procedureTime")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procedureName")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("procedureStatus")}</th>
                    <th className={DATA_TABLE_TH_RIGHT_CLASS} />
                  </tr>
                </thead>
                <tbody>
                  {scheduleOrders.map((o) => (
                    <tr key={o.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {new Date(o.scheduledAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{o.procedureName}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{statusLabel(o.status)}</td>
                      <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                        {o.status === "SCHEDULED" ? (
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Link
                              href={`/sanatorium/resources?date=${chartDate}&highlight=${o.id}`}
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              aria-label={t("openMatrix")}
                            >
                              <LayoutGrid className="h-4 w-4 text-[#2980B9]" aria-hidden />
                            </Link>
                            <button
                              type="button"
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              aria-label={t("reschedule")}
                              onClick={() => {
                                setRescheduleOrderId(o.id);
                                setRescheduleTime(
                                  new Date(o.scheduledAt).toISOString().slice(11, 16),
                                );
                              }}
                            >
                              <CalendarClock className="h-4 w-4 text-[#7F8C8D]" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              aria-label={t("cancelProcedure")}
                              disabled={busy}
                              onClick={() => void cancelProcedure(o.id)}
                            >
                              <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {scheduleOrders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                        {t("noProcedures")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={bulkCancelOpen}
        title={t("bulkCancel", { defaultValue: "Bulk cancel" })}
        onClose={() => setBulkCancelOpen(false)}
        footer={
          <ModalFooter
            onCancel={() => setBulkCancelOpen(false)}
            onSubmit={() => void submitBulkCancel()}
            busy={busy}
            submitLabel={t("cancelProcedure")}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <Field
            label={t("bulkCancelReason", { defaultValue: "Reason" })}
            preset="shortText"
            value={bulkCancelReason}
            onChange={(e) => setBulkCancelReason(e.target.value)}
            required
          />
          <Field
            label={t("replaceWithCode", { defaultValue: "Replace with code (optional)" })}
            preset="code"
            value={bulkCancelReplace}
            onChange={(e) => setBulkCancelReplace(e.target.value)}
          />
        </div>
      </ModalShell>

      <ModalShell
        open={complaintModalOpen}
        title={t("newComplaint")}
        onClose={() => setComplaintModalOpen(false)}
        footer={
          <ModalFooter
            onCancel={() => setComplaintModalOpen(false)}
            onSubmit={() => void postAction("complaint", { text: complaint })}
            busy={busy}
            submitLabel={t("add")}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <Field
            label={t("newComplaint")}
            preset="shortText"
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            required
          />
        </div>
      </ModalShell>

      <ModalShell
        open={diagnosisModalOpen}
        title={t("addDiagnosis")}
        onClose={() => setDiagnosisModalOpen(false)}
        footer={
          <ModalFooter
            onCancel={() => setDiagnosisModalOpen(false)}
            onSubmit={() =>
              void postAction("diagnosis", {
                icdCodeId,
                note: diagnosisNote || null,
              })
            }
            busy={busy}
            submitLabel={t("addDiagnosis")}
          />
        }
      >
        <div className={`${FORM_STACK_CLASS} grid grid-cols-1 gap-3`}>
          <IcdPicker
            label={t("icdCode")}
            valueId={icdCodeId}
            required
            showChapterFilter
            chapter={icdChapter}
            onChapterChange={setIcdChapter}
            onChange={(id) => setIcdCodeId(id)}
          />
          <FieldTextarea
            label={t("diagnosisNote")}
            rows={3}
            value={diagnosisNote}
            onChange={(e) => setDiagnosisNote(e.target.value)}
          />
        </div>
      </ModalShell>

      <ModalShell
        open={labModalOpen}
        title={t("orderLab")}
        onClose={() => setLabModalOpen(false)}
        footer={
          <ModalFooter
            onCancel={() => setLabModalOpen(false)}
            onSubmit={() => {
              if (!testCode) {
                setMsg(t("failed"));
                return;
              }
              void postAction("lab", { testCode });
            }}
            busy={busy}
            submitDisabled={!testCode}
            submitLabel={t("orderLab")}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <FieldSelect
            label={t("orderLab")}
            preset="select"
            value={testCode}
            onChange={(e) => setTestCode(e.target.value)}
            required
          >
            <option value="">—</option>
            {labCatalogItems.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} — {pickL10n(item.title, locale)}
              </option>
            ))}
          </FieldSelect>
        </div>
      </ModalShell>

      <ModalShell
        open={programModalOpen}
        title={t("completeCheckupSchedule")}
        onClose={() => setProgramModalOpen(false)}
        footer={
          <ModalFooter
            onCancel={() => setProgramModalOpen(false)}
            onSubmit={() =>
              void postAction("complete-checkup", {
                programCode: programCode || selected?.programCode || undefined,
                startsOn: new Date(`${programStartsOn}T09:00:00`).toISOString(),
              })
            }
            busy={busy}
            submitDisabled={!canCompleteCheckup || !(programCode || selected?.programCode)}
            submitLabel={t("completeCheckupSchedule")}
          />
        }
      >
        <div className={`${FORM_STACK_CLASS} grid grid-cols-2 gap-3`}>
          <FieldSelect
            label={t("programSelect")}
            preset="select"
            value={programCode || selected?.programCode || ""}
            onChange={(e) => setProgramCode(e.target.value)}
            required
          >
            <option value="">—</option>
            {naftaPackageTemplates.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} — {p.name}
              </option>
            ))}
          </FieldSelect>
          <DatePicker
            label={t("startsOn")}
            value={programStartsOn}
            onChange={setProgramStartsOn}
            placeholder={tc("datePlaceholder")}
            openCalendarLabel={tc("openCalendar")}
          />
        </div>
      </ModalShell>

      <ModalShell
        open={walkInModalOpen}
        title={t("registerWalkIn")}
        onClose={() => setWalkInModalOpen(false)}
        maxWidthClass="max-w-2xl"
        footer={
          <ModalFooter
            onCancel={() => setWalkInModalOpen(false)}
            onSubmit={() => void registerWalkIn()}
            busy={busy}
            submitLabel={t("registerWalkIn")}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <FieldRow cols={3}>
            <Field
              label={tp("firstName")}
              preset="shortText"
              value={walkIn.firstName}
              onChange={(e) => setWalkIn({ ...walkIn, firstName: e.target.value })}
              required
            />
            <Field
              label={tp("lastName")}
              preset="shortText"
              value={walkIn.lastName}
              onChange={(e) => setWalkIn({ ...walkIn, lastName: e.target.value })}
              required
            />
            <Field
              label={tp("middleName")}
              preset="shortText"
              value={walkIn.middleName}
              onChange={(e) => setWalkIn({ ...walkIn, middleName: e.target.value })}
            />
          </FieldRow>
          <FieldRow>
            <Field
              label={t("walkInPhone")}
              preset="phone"
              value={walkIn.phone}
              onChange={(e) => setWalkIn({ ...walkIn, phone: e.target.value })}
            />
            <CatalogField
              kind="SEARCHABLE"
              label={t("walkInNationality")}
              value={walkIn.nationality}
              onChange={(v) =>
                setWalkIn({ ...walkIn, nationality: String(v ?? "").toUpperCase() })
              }
              options={[...NATIONALITY_OPTIONS]}
              emptyLabel={t("sexUnknown")}
            />
          </FieldRow>
          <FieldRow>
            <Field
              label={t("walkInFin")}
              preset="fin"
              value={walkIn.fin}
              onChange={(e) => setWalkIn({ ...walkIn, fin: e.target.value })}
            />
            <Field
              label={t("walkInPassport")}
              preset="shortText"
              value={walkIn.passport}
              onChange={(e) => setWalkIn({ ...walkIn, passport: e.target.value })}
            />
          </FieldRow>
          <FieldRow>
            <FieldSelect
              label={t("walkInSex")}
              preset="select"
              value={walkIn.sex}
              onChange={(e) =>
                setWalkIn({
                  ...walkIn,
                  sex: e.target.value as WalkInForm["sex"],
                })
              }
              required
            >
              <option value="">{t("walkInSexEmpty")}</option>
              <option value="MALE">{t("sexMale")}</option>
              <option value="FEMALE">{t("sexFemale")}</option>
            </FieldSelect>
            <DatePicker
              label={t("walkInBirthDate")}
              value={walkIn.birthDate}
              onChange={(isoDate) => setWalkIn({ ...walkIn, birthDate: isoDate })}
              placeholder={tc("datePlaceholder")}
              openCalendarLabel={tc("openCalendar")}
            />
          </FieldRow>
          <FieldRow>
            <FieldSelect
              label={t("programSelect")}
              preset="select"
              value={walkIn.programCode}
              onChange={(e) => setWalkIn({ ...walkIn, programCode: e.target.value })}
            >
              <option value="">—</option>
              {naftaPackageTemplates.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} — {p.name}
                </option>
              ))}
            </FieldSelect>
          </FieldRow>
          <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("walkInHint")}</p>
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(rescheduleOrderId)}
        title={t("reschedule")}
        onClose={() => setRescheduleOrderId(null)}
        footer={
          <ModalFooter
            onCancel={() => setRescheduleOrderId(null)}
            onSubmit={() => void rescheduleProcedure()}
            busy={busy}
            submitLabel={t("reschedule")}
          />
        }
      >
        <Field
          label={t("procedureTime")}
          preset="time"
          type="time"
          value={rescheduleTime}
          onChange={(e) => setRescheduleTime(e.target.value)}
        />
      </ModalShell>

      <ModalShell
        open={labRepeatOpen}
        title={t("labRepeatTitle")}
        onClose={() => setLabRepeatOpen(false)}
        footer={
          <ModalFooter
            onCancel={() => setLabRepeatOpen(false)}
            onSubmit={() => {
              setLabRepeatOpen(false);
              void postAction("lab", { testCode: pendingLabCode, confirmRepeat: true });
            }}
            busy={busy}
            submitLabel={tc("yes")}
            cancelLabel={tc("no")}
          />
        }
      >
        <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
          {t("labRepeatBody", { code: pendingLabCode })}
        </p>
      </ModalShell>

      <PatientCardModal
        patientId={patientCardId}
        open={Boolean(patientCardId)}
        onClose={() => setPatientCardId(null)}
      />
    </div>
  );
}
