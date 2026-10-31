"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClipboardList,
  DoorClosed,
  Eye,
  ListChecks,
  Plus,
  TestTube2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useClinicAuth } from "@/hooks/useClinicAuth";
import { bakuCivilUtcDate, bakuDateDisplay, todayBakuYmd } from "@/lib/baku-day";
import {
  CatalogField,
  DatePicker,
  EraDataGrid,
  EraListFilterBar,
  EraListWorkspace,
  Field,
  FieldRow,
  FieldSelect,
  FORM_STACK_CLASS,
  inferCatalogFieldKind,
  LIST_PAGE_SHELL_CLASS,
  ListPaginationFooter,
  ModalFooter,
  ModalShell,
  countryOptions,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  PageHeader,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
  type EraDataGridColumn,
  usePaginatedList,
} from "@era/satellite-kit/ui";
import { composeFullName } from "@/domain/patient/patient-ref-code";
import { ageYearsFromBirthDate } from "@/domain/patient/patient-demographics";
import { PatientCardModal } from "@/components/patients/PatientCardModal";

type CourseMark = "ready" | "attention" | "blocked";

type EpisodeListFilters = {
  q: string;
  origin: string;
  room: string;
  program: string;
  course: string;
  sort: string;
  sortDir: "" | "asc" | "desc";
};

type ProcedureLine = {
  procedureCode: string;
  quotaTotal: number;
  quotaUsed: number;
  quotaCompleted?: number;
};

type ProgramInstance = {
  programCode: string;
  startsOn: string;
  endsOn: string;
  procedureLines: ProcedureLine[];
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
  anamnesisText?: string | null;
  canCloseWalkIn?: boolean;
  /** CLI-56 — at least one care-team doctor assigned. */
  hasCareTeam?: boolean;
  /** W2 — package entitlement signal for list badge. */
  packageSignal?: "OK" | "NO_PROGRAM_CODE" | "NO_PROGRAM" | "NO_PACKAGE_CONFIRMED";
  courseMark?: CourseMark;
  patientRef: {
    id: string;
    fullName: string;
    refCode: string;
    sex?: "MALE" | "FEMALE" | "UNKNOWN" | null;
    birthDate?: string | null;
    nationality?: string | null;
  } | null;
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
  hotelStay?: { startsOn: string; endsOn: string } | null;
  /** YYYY-MM-DD — hotel check-in, else program start, else episode opened day. */
  arrivalOn?: string | null;
  /** YYYY-MM-DD — hotel check-out. Empty for walk-in. */
  departureOn?: string | null;
  firstDoctorName?: string | null;
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

/** Prisma DateTime arrives as an ISO instant; day math needs YYYY-MM-DD. */
function civilYmd(value: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(value).trim());
  return m?.[1] ?? null;
}

function daysRemaining(endsOn: string): number {
  const ymd = civilYmd(endsOn);
  if (!ymd) return 0;
  const end = bakuCivilUtcDate(ymd);
  const today = bakuCivilUtcDate(todayBakuYmd());
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000));
}

function courseDotClass(mark: CourseMark): string {
  if (mark === "ready") return "bg-[#27AE60]";
  if (mark === "attention") return "bg-[#F1C40F]";
  return "bg-[#E74C3C]";
}

function CourseDot({ mark, label }: { mark: CourseMark; label: string }) {
  return (
    <span
      className={`inline-block h-3 w-3 shrink-0 rounded-full ${courseDotClass(mark)}`}
      title={label}
      aria-label={label}
    />
  );
}

