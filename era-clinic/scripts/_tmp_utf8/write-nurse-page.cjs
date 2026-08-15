const fs = require("fs");
const path = require("path");

const page = `"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  EraListFilterBar,
  Field,
  FieldSelect,
  MODAL_CHECKBOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";
import { useClinicAuth } from "@/hooks/useClinicAuth";

type Proc = {
  id: string;
  procedureName: string;
  procedureCode: string;
  scheduledAt: string;
  endsAt?: string | null;
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
  CHECKED_IN: "bg-emerald-500/10 text-emerald-700",
  COMPLETED: "bg-slate-500/10 text-slate-700",
  NO_SHOW: "bg-amber-500/10 text-amber-800",
  CANCELLED: "bg-red-500/10 text-red-700",
};

export default function NursePage() {
  const t = useTranslations("nurse");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { auth } = useClinicAuth();
  const checkInRequiresQr = auth?.checkInRequiresQr !== false;

  const [orders, setOrders] = useState<Proc[]>([]);
  const [mineOn, setMineOn] = useState(false);
  const [mineUnlinked, setMineUnlinked] = useState(false);
  const [mineDefaultApplied, setMineDefaultApplied] = useState(false);
  const [date, setDate] = useState(todayBakuYmd);
  const [status, setStatus] = useState<string>("ALL");
  const [patient, setPatient] = useState("");
  const [procedure, setProcedure] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [draftDate, setDraftDate] = useState(todayBakuYmd);
  const [draftStatus, setDraftStatus] = useState<string>("ALL");
  const [draftPatient, setDraftPatient] = useState("");
  const [draftProcedure, setDraftProcedure] = useState("");
  const [draftOverdueOnly, setDraftOverdueOnly] = useState(false);
  const [draftMineOn, setDraftMineOn] = useState(false);
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
    if (auth.role === "NURSE") {
      setMineOn(true);
      setDraftMineOn(true);
    }
    setMineDefaultApplied(true);
  }, [auth?.role, mineDefaultApplied]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ date, locale, status });
    if (patient.trim()) params.set("patient", patient.trim());
    if (procedure.trim()) params.set("procedure", procedure.trim());
    if (overdueOnly) params.set("overdueOnly", "1");
    if (mineOn) params.set("mine", "1");

    const res = await fetch(\`/api/procedures?\${params}\`);
    const d = await res.json();
    const payload = d.data ?? d;
    const rows = (Array.isArray(payload) ? payload : (payload.orders ?? [])) as Proc[];
    setOrders(rows);
    setMineUnlinked(payload?.mineUnlinked === true);
    setLoading(false);
  }, [date, status, patient, procedure, overdueOnly, mineOn, locale]);

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
      return t(\`status.\${s}\` as "status.SCHEDULED");
    }
    return s;
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
    const res = await fetch(\`/api/procedures/\${id}/check-in\`, {
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

  async function markNoShow(id: string) {
    const res = await fetch(\`/api/procedures/\${id}/no-show\`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      show(data.error ?? t("noShowFailed"), "err");
      return;
    }
    show(t("noShowOk"));
    await load();
    if (qrToken.trim()) await scanQr();
  }

  const buckets = useMemo(() => {
    const now = nowTick;
    const overdue: Proc[] = [];
    const upcoming: Proc[] = [];
    const inProgress: Proc[] = [];
    const completed: Proc[] = [];
    const noShow: Proc[] = [];
    for (const o of orders) {
      if (o.status === "CHECKED_IN") {
        inProgress.push(o);
        continue;
      }
      if (o.status === "COMPLETED") {
        completed.push(o);
        continue;
      }
      if (o.status === "NO_SHOW") {
        noShow.push(o);
        continue;
      }
      if (o.status === "SCHEDULED") {
        if (new Date(o.scheduledAt).getTime() < now) overdue.push(o);
        else upcoming.push(o);
      }
    }
    return { overdue, upcoming, inProgress, completed, noShow };
  }, [orders, nowTick]);

  const agenda = useMemo(() => {
    return [...orders]
      .filter((o) =>
        ["SCHEDULED", "CHECKED_IN", "COMPLETED", "NO_SHOW"].includes(o.status),
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
  }, [orders]);

  function renderOrderCard(
    o: Proc,
    opts?: { allowCheckIn?: boolean; allowNoShow?: boolean },
  ) {
    const chip = STATUS_CHIP[o.status] ?? "bg-slate-100 text-slate-700";
    const canCheckIn = opts?.allowCheckIn && o.status === "SCHEDULED";
    const canNoShow = opts?.allowNoShow && o.status === "SCHEDULED";
    const checkInDisabled = checkInRequiresQr && !activeQrToken;
    return (
      <li
        key={o.id}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D5DADF]/80 bg-[#FAFBFC] p-3"
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={\`/patients/\${o.patientRef.id}\`}
              className="font-semibold text-[#2980B9] hover:underline"
            >
              {o.patientRef.fullName}
            </Link>
            <span className={\`rounded-lg px-2 py-0.5 text-[11px] font-semibold \${chip}\`}>
              {statusLabel(o.status)}
            </span>
          </div>
          <p className="text-[13px] text-[#34495E]">
            <span className="font-medium">{o.procedureName}</span>
            <span className="text-[#7F8C8D]"> · {o.procedureCode}</span>
            <span className="text-[#7F8C8D]">
              {" "}
              · {fmtTime(o.scheduledAt)}
              {o.endsAt ? \`–\${fmtTime(o.endsAt)}\` : ""}
            </span>
            {o.resource ? (
              <span className="text-[#7F8C8D]">
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
              disabled={checkInDisabled}
              title={checkInDisabled ? t("qrRequiredFirst") : undefined}
            >
              {t("checkIn")}
            </button>
          ) : null}
          {canNoShow ? (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => void markNoShow(o.id)}
            >
              {t("noShow")}
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
    allowNoShow,
    tone,
  }: {
    title: string;
    hint: string;
    rows: Proc[];
    allowCheckIn?: boolean;
    allowNoShow?: boolean;
    tone?: string;
  }) {
    return (
      <div
        className={\`\${CARD_CONTAINER_CLASS} flex min-h-[12rem] flex-col p-3 \${tone ?? ""}\`}
      >
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mb-2 text-[11px] text-[#7F8C8D]">{hint}</p>
        <ul className="space-y-2 text-sm">
          {rows.map((o) => renderOrderCard(o, { allowCheckIn, allowNoShow }))}
          {rows.length === 0 ? (
            <li className="text-slate-500">{t("empty")}</li>
          ) : null}
        </ul>
      </div>
    );
  }

  function applyFilters() {
    setDate(draftDate);
    setStatus(draftStatus);
    setPatient(draftPatient);
    setProcedure(draftProcedure);
    setOverdueOnly(draftOverdueOnly);
    setMineOn(draftMineOn);
  }

  function resetFilters() {
    const today = todayBakuYmd();
    const defaultMine = auth?.role === "NURSE";
    setDraftDate(today);
    setDraftStatus("ALL");
    setDraftPatient("");
    setDraftProcedure("");
    setDraftOverdueOnly(false);
    setDraftMineOn(defaultMine);
    setDate(today);
    setStatus("ALL");
    setPatient("");
    setProcedure("");
    setOverdueOnly(false);
    setMineOn(defaultMine);
    setMineUnlinked(false);
  }

  const nowLabel = new Date(nowTick).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {msg ? (
        <p
          className={\`mb-3 text-sm \${msgTone === "err" ? "text-red-700" : "text-emerald-700"}\`}
        >
          {msg}
        </p>
      ) : null}

      <EraListFilterBar
        applyLabel={t("applyFilters")}
        resetLabel={t("resetFilters")}
        onApply={applyFilters}
        onReset={resetFilters}
        actionsExtra={
          <>
            <label className="inline-flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                checked={draftOverdueOnly}
                onChange={(e) => setDraftOverdueOnly(e.target.checked)}
              />
              {t("filterOverdueOnly")}
            </label>
            <div className="inline-flex overflow-hidden rounded-lg border border-[#D5DADF] text-[12px]">
              <button
                type="button"
                className={\`px-3 py-1.5 \${draftMineOn ? "bg-[#2980B9] text-white" : "bg-white text-[#34495E]"}\`}
                onClick={() => setDraftMineOn(true)}
              >
                {t("filterMine")}
              </button>
              <button
                type="button"
                className={\`px-3 py-1.5 \${!draftMineOn ? "bg-[#2980B9] text-white" : "bg-white text-[#34495E]"}\`}
                onClick={() => setDraftMineOn(false)}
              >
                {t("filterAll")}
              </button>
            </div>
            <span className="text-[12px] text-[#7F8C8D]">
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
          value={draftDate}
          onChange={(e) => setDraftDate(e.target.value)}
        />
        <FieldSelect
          label={t("filterStatusLabel")}
          preset="select"
          value={draftStatus}
          onChange={(e) => setDraftStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t(\`filterStatus.\${s}\` as "filterStatus.ACTIVE")}
            </option>
          ))}
        </FieldSelect>
        <Field
          label={t("filterPatient")}
          preset="shortText"
          value={draftPatient}
          onChange={(e) => setDraftPatient(e.target.value)}
          placeholder={t("filterPatientPlaceholder")}
        />
        <Field
          label={t("filterProcedure")}
          preset="shortText"
          value={draftProcedure}
          onChange={(e) => setDraftProcedure(e.target.value)}
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
      <p className="mb-4 text-[12px] text-[#7F8C8D]">{t("lifecycleHint")}</p>

      {checkInRequiresQr ? (
        <div className={\`\${CARD_CONTAINER_CLASS} mb-4 space-y-3 p-4\`}>
          <h2 className="text-sm font-semibold">{t("qrScanTitle")}</h2>
          <p className="text-[12px] text-[#7F8C8D]">{t("qrHint")}</p>
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-[16rem] flex-1 rounded-lg border border-[#D5DADF] px-3 py-2 text-sm"
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
                  href={\`/patients/\${qrPatientRefId}\`}
                  className="text-[#2980B9] hover:underline"
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
              {qrOrders.map((o) =>
                renderOrderCard(o, { allowCheckIn: true, allowNoShow: true }),
              )}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="mb-3 text-[12px] text-emerald-800">{t("manualModeHint")}</p>
      )}

      <div className={\`\${CARD_CONTAINER_CLASS} mb-4 p-4\`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t("agendaTitle")}</h2>
          <span className="rounded-md bg-[#2980B9]/10 px-2 py-1 text-[12px] font-semibold text-[#2980B9]">
            {t("nowMarker", { time: nowLabel })}
          </span>
        </div>
        <p className="mb-3 text-[12px] text-[#7F8C8D]">{t("agendaHint")}</p>
        <ol className="relative space-y-2 border-l-2 border-[#D5DADF] pl-4">
          {agenda.map((o) => {
            const start = new Date(o.scheduledAt).getTime();
            const isPast = start < nowTick && o.status === "SCHEDULED";
            const isNow =
              o.status === "CHECKED_IN" ||
              (start <= nowTick &&
                !!o.endsAt &&
                new Date(o.endsAt).getTime() >= nowTick);
            return (
              <li key={\`agenda-\${o.id}\`} className="relative">
                <span
                  className={\`absolute -left-[1.35rem] top-2 h-2.5 w-2.5 rounded-full \${
                    isNow
                      ? "bg-emerald-500"
                      : isPast
                        ? "bg-amber-500"
                        : "bg-[#2980B9]"
                  }\`}
                />
                {renderOrderCard(o, {
                  allowCheckIn: true,
                  allowNoShow: o.status === "SCHEDULED",
                })}
              </li>
            );
          })}
          {agenda.length === 0 ? (
            <li className="text-slate-500">{t("empty")}</li>
          ) : null}
        </ol>
      </div>

      <div className="mb-2 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Column
          title={t("queueOverdue")}
          hint={t("queueOverdueHint")}
          rows={buckets.overdue}
          allowCheckIn
          allowNoShow
          tone="border-amber-300 bg-amber-50/60"
        />
        <Column
          title={t("queueUpcoming")}
          hint={t("queueUpcomingHint")}
          rows={buckets.upcoming}
          allowCheckIn
          allowNoShow
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
        <Column
          title={t("queueNoShow")}
          hint={t("queueNoShowHint")}
          rows={buckets.noShow}
          tone="border-amber-200"
        />
      </div>
    </>
  );
}
`;

const out = path.join("era-clinic", "app", "nurse", "page.tsx");
fs.writeFileSync(out, page, "utf8");
const b = fs.readFileSync(out);
console.log(b[1] === 0 ? "BAD utf16" : "utf8 ok", out, "bytes", b.length);
