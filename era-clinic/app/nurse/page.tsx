"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CHIP_ACTIVE_CLASS,
  CHIP_CLASS,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FieldSelect,
  FORM_INPUT_CLASS,
  LINK_ACCENT_CLASS,
  MODAL_CHECKBOX_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
} from "@era/satellite-kit/ui";
import { useClinicAuth } from "@/hooks/useClinicAuth";

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
};

function todayBakuYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const STATUS_OPTIONS = [
  "ACTIVE",
  "SCHEDULED",
  "CHECKED_IN",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
  "ALL",
] as const;

const STATUS_CHIP: Record<string, string> = {
  SCHEDULED: "bg-[#2980B9]/10 text-[#2980B9]",
  CHECKED_IN: `bg-[#27AE60]/10 ${TEXT_SUCCESS_CLASS}`,
  COMPLETED: "bg-slate-500/10 text-slate-700",
  NO_SHOW: "bg-amber-500/10 text-amber-800",
  CANCELLED: `bg-[#E74C3C]/10 ${TEXT_DANGER_CLASS}`,
};

export default function NursePage() {
  const t = useTranslations("nurse");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { auth } = useClinicAuth();
  const checkInRequiresQr = auth?.checkInRequiresQr !== false;
  const isDemoStaffFilter = auth?.isPlatformSuperAdmin === true;

  const [orders, setOrders] = useState<Proc[]>([]);
  const [dayStartHour, setDayStartHour] = useState(9);
  const [dayEndHour, setDayEndHour] = useState(18);
  const [mineOn, setMineOn] = useState(false);
  const [mineUnlinked, setMineUnlinked] = useState(false);
  const [mineDefaultApplied, setMineDefaultApplied] = useState(false);
  const [date, setDate] = useState(todayBakuYmd);
  const [status, setStatus] = useState<string>("ALL");
  const [patient, setPatient] = useState("");
  const debouncedPatient = useDebouncedValue(patient, 300);
  const [procedure, setProcedure] = useState("");
  const debouncedProcedure = useDebouncedValue(procedure, 300);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [demoPractitionerId, setDemoPractitionerId] = useState("");
  const [demoStaff, setDemoStaff] = useState<Array<{ id: string; fullName: string; code: string }>>([]);
  const [qrToken, setQrToken] = useState("");
  const [activeQrToken, setActiveQrToken] = useState<string | null>(null);
  const [qrOrders, setQrOrders] = useState<Proc[]>([]);
  const [qrPatient, setQrPatient] = useState<string | null>(null);
  const [qrPatientRefId, setQrPatientRefId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");
  const [loading, setLoading] = useState(true);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (mineDefaultApplied || !auth?.role) return;
    if (auth.role === "NURSE" && !auth.isPlatformSuperAdmin) {
      setMineOn(true);
    }
    setMineDefaultApplied(true);
  }, [auth?.role, auth?.isPlatformSuperAdmin, mineDefaultApplied]);

  useEffect(() => {
    if (!isDemoStaffFilter) return;
    let cancelled = false;
    void fetch("/api/admin/practitioners?staffKind=NURSE")
      .then(async (res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (cancelled || !raw) return;
        const rows = (raw.data ?? raw) as Array<{
          id: string;
          fullName: string;
          code: string;
          active?: boolean;
        }>;
        if (!Array.isArray(rows)) return;
        setDemoStaff(
          rows
            .filter((r) => r.active !== false)
            .map((r) => ({ id: r.id, fullName: r.fullName, code: r.code }))
            .sort((a, b) => a.fullName.localeCompare(b.fullName)),
        );
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [isDemoStaffFilter]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ date, locale, status });
    if (debouncedPatient.trim()) params.set("patient", debouncedPatient.trim());
    if (debouncedProcedure.trim()) params.set("procedure", debouncedProcedure.trim());
    if (overdueOnly) params.set("overdueOnly", "1");
    if (demoPractitionerId) {
      params.set("practitionerId", demoPractitionerId);
    } else if (mineOn) {
      params.set("mine", "1");
    }

    const res = await fetch(`/api/procedures?${params}`);
    const d = await res.json();
    const payload = d.data ?? d;
    const rows = (Array.isArray(payload) ? payload : (payload.orders ?? [])) as Proc[];
    setOrders(rows);
    setMineUnlinked(payload?.mineUnlinked === true);
    if (typeof payload?.dayStartHour === "number") setDayStartHour(payload.dayStartHour);
    if (typeof payload?.dayEndHour === "number") setDayEndHour(payload.dayEndHour);
    setLoading(false);
  }, [date, status, debouncedPatient, debouncedProcedure, overdueOnly, mineOn, demoPractitionerId, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const procedureOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders) {
      if (!map.has(o.procedureCode)) map.set(o.procedureCode, o.procedureName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders]);

  function show(message: string, tone: "ok" | "err" = "ok") {
    setMsg(message);
    setMsgTone(tone);
  }

  function statusLabel(s: string) {
    const known = ["SCHEDULED", "CHECKED_IN", "COMPLETED", "NO_SHOW", "CANCELLED"] as const;
    if ((known as readonly string[]).includes(s)) {
      return t(`status.${s}` as "status.SCHEDULED");
    }
    return s;
  }

  function isCheckInOpen(o: Proc) {
    if (o.status !== "SCHEDULED") return false;
    if (typeof o.checkInOpen === "boolean") return o.checkInOpen;
    const ends = o.effectiveEndsAt || o.endsAt || o.scheduledAt;
    return new Date(ends).getTime() >= nowTick;
  }

  async function scanQr() {
    show("");
    const res = await fetch("/api/nurse/qr-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: qrToken.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      show(data.error ?? t("qrFailed"), "err");
      setQrOrders([]);
      setQrPatient(null);
      setQrPatientRefId(null);
      setActiveQrToken(null);
      return;
    }
    const payload = data.data ?? data;
    setQrPatient(payload.patientName ?? null);
    setQrPatientRefId(payload.patientRefId ?? null);
    setQrOrders(payload.orders ?? []);
    setActiveQrToken(payload.qrToken ?? qrToken.trim());
    show(t("qrSuccess"));
  }

  async function checkIn(id: string) {
    show("");
    if (checkInRequiresQr && !activeQrToken) {
      show(t("qrRequiredFirst"), "err");
      return;
    }
    const body =
      checkInRequiresQr && activeQrToken ? { qrToken: activeQrToken } : {};
    const res = await fetch(`/api/procedures/${id}/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      show(data.error ?? t("checkInFailed"), "err");
      return;
    }
    show(t("checkInOk"));
    await load();
    if (qrToken.trim()) await scanQr();
  }

  const buckets = useMemo(() => {
    const overdue: Proc[] = [];
    const upcoming: Proc[] = [];
    const inProgress: Proc[] = [];
    const completed: Proc[] = [];
    for (const o of orders) {
      if (o.status === "CHECKED_IN") {
        inProgress.push(o);
        continue;
      }
      if (o.status === "COMPLETED") {
        completed.push(o);
        continue;
      }
      if (o.status === "SCHEDULED") {
        if (isCheckInOpen(o)) upcoming.push(o);
        else overdue.push(o);
      }
    }
    return { overdue, upcoming, inProgress, completed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, nowTick]);

  /** Agenda: one procedure before now … end of clinic day. */
  const agenda = useMemo(() => {
    const dayEnd = new Date();
    dayEnd.setHours(dayEndHour, 0, 0, 0);
    const eligible = [...orders]
      .filter((o) =>
        ["SCHEDULED", "CHECKED_IN", "COMPLETED"].includes(o.status),
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
    const pastOrNow = eligible.filter(
      (o) => new Date(o.scheduledAt).getTime() <= nowTick,
    );
    const oneBefore = pastOrNow.length > 0 ? pastOrNow[pastOrNow.length - 1] : null;
    const fromTs = oneBefore
      ? new Date(oneBefore.scheduledAt).getTime()
      : nowTick;
    return eligible.filter((o) => {
      const start = new Date(o.scheduledAt).getTime();
      return start >= fromTs && start < dayEnd.getTime();
    });
  }, [orders, nowTick, dayEndHour]);

  const dayProgress = useMemo(() => {
    const start = new Date();
    start.setHours(dayStartHour, 0, 0, 0);
    const end = new Date();
    end.setHours(dayEndHour, 0, 0, 0);
    const total = end.getTime() - start.getTime();
    if (total <= 0) return { pct: 0, label: t("dayClosed"), closed: true };
    if (nowTick < start.getTime()) {
      return { pct: 0, label: t("dayNotStarted"), closed: true };
    }
    if (nowTick >= end.getTime()) {
      return { pct: 100, label: t("dayEnded"), closed: true };
    }
    const leftMs = end.getTime() - nowTick;
    const leftMin = Math.ceil(leftMs / 60_000);
    const h = Math.floor(leftMin / 60);
    const m = leftMin % 60;
    const pct = Math.round(((nowTick - start.getTime()) / total) * 100);
    return {
      pct,
      label: t("dayRemaining", { hours: h, minutes: m }),
      closed: false,
    };
  }, [nowTick, dayStartHour, dayEndHour, t]);

  function renderOrderCard(o: Proc, opts?: { allowCheckIn?: boolean }) {
    const chip = STATUS_CHIP[o.status] ?? "bg-slate-100 text-slate-700";
    const open = isCheckInOpen(o);
    const canCheckIn = opts?.allowCheckIn && o.status === "SCHEDULED" && open;
    const showDisabledCheckIn =
      opts?.allowCheckIn && o.status === "SCHEDULED" && !open;
    const qrBlocked = checkInRequiresQr && !activeQrToken;
    return (
      <li
        key={o.id}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D5DADF]/80 bg-[#FAFBFC] p-3"
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/patients/${o.patientRef.id}`}
              className={`font-semibold ${LINK_ACCENT_CLASS}`}
            >
              {o.patientRef.fullName}
            </Link>
            <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${chip}`}>
              {statusLabel(o.status)}
            </span>
          </div>
          <p className="text-[13px] text-[#34495E]">
            <span className="font-medium">{o.procedureName}</span>
            <span className={TEXT_MUTED_CLASS}> · {o.procedureCode}</span>
            <span className={TEXT_MUTED_CLASS}>
              {" "}
              · {fmtTime(o.scheduledAt)}
              {o.endsAt || o.effectiveEndsAt
                ? `–${fmtTime(o.endsAt || o.effectiveEndsAt!)}`
                : ""}
            </span>
            {o.resource ? (
              <span className={TEXT_MUTED_CLASS}>
                {" "}
                · {o.resource.name || o.resource.code}
              </span>
            ) : null}
          </p>
        </div>
        <span className="flex flex-wrap gap-2">
          {canCheckIn ? (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => void checkIn(o.id)}
              disabled={qrBlocked}
              title={qrBlocked ? t("qrRequiredFirst") : undefined}
            >
              {t("checkIn")}
            </button>
          ) : null}
          {showDisabledCheckIn ? (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled
              title={t("checkInClosed")}
            >
              {t("checkIn")}
            </button>
          ) : null}
        </span>
      </li>
    );
  }

  function Column({
    title,
    hint,
    rows,
    allowCheckIn,
    tone,
  }: {
    title: string;
    hint: string;
    rows: Proc[];
    allowCheckIn?: boolean;
    tone?: string;
  }) {
    return (
      <div
        className={`${CARD_CONTAINER_CLASS} flex min-h-[12rem] flex-col p-3 ${tone ?? ""}`}
      >
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className={`mb-2 text-[11px] ${TEXT_MUTED_CLASS}`}>{hint}</p>
        <ul className="space-y-2 text-sm">
          {rows.map((o) => renderOrderCard(o, { allowCheckIn }))}
          {rows.length === 0 ? (
            <li className="text-slate-500">{t("empty")}</li>
          ) : null}
        </ul>
      </div>
    );
  }

  function resetFilters() {
    const today = todayBakuYmd();
    const defaultMine = auth?.role === "NURSE" && !auth?.isPlatformSuperAdmin;
    setDate(today);
    setStatus("ALL");
    setPatient("");
    setProcedure("");
    setOverdueOnly(false);
    setMineOn(defaultMine);
    setDemoPractitionerId("");
    setMineUnlinked(false);
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {msg ? (
        <p
          className={`mb-3 text-sm ${msgTone === "err" ? TEXT_DANGER_CLASS : TEXT_SUCCESS_CLASS}`}
        >
          {msg}
        </p>
      ) : null}

      {isDemoStaffFilter ? (
        <div className="mb-4 rounded-xl border-2 border-amber-500 bg-amber-50 p-3">
          <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-amber-950">
            {t("demoStaffFilterTitle")}
          </p>
          <p className="mb-2 text-[12px] font-semibold text-amber-900">
            {t("demoStaffFilterHint")}
          </p>
          <FieldSelect
            label={t("demoStaffFilterLabel")}
            preset="select"
            value={demoPractitionerId}
            onChange={(e) => {
              const next = e.target.value;
              setDemoPractitionerId(next);
              if (next) {
                setMineOn(false);
              }
            }}
            className="font-bold"
            selectClassName="font-bold"
          >
            <option value="">{t("demoStaffFilterAll")}</option>
            {demoStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} ({s.code})
              </option>
            ))}
          </FieldSelect>
        </div>
      ) : null}

      <EraListFilterBar
        resetLabel={t("resetFilters")}
        onReset={resetFilters}
        actionsExtra={
          <>
            <label className="inline-flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
              />
              {t("filterOverdueOnly")}
            </label>
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
              {loading
                ? tc("loading")
                : t("resultCount", { count: orders.length })}
            </span>
          </>
        }
      >
        <Field
          label={t("filterDate")}
          preset="shortText"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <FieldSelect
          label={t("filterStatusLabel")}
          preset="select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t(`filterStatus.${s}` as "filterStatus.ACTIVE")}
            </option>
          ))}
        </FieldSelect>
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
          list="nurse-procedure-options"
        />
        <datalist id="nurse-procedure-options">
          {procedureOptions.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </datalist>
      </EraListFilterBar>
      {mineUnlinked ? (
        <p className="mb-3 text-[12px] text-amber-800">{t("mineUnlinked")}</p>
      ) : null}
      <p className={`mb-4 text-[12px] ${TEXT_MUTED_CLASS}`}>{t("lifecycleHint")}</p>

      {checkInRequiresQr ? (
        <div className={`${CARD_CONTAINER_CLASS} mb-4 space-y-3 p-4`}>
          <h2 className="text-sm font-semibold">{t("qrScanTitle")}</h2>
          <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{t("qrHint")}</p>
          <div className="flex flex-wrap gap-2">
            <input
              className={`${FORM_INPUT_CLASS} min-w-[16rem] flex-1`}
              placeholder={t("qrTokenPlaceholder")}
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => void scanQr()}
            >
              {t("qrScan")}
            </button>
          </div>
          {qrPatient ? (
            <p className="text-sm">
              {t("qrPatient")}:{" "}
              {qrPatientRefId ? (
                <Link
                  href={`/patients/${qrPatientRefId}`}
                  className={LINK_ACCENT_CLASS}
                >
                  {qrPatient}
                </Link>
              ) : (
                qrPatient
              )}
            </p>
          ) : null}
          {qrOrders.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {qrOrders.map((o) => renderOrderCard(o, { allowCheckIn: true }))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className={`mb-3 text-[12px] ${TEXT_SUCCESS_CLASS}`}>{t("manualModeHint")}</p>
      )}

      <div className={`${CARD_CONTAINER_CLASS} mb-4 p-4`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t("agendaTitle")}</h2>
          <span className="rounded-md bg-[#2980B9]/10 px-2 py-1 text-[12px] font-semibold text-[#2980B9]">
            {dayProgress.label}
          </span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[#EBEDF0]">
          <div
            className={`h-full ${dayProgress.closed ? "bg-slate-400" : "bg-[#2980B9]"}`}
            style={{ width: `${dayProgress.pct}%` }}
          />
        </div>
        <p className={`mb-3 text-[12px] ${TEXT_MUTED_CLASS}`}>{t("agendaHint")}</p>
        <ol className="relative space-y-2 border-l-2 border-[#D5DADF] pl-4">
          {agenda.map((o) => {
            const open = isCheckInOpen(o);
            const isNow = o.status === "CHECKED_IN";
            const isPast = o.status === "SCHEDULED" && !open;
            return (
              <li key={`agenda-${o.id}`} className="relative">
                <span
                  className={`absolute -left-[1.35rem] top-2 h-2.5 w-2.5 rounded-full ${
                    isNow
                      ? "bg-emerald-500"
                      : isPast
                        ? "bg-amber-500"
                        : "bg-[#2980B9]"
                  }`}
                />
                {renderOrderCard(o, { allowCheckIn: true })}
              </li>
            );
          })}
          {agenda.length === 0 ? (
            <li className="text-slate-500">{t("empty")}</li>
          ) : null}
        </ol>
      </div>

      <div className="mb-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Column
          title={t("queueOverdue")}
          hint={t("queueOverdueHint")}
          rows={buckets.overdue}
          allowCheckIn
          tone="border-amber-300 bg-amber-50/60"
        />
        <Column
          title={t("queueUpcoming")}
          hint={t("queueUpcomingHint")}
          rows={buckets.upcoming}
          allowCheckIn
        />
        <Column
          title={t("queueInProgress")}
          hint={t("queueInProgressHint")}
          rows={buckets.inProgress}
          tone="border-emerald-300 bg-emerald-50/50"
        />
        <Column
          title={t("queueCompleted")}
          hint={t("queueCompletedHint")}
          rows={buckets.completed}
        />
      </div>
    </>
  );
}