export default function SanatoriumPage() {
  const t = useTranslations("sanatorium");
  const tc = useTranslations("common");
  const tp = useTranslations("patientRegistry");
  const locale = useLocale();
  const { auth } = useClinicAuth();
  const isSuperAdmin = Boolean(auth?.isPlatformSuperAdmin);
  const [selectedId, setSelectedId] = useState<string>("");
  const [patientCardId, setPatientCardId] = useState<string | null>(null);
  const [cardPanel, setCardPanel] = useState<string | null>(null);
  const [cardEpisodeId, setCardEpisodeId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const deepLinkHandled = useRef(false);
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [walkIn, setWalkIn] = useState<WalkInForm>(emptyWalkIn);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [filterOrigin, setFilterOrigin] = useState("");
  const [filterRoom, setFilterRoom] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [hotelRooms, setHotelRooms] = useState<string[]>([]);
  const [programCodes, setProgramCodes] = useState<string[]>([]);
  const [listSort, setListSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [careTeamOn, setCareTeamOn] = useState<Record<string, boolean>>({});

  const listFilters = useMemo<EpisodeListFilters>(
    () => ({
      q,
      origin: filterOrigin,
      room: filterRoom,
      program: filterProgram,
      course: filterCourse,
      sort: listSort?.key ?? "",
      sortDir: listSort?.dir ?? "",
    }),
    [q, filterOrigin, filterRoom, filterProgram, filterCourse, listSort],
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
      if (f.course) params.set("course", f.course);
      if (f.sort && f.sortDir) {
        params.set("sort", f.sort);
        params.set("sortDir", f.sortDir);
      }
      const res = await fetch(`/api/sanatorium/episodes?${params}`);
      if (!res.ok) throw new Error("Failed to load episodes");
      const json = await res.json();
      // API shape: { data: Episode[], total, hotelRooms?, programCodes? }
      // (hotelRooms/programCodes sit next to the array — not inside it).
      const root =
        json && typeof json === "object" ? (json as Record<string, unknown>) : {};
      const nested =
        root.data && typeof root.data === "object" && !Array.isArray(root.data)
          ? (root.data as Record<string, unknown>)
          : null;
      const meta = nested ?? root;
      if (Array.isArray(meta.hotelRooms)) setHotelRooms(meta.hotelRooms as string[]);
      if (Array.isArray(meta.programCodes)) {
        setProgramCodes(meta.programCodes as string[]);
      }
      return json;
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
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.data ?? data) as Episode;
  }, []);

  /** Deep link /sanatorium?episode=… opens the patient card on the Package tab. */
  useEffect(() => {
    const ep = searchParams.get("episode");
    if (!ep || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    void (async () => {
      setSelectedId(ep);
      const row = await loadDetail(ep);
      const patientId = row?.patientRef?.id;
      if (patientId) {
        setCardEpisodeId(ep);
        setCardPanel("package");
        setPatientCardId(patientId);
      }
    })();
  }, [searchParams, loadDetail]);

  function originLabel(origin: string): string {
    if (origin === "WALK_IN") return t("originWalkIn");
    if (origin === "IN_HOUSE") return t("originInHouse");
    return origin;
  }

  function openPatientCard(patientId: string, episodeId: string, panel: string) {
    setSelectedId(episodeId);
    setCardEpisodeId(episodeId);
    setCardPanel(panel);
    setPatientCardId(patientId);
  }

  async function openChart(episodeId: string) {
    const row = await loadDetail(episodeId);
    const patientId = row?.patientRef?.id;
    if (patientId) openPatientCard(patientId, episodeId, "package");
    else setSelectedId(episodeId);
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
      showApiError({ error: validationError });
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
        programCode: undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError(data, t("failed"));
      return;
    }
    setWalkInModalOpen(false);
    setWalkIn(emptyWalkIn());
    showSuccess(t("walkInRegistered"));
    await loadList();
    const ep = data.data ?? data;
    if (ep?.id) setSelectedId(ep.id);
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
    if (res.ok) showSuccess(t("closeWalkInOk"));
    else showApiError(data, t("failed"));
    if (res.ok) {
      if (selectedId === episodeId) {
        setSelectedId("");
      }
      await loadList();
    }
  }

  function markFor(e: Episode): CourseMark {
    const override = careTeamOn[e.id];
    const team = override ?? e.hasCareTeam === true;
    if (override === undefined && e.courseMark) return e.courseMark;
    if (!team) return "blocked";
    return e.packageSignal === "OK" ? "ready" : "attention";
  }

  function courseLabel(mark: CourseMark): string {
    if (mark === "ready") return t("courseReady");
    if (mark === "attention") return t("courseAttention");
    return t("courseBlocked");
  }

  const columns = useMemo<EraDataGridColumn<Episode & Record<string, unknown>>[]>(
    () => [
      {
        key: "assignment",
        header: t("colAssignment"),
        className: "w-10",
        render: (e) => {
          const mark = markFor(e);
          return <CourseDot mark={mark} label={courseLabel(mark)} />;
        },
      },
      {
        key: "patient",
        header: t("colPatient"),
        sortable: true,
        render: (e) => (
          <div className="font-medium">{e.patientRef?.fullName ?? t("guest")}</div>
        ),
      },
      {
        key: "ref",
        header: t("colRef"),
        render: (e) => e.patientRef?.refCode ?? "—",
      },
      {
        key: "sex",
        header: tp("sex"),
        render: (e) =>
          e.patientRef?.sex === "MALE"
            ? tp("sexShortMale")
            : e.patientRef?.sex === "FEMALE"
              ? tp("sexShortFemale")
              : "—",
      },
      {
        key: "age",
        header: tp("colAge"),
        render: (e) => {
          const age = ageYearsFromBirthDate(e.patientRef?.birthDate);
          return age != null ? tp("ageYears", { age }) : "—";
        },
      },
      {
        key: "nationality",
        header: tp("nationality"),
        render: (e) => {
          const code = e.patientRef?.nationality?.trim().toUpperCase();
          return code || "—";
        },
      },
      {
        key: "doctor",
        header: t("colDoctor"),
        render: (e) => e.firstDoctorName?.trim() || "—",
      },
      {
        key: "arrival",
        header: t("colArrival"),
        sortable: true,
        render: (e) => {
          const ymd = e.arrivalOn ?? e.programInstance?.startsOn ?? civilYmd(e.openedAt);
          return ymd ? bakuDateDisplay(ymd) : "—";
        },
      },
      {
        key: "departure",
        header: t("colDeparture"),
        render: (e) => (e.departureOn ? bakuDateDisplay(e.departureOn) : "—"),
      },
      {
        key: "room",
        header: t("colRoom"),
        sortable: true,
        render: (e) => e.roomNumber ?? "—",
      },
      {
        key: "origin",
        header: t("colOrigin"),
        sortable: true,
        render: (e) => originLabel(e.patientOrigin),
      },
      {
        key: "program",
        header: t("colProgram"),
        sortable: true,
        render: (e) => {
          if (e.patientOrigin === "WALK_IN") return "—";
          const code = e.programInstance?.programCode ?? e.programCode ?? "—";
          const signal = e.packageSignal ?? "OK";
          const showBadge = signal !== "OK" && signal !== "NO_PROGRAM";
          return (
            <div className="flex flex-wrap items-center gap-1">
              <span>{code}</span>
              {showBadge ? (
                <span
                  className={
                    signal === "NO_PACKAGE_CONFIRMED"
                      ? "inline-flex rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-700"
                      : "inline-flex rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-900"
                  }
                  title={t(`packageSignal_${signal}`)}
                >
                  {t(`packageSignal_${signal}`)}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "daysLeft",
        header: t("colDaysLeft"),
        render: (e) => {
          const prog = e.programInstance;
          return prog ? String(daysRemaining(prog.endsOn)) : "—";
        },
      },
      {
        key: "actions",
        header: tc("actions"),
        render: (e) => (
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
              disabled={!e.patientRef?.id}
              onClick={() => {
                if (!e.patientRef?.id) return;
                openPatientCard(e.patientRef.id, e.id, "plan");
              }}
            >
              <ListChecks className="h-4 w-4 text-[#2980B9]" aria-hidden />
            </button>
            {e.programInstance && e.patientRef?.id ? (
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={t("diagnosticsBtn")}
                onClick={() => openPatientCard(e.patientRef!.id, e.id, "diagnostics")}
              >
                <TestTube2 className="h-4 w-4 text-[#2980B9]" aria-hidden />
              </button>
            ) : null}
            {e.patientRef?.id ? (
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={t("patientCard")}
                onClick={() => openPatientCard(e.patientRef!.id, e.id, "guest")}
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
                  e.canCloseWalkIn === false ? t("closeWalkInBusyHint") : t("closeWalkIn")
                }
                onClick={() => void closeWalkIn(e.id)}
              >
                <DoorClosed className="h-4 w-4 text-[#E74C3C]" aria-hidden />
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    [t, tp, tc, busy, careTeamOn, locale],
  );

  async function applyOpenPackages() {
    setBusy(true);
    try {
      const res = await fetch("/api/sanatorium/package-apply-open", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t("failed"));
        return;
      }
      showSuccess(t("applyOpenPackagesDone", { count: data.updated ?? 0 }));
      if (Array.isArray(data.failed) && data.failed.length > 0) {
        const names = data.failed
          .map((row: { name?: string } | string) =>
            typeof row === "string" ? row : row.name || "",
          )
          .filter(Boolean)
          .join(", ");
        showApiError(
          {
            error: t("applyOpenPackagesPartial", {
              count: data.failed.length,
              names: names || String(data.failed.length),
            }),
          },
          t("failed"),
        );
      }
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          title={t("title")}
          actions={
            <div className="flex flex-wrap gap-2">
              {isSuperAdmin ? (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={busy}
                  onClick={() => void applyOpenPackages()}
                >
                  {t("applyOpenPackages")}
                </button>
              ) : null}
              <Link href="/sanatorium/walk-in-parties" className={SECONDARY_BUTTON_CLASS}>
                {t("registerWalkInGroup")}
              </Link>
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setWalkInModalOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                {t("registerWalkIn")}
              </button>
            </div>
          }
        />
      </div>

      <EraListWorkspace
        filter={
          <EraListFilterBar
            resetLabel={tc("filterReset")}
            onReset={() => {
              setQ("");
              setFilterOrigin("");
              setFilterRoom("");
              setFilterProgram("");
              setFilterCourse("");
            }}
          >
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
            <FieldSelect
              label={t("filterCourse")}
              preset="select"
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
            >
              <option value="">{tc("all")}</option>
              <option value="ready">{t("courseReady")}</option>
              <option value="attention">{t("courseAttention")}</option>
              <option value="blocked">{t("courseBlocked")}</option>
            </FieldSelect>
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
          <EraDataGrid
            columns={columns}
            rows={episodes as (Episode & Record<string, unknown>)[]}
            rowKey={(e) => e.id}
            emptyMessage={
              listLoading
                ? tc("loading")
                : `${t("noEpisodes")}${t("emptyHint") ? ` — ${t("emptyHint")}` : ""}`
            }
            pagination={false}
            paginationMode="server"
            embedded
            sort={listSort}
            onSortChange={setListSort}
          />
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
          <FieldRow cols={3}>
            <CatalogField
              kind="SEARCHABLE"
              label={t("walkInNationality")}
              value={walkIn.nationality}
              onChange={(v) =>
                setWalkIn({ ...walkIn, nationality: String(v ?? "").toUpperCase() })
              }
              options={countryOptions(locale, walkIn.nationality)}
              emptyLabel={t("sexUnknown")}
            />
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
            <Field
              label={t("walkInPhone")}
              preset="phone"
              value={walkIn.phone}
              onChange={(e) => setWalkIn({ ...walkIn, phone: e.target.value })}
            />
          </FieldRow>
          <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("walkInHint")}</p>
        </div>
      </ModalShell>

      <PatientCardModal
        patientId={patientCardId}
        open={Boolean(patientCardId)}
        panel={cardPanel}
        initialEpisodeId={cardEpisodeId}
        onClose={() => {
          setPatientCardId(null);
          setCardPanel(null);
          setCardEpisodeId(null);
        }}
        onCareTeamSize={(episodeId, count) => {
          setCareTeamOn((prev) => ({ ...prev, [episodeId]: count > 0 }));
        }}
      />
    </div>
  );
}
