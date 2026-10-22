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

type Place = "queue" | "progress" | "late" | "done" | "waiting";

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
  // Deadline still ahead: the window has not closed. A stale checkInOpen must not
  // dump the card into Late for the seconds before the next reload.
  if (now < deadline) return "waiting";
  return "late";
}

export default function NursePage() {
  const t = useTranslations("nurse");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { auth } = useClinicAuth();
  const isDemoStaffFilter = auth?.isPlatformSuperAdmin === true;

  const [orders, setOrders] = useState<Proc[]>([]);
  const [dayStartHour, setDayStartHour] = useState(9);
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
          if (!opts?.silent) showApiError(payload, tc("loadingFailed"));
          return;
        }
        const body = (payload.data ?? payload) as {
          orders?: Proc[];
          mineUnlinked?: boolean;
          dayStartHour?: number;
          dayEndHour?: number;
        };
        const rows = Array.isArray(body) ? (body as Proc[]) : (body.orders ?? []);
        setOrders(rows);
        setMineUnlinked(body && !Array.isArray(body) ? body.mineUnlinked === true : false);
        if (body && !Array.isArray(body)) {
          if (typeof body.dayStartHour === "number") setDayStartHour(body.dayStartHour);
          if (typeof body.dayEndHour === "number") setDayEndHour(body.dayEndHour);
        }
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    },
    [date, debouncedPatient, debouncedProcedure, mineOn, demoPractitionerId, locale, tc],
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

  const dayProgress = useMemo(() => {
    const start = parseBakuDateTime(date, `${String(dayStartHour).padStart(2, "0")}:00`);
    const end = parseBakuDateTime(date, `${String(dayEndHour).padStart(2, "0")}:00`);
    const total = end.getTime() - start.getTime();
    if (total <= 0) return { label: t("dayClosed") };
    if (nowTick < start.getTime()) return { label: t("dayNotStarted") };
    if (nowTick >= end.getTime()) return { label: t("dayEnded") };
    const leftMin = Math.ceil((end.getTime() - nowTick) / 60_000);
    const h = Math.floor(leftMin / 60);
    const m = leftMin % 60;
    return { label: t("dayRemaining", { hours: h, minutes: m }) };
  }, [nowTick, dayStartHour, dayEndHour, date, t]);

  const buckets = useMemo(() => {
    const queue: Proc[] = [];
    const progress: Proc[] = [];
    const late: Proc[] = [];
    const done: Proc[] = [];
    const waiting: Proc[] = [];
    const dayEnd = parseBakuDateTime(
      date,
      `${String(dayEndHour).padStart(2, "0")}:00`,
    ).getTime();
    for (const order of orders) {
      const place = placeOrder(order, nowTick, dayEnd, isToday);
      if (place === "queue") queue.push(order);
      else if (place === "progress") progress.push(order);
      else if (place === "late") late.push(order);
      else if (place === "done") done.push(order);
      else if (place === "waiting") waiting.push(order);
    }
    return { queue, progress, late, done, waiting };
  }, [orders, nowTick, dayEndHour, date, isToday]);

  const visibleCount =
    buckets.queue.length +
    buckets.progress.length +
    buckets.late.length +
    buckets.done.length +
    buckets.waiting.length;

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
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 break-words text-sm font-semibold leading-snug text-[#34495E]">
            {order.patientRef.fullName}
          </p>
          <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${chip}`}>
            {statusLabel(order.status)}
          </span>
        </div>
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
        <div className="self-start">{infoButton(order)}</div>
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
    hint,
    rows,
    empty,
    allowCheckIn,
    tone,
  }: {
    title: string;
    hint: string;
    rows: Proc[];
    empty: string;
    allowCheckIn?: boolean;
    tone?: string;
  }) {
    return (
      <div
        className={`${CARD_CONTAINER_CLASS} flex min-h-0 min-w-0 flex-col p-2.5 ${tone ?? ""} ${
          fullscreen ? "h-full overflow-hidden" : ""
        }`}
      >
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className={`mb-2 text-[11px] leading-snug ${TEXT_MUTED_CLASS}`}>{hint}</p>
        <ul
          className={`space-y-2 text-sm ${
            fullscreen ? "min-h-0 flex-1 overflow-y-auto" : "max-h-[32rem] overflow-y-auto"
          }`}
        >
          {rows.map((order) => renderOrderCard(order, allowCheckIn))}
          {rows.length === 0 ? <li className="text-slate-500">{empty}</li> : null}
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
            {loading ? tc("loading") : t("resultCount", { count: visibleCount })}
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

  const board = (
    <div
      ref={boardRef}
      className={`flex min-h-0 min-w-0 flex-col gap-2 ${fullscreen ? "flex-1" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md bg-[#2980B9]/10 px-2 py-1 text-[12px] font-semibold text-[#2980B9]">
          {dayProgress.label}
        </span>
      </div>
      {buckets.waiting.length > 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} p-2.5`}>
          <h3 className="mb-1 text-sm font-semibold">
            {isToday ? t("waitingTitle") : t("waitingOther")}
          </h3>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-[12px]">
            {buckets.waiting.map((order) => (
              <li key={order.id} className="flex items-start justify-between gap-2 text-[#34495E]">
                <div className="min-w-0 leading-snug">
                  <span className="block break-words font-semibold">{order.patientRef.fullName}</span>
                  <span className="block break-words">{order.procedureName}</span>
                  <span className={TEXT_MUTED_CLASS}>
                    {timeRange(order)} · {cabinOf(order)}
                  </span>
                </div>
                {infoButton(order)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div
        className={`grid min-h-0 gap-2 ${
          fullscreen || fourCols ? "grid-cols-4" : "grid-cols-2"
        } ${fullscreen ? "h-full min-h-0 flex-1 grid-rows-[minmax(0,1fr)]" : ""}`}
      >
        <Column
          title={t("queueUpcoming")}
          hint={t("queueUpcomingHint")}
          rows={buckets.queue}
          empty={t("queueUpcomingEmpty")}
          allowCheckIn={isToday}
        />
        <Column
          title={t("queueInProgress")}
          hint={t("queueInProgressHint")}
          rows={buckets.progress}
          empty={t("queueInProgressEmpty")}
          tone="border-emerald-300 bg-emerald-50/50"
        />
        <Column
          title={t("queueOverdue")}
          hint={t("queueOverdueHint")}
          rows={buckets.late}
          empty={t("queueOverdueEmpty")}
          tone="border-amber-300 bg-amber-50/60"
        />
        <Column
          title={t("queueCompleted")}
          hint={t("queueCompletedHint")}
          rows={buckets.done}
          empty={t("queueCompletedEmpty")}
        />
      </div>
    </div>
  );

  const hints = (
    <>
      {mineUnlinked ? (
        <p className="mb-3 text-[12px] text-amber-800">{t("mineUnlinked")}</p>
      ) : null}
      <p className={`mb-3 text-[12px] ${TEXT_MUTED_CLASS}`}>{t("lifecycleHint")}</p>
    </>
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2 sm:px-4">
            <div className="shrink-0">{filters}</div>
            <div className="shrink-0">{hints}</div>
            {board}
          </div>
        </ViewportOverlay>
      ) : (
        <>
          <PageHeader title={t("title")} subtitle={t("subtitle")} />
          {demoFilter}
          {filters}
          {hints}
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
