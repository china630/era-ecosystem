"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Info, Maximize2, X } from "lucide-react";
import {
  APP_SHELL_CLASS,
  CARD_CONTAINER_CLASS,
  CHIP_ACTIVE_CLASS,
  CHIP_CLASS,
  DatePicker,
  EraListFilterBar,
  isoDateToDisplay,
  FIELD_SECTION_CLASS,
  Field,
  FieldSelect,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
  ViewportOverlay,
  showApiError,
  showSuccess,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { useClinicAuth } from "@/hooks/useClinicAuth";
import { bakuTimeLabel, parseBakuDateTime, todayBakuYmd } from "@/lib/baku-day";

type NurseInstruction = {
  bodyPart: string | null;
  sites: string[];
  applyMode: string | null;
  fields: string[];
  note: string | null;
};

type Proc = {
  id: string;
  procedureName: string;
  procedureCode: string;
  scheduledAt: string;
  endsAt?: string | null;
  effectiveEndsAt?: string;
  checkInOpen?: boolean;
  checkInDeadline?: string;
  status: string;
  patientRef: { id: string; fullName: string; refCode?: string };
  resource?: { id: string; code: string; name: string } | null;
  instruction?: NurseInstruction | null;
};

const STATUS_CHIP: Record<string, string> = {
  SCHEDULED: "bg-[#2980B9]/10 text-[#2980B9]",
  CHECKED_IN: `bg-[#27AE60]/10 ${TEXT_SUCCESS_CLASS}`,
  COMPLETED: "bg-slate-500/10 text-slate-700",
  NO_SHOW: "bg-amber-500/10 text-amber-800",
};

type Place = "queue" | "progress" | "late" | "done";

function placeOrder(
  order: Proc,
  now: number,
  dayEnd: number,
  isToday: boolean,
): Place | null {
  if (order.status === "CHECKED_IN") return "progress";
  if (order.status === "COMPLETED") return "done";
  if (order.status === "NO_SHOW") {
    if (isToday && now >= dayEnd) return null;
    return "late";
  }
  if (order.status !== "SCHEDULED") return null;
  if (order.checkInOpen) return "queue";
  const start = new Date(order.scheduledAt).getTime();
  const deadline = order.checkInDeadline
    ? new Date(order.checkInDeadline).getTime()
    : start;
  // Still ahead of the close: stays in the queue. Check-in is drawn only while
  // checkInOpen is true, so a later slot does not get a button.
  if (now < deadline) return "queue";
  return "late";
}

export default function NursePage() {
  const t = useTranslations("nurse");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { auth } = useClinicAuth();
  const isDemoStaffFilter = auth?.isPlatformSuperAdmin === true;

  const [orders, setOrders] = useState<Proc[]>([]);
  const [appliedKey, setAppliedKey] = useState("");
  const [dayEndHour, setDayEndHour] = useState(18);
  const [mineOn, setMineOn] = useState(false);
  const [deskMine, setDeskMine] = useState(false);
  const [mineUnlinked, setMineUnlinked] = useState(false);
  const [mineDefaultApplied, setMineDefaultApplied] = useState(false);
  const [date, setDate] = useState(todayBakuYmd);
  const [patient, setPatient] = useState("");
  const debouncedPatient = useDebouncedValue(patient, 300);
  const [procedure, setProcedure] = useState("");
  const debouncedProcedure = useDebouncedValue(procedure, 300);
  const [demoPractitionerId, setDemoPractitionerId] = useState("");
  const [demoStaff, setDemoStaff] = useState<
    Array<{ id: string; fullName: string; code: string; staffKind: string; specialty: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [fullscreen, setFullscreen] = useState(false);
  const [fourCols, setFourCols] = useState(false);
  const [info, setInfo] = useState<Proc | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const loadSeq = useRef(0);
  const loadRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => {});
  const busyRef = useRef(false);
  const dateRef = useRef(date);
  dateRef.current = date;

  useEffect(() => {
    if (mineDefaultApplied || !auth) return;
    let cancelled = false;
    void fetch("/api/procedures/desk-staff")
      .then(async (res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (cancelled) return;
        const payload = (raw?.data ?? raw) as {
          staff?: Array<{
            id: string;
            fullName: string;
            code: string;
            staffKind: string;
            specialty: string | null;
          }>;
          mine?: boolean;
        } | null;
        const rows = Array.isArray(payload?.staff) ? payload.staff : [];
        setDemoStaff(rows);
        setDeskMine(payload?.mine === true);
        const kind = auth.staffKind;
        const procedureRole =
          kind === "NURSE" || kind === "BATH" || kind === "MASSAGE";
        if (!auth.isPlatformSuperAdmin && (payload?.mine || procedureRole)) {
          setMineOn(true);
        }
        setMineDefaultApplied(true);
      })
      .catch(() => {
        if (cancelled) return;
        const kind = auth.staffKind;
        if (
          !auth.isPlatformSuperAdmin &&
          (kind === "NURSE" || kind === "BATH" || kind === "MASSAGE")
        ) {
          setMineOn(true);
        }
        setMineDefaultApplied(true);
      });
    return () => {
      cancelled = true;
    };
  }, [auth, mineDefaultApplied]);

  const requestKey = `${date}|${debouncedPatient}|${debouncedProcedure}|${mineOn ? "1" : "0"}|${demoPractitionerId}|${locale}`;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const seq = ++loadSeq.current;
      if (!opts?.silent) setLoading(true);
      try {
        const params = new URLSearchParams({ date, locale, status: "ALL" });
        if (debouncedPatient.trim()) params.set("patient", debouncedPatient.trim());
        if (debouncedProcedure.trim()) params.set("procedure", debouncedProcedure.trim());
        if (demoPractitionerId) {
          params.set("practitionerId", demoPractitionerId);
        } else if (mineOn) {
          params.set("mine", "1");
        }
        const res = await fetch(`/api/procedures?${params}`);
        const payload = await res.json().catch(() => ({}));
        if (seq !== loadSeq.current) return;
        if (!res.ok) {
          if (!opts?.silent) {
            showApiError(payload, tc("loadingFailed"));
            setOrders([]);
            setMineUnlinked(false);
            setAppliedKey(requestKey);
          }
          return;
        }
        const body = (payload.data ?? payload) as {
          orders?: Proc[];
          mineUnlinked?: boolean;
          dayEndHour?: number;
        };
        const rows = Array.isArray(body) ? (body as Proc[]) : (body.orders ?? []);
        setOrders(rows);
        setAppliedKey(requestKey);
        setMineUnlinked(body && !Array.isArray(body) ? body.mineUnlinked === true : false);
        if (body && !Array.isArray(body) && typeof body.dayEndHour === "number") {
          setDayEndHour(body.dayEndHour);
        }
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    },
    [date, debouncedPatient, debouncedProcedure, mineOn, demoPractitionerId, locale, requestKey, tc],
  );

  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick(Date.now());
      if (dateRef.current !== todayBakuYmd()) return;
      if (busyRef.current) return;
      void loadRef.current({ silent: true });
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!fullscreen && !info) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (info) setInfo(null);
      else setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, info]);

  useEffect(() => {
    if (fullscreen) return;
    const el = boardRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setFourCols(width >= 1000);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fullscreen]);

  const isToday = date === todayBakuYmd();
  const boardReady = appliedKey === requestKey;

  const buckets = useMemo(() => {
    const queue: Proc[] = [];
    const progress: Proc[] = [];
    const late: Proc[] = [];
    const done: Proc[] = [];
    const dayEnd = parseBakuDateTime(
      date,
      `${String(dayEndHour).padStart(2, "0")}:00`,
    ).getTime();
    const source = boardReady ? orders : [];
    for (const order of source) {
      const place = placeOrder(order, nowTick, dayEnd, isToday);
      if (place === "queue") queue.push(order);
      else if (place === "progress") progress.push(order);
      else if (place === "late") late.push(order);
      else if (place === "done") done.push(order);
    }
    return { queue, progress, late, done };
  }, [orders, boardReady, nowTick, dayEndHour, date, isToday]);

  const visibleCount =
    buckets.queue.length +
    buckets.progress.length +
    buckets.late.length +
    buckets.done.length;

  function statusLabel(status: string) {
    const known = ["SCHEDULED", "CHECKED_IN", "COMPLETED", "NO_SHOW"] as const;
    if ((known as readonly string[]).includes(status)) {
      return t(`status.${status}` as "status.SCHEDULED");
    }
    return status;
  }

  function timeRange(order: Proc) {
    const start = bakuTimeLabel(order.scheduledAt);
    const endSrc = order.endsAt || order.effectiveEndsAt;
    return endSrc ? `${start}–${bakuTimeLabel(endSrc)}` : start;
  }

  function cabinOf(order: Proc) {
    return order.resource?.name || order.resource?.code || "—";
  }

  function infoButton(order: Proc) {
    return (
      <button
        type="button"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#D5DADF] bg-white text-[#2980B9]"
        aria-label={t("detailsTitle")}
        onClick={() => setInfo(order)}
      >
        <Info className="h-5 w-5" aria-hidden />
      </button>
    );
  }

  async function checkIn(id: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(id);
    try {
      const res = await fetch(`/api/procedures/${id}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t("checkInFailed"));
        return;
      }
      showSuccess(t("checkInOk"));
      await load();
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }

  function resetFilters() {
    const today = todayBakuYmd();
    const kind = auth?.staffKind;
    const defaultMine =
      !auth?.isPlatformSuperAdmin &&
      (deskMine || kind === "NURSE" || kind === "BATH" || kind === "MASSAGE");
    setDate(today);
    setPatient("");
    setProcedure("");
    setMineOn(defaultMine);
    setDemoPractitionerId("");
    setMineUnlinked(false);
  }

  function deskKindLabel(kind: string, specialty: string | null) {
    if (kind === "DOCTOR") return specialty?.trim() || t("staffKindDoctor");
    if (kind === "BATH") return t("staffKindBath");
    if (kind === "MASSAGE") return t("staffKindMassage");
    return t("staffKindNurse");
  }

  function renderOrderCard(order: Proc, allowCheckIn?: boolean) {
    const chip = STATUS_CHIP[order.status] ?? "bg-slate-100 text-slate-700";
    const showCheckIn = allowCheckIn && order.status === "SCHEDULED" && order.checkInOpen === true;
    return (
      <li
        key={order.id}
        className="flex flex-col gap-1.5 rounded-xl border border-[#D5DADF]/80 bg-[#FAFBFC] p-2.5"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="break-words text-sm font-semibold leading-snug text-[#34495E]">
              {order.patientRef.fullName}
            </p>
            <p className="break-words text-[13px] font-medium leading-snug text-[#34495E]">
              {order.procedureName}
            </p>
            <p className="text-[12px] text-[#34495E]">
              <span className={TEXT_MUTED_CLASS}>{t("timeLabel")}: </span>
              {timeRange(order)}
            </p>
            <p className="text-[12px] text-[#34495E]">
              <span className={TEXT_MUTED_CLASS}>{t("cabinLabel")}: </span>
              {cabinOf(order)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${chip}`}>
              {statusLabel(order.status)}
            </span>
            {infoButton(order)}
          </div>
        </div>
        {showCheckIn ? (
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} w-full`}
            disabled={busyId !== null}
            onClick={() => void checkIn(order.id)}
          >
            {t("checkIn")}
          </button>
        ) : null}
      </li>
    );
  }

  function Column({
    title,
    rows,
    empty,
    allowCheckIn,
    tone,
  }: {
    title: string;
    rows: Proc[];
    empty: string;
    allowCheckIn?: boolean;
    tone?: string;
  }) {
    return (
      <div
        className={`${CARD_CONTAINER_CLASS} flex min-h-0 min-w-0 flex-col p-2.5 ${tone ?? ""} ${
          fullscreen ? "h-full min-h-0 overflow-hidden" : ""
        }`}
      >
        <h3 className="mb-2 shrink-0 text-sm font-semibold">{title}</h3>
        <ul
          className={`space-y-2 text-sm ${
            fullscreen ? "min-h-0 flex-1 overflow-y-auto" : "max-h-[32rem] overflow-y-auto"
          }`}
        >
          {rows.map((order) => renderOrderCard(order, allowCheckIn))}
          {rows.length === 0 ? (
            <li className="text-slate-500">{boardReady ? empty : tc("loading")}</li>
          ) : null}
        </ul>
      </div>
    );
  }

  const instruction = info?.instruction;
  const instructionEmpty =
    !instruction ||
    (!instruction.bodyPart &&
      instruction.sites.length === 0 &&
      !instruction.applyMode &&
      instruction.fields.length === 0 &&
      !instruction.note);

  const demoFilter = isDemoStaffFilter ? (
    <div className="mb-4 rounded-xl border-2 border-amber-500 bg-amber-50 p-3">
      <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-amber-950">
        {t("demoStaffFilterTitle")}
      </p>
      <p className="mb-2 text-[12px] font-semibold text-amber-900">{t("demoStaffFilterHint")}</p>
      <FieldSelect
        label={t("demoStaffFilterLabel")}
        preset="select"
        value={demoPractitionerId}
        onChange={(e) => {
          const next = e.target.value;
          setDemoPractitionerId(next);
          if (next) setMineOn(false);
        }}
        className="font-bold"
        selectClassName="font-bold"
      >
        <option value="">{t("demoStaffFilterAll")}</option>
        {demoStaff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.fullName} · {deskKindLabel(s.staffKind, s.specialty)}
          </option>
        ))}
      </FieldSelect>
    </div>
  ) : null;

  const filters = (
    <EraListFilterBar
      resetLabel={t("resetFilters")}
      onReset={resetFilters}
      actionsExtra={
        <>
          <div className="inline-flex overflow-hidden rounded-lg border border-[#D5DADF] text-[12px]">
            <button
              type="button"
              className={`px-3 py-1.5 ${mineOn ? CHIP_ACTIVE_CLASS : CHIP_CLASS} !rounded-none !shadow-none`}
              onClick={() => setMineOn(true)}
            >
              {t("filterMine")}
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 ${!mineOn ? CHIP_ACTIVE_CLASS : CHIP_CLASS} !rounded-none !shadow-none`}
              onClick={() => setMineOn(false)}
            >
              {t("filterAll")}
            </button>
          </div>
          <span className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
            {loading || !boardReady ? tc("loading") : t("resultCount", { count: visibleCount })}
          </span>
          {fullscreen ? null : (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setFullscreen(true)}
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden />
              {t("enterFullscreen")}
            </button>
          )}
        </>
      }
    >
      <DatePicker
        label={t("filterDate")}
        value={date}
        onChange={setDate}
        placeholder={tc("datePlaceholder")}
        openCalendarLabel={tc("openCalendar")}
      />
      <Field
        label={t("filterPatient")}
        preset="shortText"
        value={patient}
        onChange={(e) => setPatient(e.target.value)}
        placeholder={t("filterPatientPlaceholder")}
      />
      <Field
        label={t("filterProcedure")}
        preset="shortText"
        value={procedure}
        onChange={(e) => setProcedure(e.target.value)}
        placeholder={t("filterProcedurePlaceholder")}
      />
    </EraListFilterBar>
  );

  const unlinkedNotice =
    boardReady && mineUnlinked ? (
      <p className="mb-3 shrink-0 text-[12px] text-amber-800">{t("mineUnlinked")}</p>
    ) : null;

  const board = (
    <div
      ref={boardRef}
      className={`flex min-h-0 min-w-0 flex-col ${fullscreen ? "flex-1" : ""}`}
    >
      <div
        className={`grid min-h-0 gap-2 ${
          fullscreen || fourCols ? "grid-cols-4" : "grid-cols-2"
        } ${fullscreen ? "min-h-0 flex-1 grid-rows-[minmax(0,1fr)]" : ""}`}
      >
        <Column
          title={t("queueUpcoming")}
          rows={buckets.queue}
          empty={t("queueUpcomingEmpty")}
          allowCheckIn={isToday}
        />
        <Column
          title={t("queueInProgress")}
          rows={buckets.progress}
          empty={t("queueInProgressEmpty")}
          tone="border-emerald-300 bg-emerald-50/50"
        />
        <Column
          title={t("queueOverdue")}
          rows={buckets.late}
          empty={t("queueOverdueEmpty")}
          tone="border-amber-300 bg-amber-50/60"
        />
        <Column
          title={t("queueCompleted")}
          rows={buckets.done}
          empty={t("queueCompletedEmpty")}
        />
      </div>
    </div>
  );

  return (
    <>
      {fullscreen ? (
        <ViewportOverlay
          className={`fixed inset-0 z-[180] flex flex-col ${APP_SHELL_CLASS}`}
          label={t("fullscreenTitle")}
        >
          <div
            className={`flex shrink-0 items-center justify-between gap-3 rounded-none border-x-0 border-t-0 bg-white px-4 py-3 sm:px-6 ${FIELD_SECTION_CLASS}`}
          >
            <div className="min-w-0">
              <h2 className="m-0 truncate text-lg font-semibold">{t("fullscreenTitle")}</h2>
              <p className={`m-0 truncate text-[13px] ${TEXT_MUTED_CLASS}`}>
                {isoDateToDisplay(date) || date}
              </p>
            </div>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setFullscreen(false)}
              aria-label={t("exitFullscreen")}
            >
              <X className="h-4 w-4" aria-hidden />
              {t("exitFullscreen")}
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-2 sm:px-4">
            {unlinkedNotice}
            {board}
          </div>
        </ViewportOverlay>
      ) : (
        <>
          <PageHeader title={t("title")} subtitle={t("subtitle")} />
          {demoFilter}
          {filters}
          {unlinkedNotice}
          {board}
        </>
      )}

      <ModalShell
        open={info !== null}
        title={info?.patientRef.fullName ?? t("detailsTitle")}
        subtitle={info?.procedureName}
        onClose={() => setInfo(null)}
        closeLabel={tc("close")}
      >
        {instructionEmpty ? (
          <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{t("detailsEmpty")}</p>
        ) : (
          <dl className="space-y-3 text-sm text-[#34495E]">
            {instruction?.bodyPart ? (
              <div>
                <dt className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("detailsBodyPart")}</dt>
                <dd className="m-0">{instruction.bodyPart}</dd>
              </div>
            ) : null}
            {instruction && instruction.sites.length > 0 ? (
              <div>
                <dt className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("detailsSites")}</dt>
                <dd className="m-0">{instruction.sites.join(", ")}</dd>
              </div>
            ) : null}
            {instruction?.applyMode ? (
              <div>
                <dt className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("detailsMode")}</dt>
                <dd className="m-0">{instruction.applyMode}</dd>
              </div>
            ) : null}
            {instruction && instruction.fields.length > 0 ? (
              <div>
                <dt className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("detailsFields")}</dt>
                <dd className="m-0">{instruction.fields.join(" · ")}</dd>
              </div>
            ) : null}
            {instruction?.note ? (
              <div>
                <dt className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("detailsNote")}</dt>
                <dd className="m-0 whitespace-pre-wrap">{instruction.note}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </ModalShell>
    </>
  );
}
