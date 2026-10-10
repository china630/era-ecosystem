"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Maximize2, Minimize2, X } from "lucide-react";
import {
  APP_SHELL_CLASS,
  CARD_CONTAINER_CLASS,
  DatePicker,
  EraListFilterBar,
  FIELD_SECTION_CLASS,
  Field,
  FieldSelect,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SUBSECTION_SURFACE_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import {
  ResourceDayMatrix,
  cabinLabel,
  type Slot,
  type ResourceRow,
  type TimeHorizon,
} from "@/components/sanatorium/ResourceDayMatrix";
import { bakuDateTimeDisplay, bakuTimeLabel, todayBakuYmd } from "@/lib/baku-day";
import Link from "next/link";

function bakuYmd(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

type OrderCard = {
  id: string;
  patientName: string;
  patientRefId: string;
  patientRefCode: string;
  roomNumber: string | null;
  procedureName: string;
  procedureCode: string;
  status: string;
  scheduledAt: string;
  endsAt: string | null;
  durationMinutes: number;
  cabinName: string | null;
  cabinCode: string | null;
  staffName: string | null;
  inPackage: boolean;
  amountNet: number;
  quotaIndex: number | null;
  quotaTotal: number | null;
};

function addCivilDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function chipLabel(ymd: string, today: string): string {
  const [y, m, d] = ymd.split("-");
  const short = `${d}.${m}`;
  if (ymd === today) return short;
  if (ymd === addCivilDays(today, 1)) return short;
  return `${short}.${y}`;
}

export default function SanatoriumResourcesPage() {
  const t = useTranslations("sanatoriumResources");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [date, setDate] = useState(() => bakuYmd());
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [resourceFilter, setResourceFilter] = useState("");
  const [patientFilter, setPatientFilter] = useState("");
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>("full");
  const [dragOrderId, setDragOrderId] = useState<string | null>(null);
  const [placing, setPlacing] = useState<{
    id: string;
    patientName?: string;
    procedureName?: string;
  } | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [detailSlot, setDetailSlot] = useState<Slot | null>(null);
  const [orderCard, setOrderCard] = useState<OrderCard | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/sanatorium/resources/calendar?date=${encodeURIComponent(date)}&locale=${encodeURIComponent(locale)}`,
    );
    const data = await res.json();
    const payload = data.data ?? data;
    setResources(payload.resources ?? []);
  }, [date, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!detailSlot?.procedureOrderId) {
      setOrderCard(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/procedures/${detailSlot.procedureOrderId}`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (cancelled || !raw) return;
        setOrderCard((raw.data ?? raw) as OrderCard);
      })
      .catch(() => {
        if (!cancelled) setOrderCard(null);
      });
    return () => {
      cancelled = true;
    };
  }, [detailSlot?.procedureOrderId]);

  useEffect(() => {
    if (!placing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlacing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placing]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !placing) setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen, placing]);

  async function dropOnSlot(resourceId: string, slotTime: string) {
    if (!dragOrderId) return;
    const scheduledAt = new Date(slotTime).toISOString();
    const res = await fetch(`/api/procedures/${dragOrderId}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt, resourceId }),
    });
    const data = await res.json();
    setDragOrderId(null);
    if (!res.ok) {
      showApiError(data, t("moveFailed"));
      return;
    }
    showSuccess(t("moved"));
    await load();
  }

  function beginPlace(slot: Slot) {
    if (!slot.procedureOrderId) return;
    setDetailSlot(null);
    setPlacing({
      id: slot.procedureOrderId,
      patientName: slot.patientName,
      procedureName: slot.procedureName ?? slot.procedureCode,
    });
  }

  async function confirmMove(startsAt: string, resourceId: string) {
    if (!placing) return;
    const res = await fetch(`/api/procedures/${placing.id}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: startsAt, resourceId }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, t("moveFailed"));
      return;
    }
    setPlacing(null);
    showSuccess(t("moved"));
    await load();
  }

  async function confirmCancel() {
    if (!cancelId) return;
    const res = await fetch(`/api/procedures/${cancelId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "reception_matrix" }),
    });
    const data = await res.json();
    setCancelId(null);
    if (!res.ok) {
      showApiError(data, t("cancelFailed"));
      return;
    }
    showSuccess(t("cancelled"));
    await load();
  }

  const filters = (
    <EraListFilterBar
      actionsExtra={
        <div className="flex flex-wrap gap-2">
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
            {t("refresh")}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => setFullscreen((v) => !v)}
          >
            {fullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                {t("exitFullscreen")}
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                {t("enterFullscreen")}
              </>
            )}
          </button>
        </div>
      }
    >
      <DatePicker
        label={t("date")}
        value={date}
        onChange={setDate}
        placeholder={tc("datePlaceholder")}
        openCalendarLabel={tc("openCalendar")}
      />
      <Field
        label={t("filterResource")}
        preset="shortText"
        value={resourceFilter}
        onChange={(e) => setResourceFilter(e.target.value)}
      />
      <Field
        label={t("filterPatient")}
        preset="shortText"
        value={patientFilter}
        onChange={(e) => setPatientFilter(e.target.value)}
        placeholder={t("filterPatientPlaceholder")}
      />
      <FieldSelect
        label={t("filterHorizon")}
        preset="select"
        value={timeHorizon}
        onChange={(e) => setTimeHorizon(e.target.value as TimeHorizon)}
      >
        <option value="full">{t("horizonFull")}</option>
        <option value="rest">{t("horizonRest")}</option>
        <option value="+1h">{t("horizon1h")}</option>
        <option value="+3h">{t("horizon3h")}</option>
      </FieldSelect>
    </EraListFilterBar>
  );

  const matrix = (
    <ResourceDayMatrix
      date={date}
      resources={resources}
      resourceFilter={resourceFilter}
      patientFilter={patientFilter}
      timeHorizon={timeHorizon}
      labels={{
        free: t("free"),
        empty: t("empty"),
        move: t("move"),
        cancel: t("cancel"),
        staff: t("staff"),
        now: t("now"),
        dragHint: t("dragHint"),
        legendFree: t("legendFree"),
        legendScheduled: t("legendScheduled"),
        legendCompleted: t("legendCompleted"),
        legendBlocked: t("legendBlocked"),
        legendLunch: t("legendLunch"),
      }}
      onDragStart={setDragOrderId}
      onDropFree={(resourceId, slotTimeIso) => {
        if (placing) {
          void confirmMove(slotTimeIso, resourceId);
          return;
        }
        void dropOnSlot(resourceId, slotTimeIso);
      }}
      onFreeClick={
        placing
          ? (resourceId, slotTimeIso) => {
              void confirmMove(slotTimeIso, resourceId);
            }
          : undefined
      }
      onMove={(slot) => beginPlace(slot)}
      onCancel={(orderId) => setCancelId(orderId)}
      onSelect={(slot) => {
        if (placing) return;
        setDetailSlot(slot);
      }}
    />
  );

  const today = todayBakuYmd();
  const placeDays = Array.from({ length: 7 }, (_, i) => addCivilDays(today, i));
  const placingBar = placing ? (
    <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[13px] font-medium">
          {t("placingHint", {
            patient: placing.patientName ?? "—",
            procedure: placing.procedureName ?? "—",
          })}
        </p>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setPlacing(null)}>
          {t("placingCancel")}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {placeDays.map((ymd) => (
          <button
            key={ymd}
            type="button"
            className={ymd === date ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => setDate(ymd)}
          >
            {ymd === today
              ? t("chipToday")
              : ymd === addCivilDays(today, 1)
                ? t("chipTomorrow")
                : chipLabel(ymd, today)}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  const closedHint =
    resources.length > 0 && resources.every((r) => (r.slots?.length ?? 0) === 0) ? (
      <p className={`mb-3 text-sm ${SUBSECTION_SURFACE_CLASS}`}>{t("closedDayHint")}</p>
    ) : null;

  return (
    <>
      {!fullscreen ? (
        <>
          <PageHeader title={t("title")} subtitle={t("subtitle")} />
          {closedHint}
          {placingBar}
          {filters}
          <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>{matrix}</div>
        </>
      ) : (
        <div
          className={`fixed inset-0 z-[180] flex flex-col ${APP_SHELL_CLASS}`}
          role="dialog"
          aria-modal="true"
          aria-label={t("fullscreenTitle")}
        >
          <div
            className={`flex shrink-0 items-center justify-between gap-3 rounded-none border-x-0 border-t-0 bg-white px-4 py-3 sm:px-6 ${FIELD_SECTION_CLASS}`}
          >
            <div className="min-w-0">
              <h2 className="m-0 truncate text-lg font-semibold">{t("fullscreenTitle")}</h2>
              <p className={`m-0 truncate text-[13px] ${TEXT_MUTED_CLASS}`}>{date}</p>
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
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3 sm:px-6">
            {closedHint}
            {placingBar}
            {filters}
            <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>{matrix}</div>
          </div>
        </div>
      )}

      <ModalShell
        open={Boolean(detailSlot)}
        title={orderCard?.patientName ?? detailSlot?.patientName ?? t("detailsTitle")}
        onClose={() => setDetailSlot(null)}
        closeLabel={tc("close")}
        footer={
          detailSlot ? (
            <div className="flex flex-wrap justify-end gap-2">
              {orderCard ? (
                <Link href={`/patients/${orderCard.patientRefId}`} className={SECONDARY_BUTTON_CLASS}>
                  {t("openPatient")}
                </Link>
              ) : null}
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => beginPlace(detailSlot)}
              >
                {t("move")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => {
                  if (!detailSlot.procedureOrderId) return;
                  setCancelId(detailSlot.procedureOrderId);
                  setDetailSlot(null);
                }}
              >
                {t("cancel")}
              </button>
            </div>
          ) : null
        }
      >
        {detailSlot ? (
          <ProcedureCardBody
            card={orderCard}
            slot={detailSlot}
            statusLabel={(status) => procedureStatusLabel(t, status)}
            labels={{
              room: t("detailRoom"),
              procedure: t("detailProcedure"),
              time: t("detailTime"),
              cabin: t("detailCabin"),
              staff: t("staff"),
              staffMissing: t("staffMissing"),
              status: t("detailStatus"),
              package: t("detailPackage"),
              paid: t("detailPaid"),
              quota: t("detailQuota"),
              minutes: t("minutesShort"),
            }}
          />
        ) : null}
      </ModalShell>

      <ModalShell open={Boolean(cancelId)} title={t("cancel")} onClose={() => setCancelId(null)}>
        <p className="text-[13px]">{t("cancelConfirm")}</p>
        <ModalFooter
          onCancel={() => setCancelId(null)}
          onSubmit={() => void confirmCancel()}
          submitLabel={t("cancel")}
        />
      </ModalShell>
    </>
  );
}

function procedureStatusLabel(
  t: {
    (key: "orderStatus.SCHEDULED"): string;
    (key: "orderStatus.CHECKED_IN"): string;
    (key: "orderStatus.COMPLETED"): string;
    (key: "orderStatus.CANCELLED"): string;
    (key: "orderStatus.NO_SHOW"): string;
    (key: "orderStatus.PROPOSED"): string;
    (key: "orderStatus.PENDING_PAY"): string;
  },
  status: string | null | undefined,
): string {
  switch (status) {
    case "SCHEDULED":
      return t("orderStatus.SCHEDULED");
    case "CHECKED_IN":
      return t("orderStatus.CHECKED_IN");
    case "COMPLETED":
      return t("orderStatus.COMPLETED");
    case "CANCELLED":
      return t("orderStatus.CANCELLED");
    case "NO_SHOW":
      return t("orderStatus.NO_SHOW");
    case "PROPOSED":
      return t("orderStatus.PROPOSED");
    case "PENDING_PAY":
      return t("orderStatus.PENDING_PAY");
    default:
      return status?.trim() || "—";
  }
}

function ProcedureCardBody({
  card,
  slot,
  statusLabel,
  labels,
}: {
  card: OrderCard | null;
  slot: Slot;
  statusLabel: (status: string | null | undefined) => string;
  labels: {
    room: string;
    procedure: string;
    time: string;
    cabin: string;
    staff: string;
    staffMissing: string;
    status: string;
    package: string;
    paid: string;
    quota: string;
    minutes: string;
  };
}) {
  const name = card?.procedureName ?? slot.procedureName ?? slot.procedureCode ?? "—";
  const code = card?.procedureCode ?? slot.procedureCode;
  const when = card?.scheduledAt ?? slot.time;
  const ends = card?.endsAt ?? slot.endsAt;
  const duration = card?.durationMinutes ?? slot.durationMinutes;
  const cabin = cabinLabel(
    card?.cabinName ?? slot.resourceName,
    card?.cabinCode ?? slot.resourceCode,
  );
  const staff = card?.staffName ?? slot.staffName;
  const status = card?.status ?? slot.status;
  return (
    <div className="space-y-3 text-[13px]">
      <div>
        <p className="m-0 text-base font-semibold">{name}</p>
        {code ? <p className={`m-0 ${TEXT_MUTED_CLASS}`}>{code}</p> : null}
      </div>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2">
        <dt className={TEXT_MUTED_CLASS}>{labels.room}</dt>
        <dd>{card?.roomNumber ?? "—"}</dd>
        <dt className={TEXT_MUTED_CLASS}>{labels.time}</dt>
        <dd>
          {bakuDateTimeDisplay(when)}
          {ends ? ` – ${bakuTimeLabel(ends)}` : ""}
          {duration ? ` · ${duration} ${labels.minutes}` : ""}
        </dd>
        <dt className={TEXT_MUTED_CLASS}>{labels.cabin}</dt>
        <dd>{cabin}</dd>
        <dt className={TEXT_MUTED_CLASS}>{labels.staff}</dt>
        <dd>{staff?.trim() ? staff : labels.staffMissing}</dd>
        <dt className={TEXT_MUTED_CLASS}>{labels.status}</dt>
        <dd className="font-medium">{statusLabel(status)}</dd>
        {card ? (
          <>
            <dt className={TEXT_MUTED_CLASS}>{card.inPackage ? labels.package : labels.paid}</dt>
            <dd>
              {card.inPackage
                ? labels.package
                : `${Number.isFinite(card.amountNet) ? card.amountNet.toFixed(2) : "0.00"} AZN`}
            </dd>
          </>
        ) : null}
        {card?.quotaIndex && card.quotaTotal ? (
          <>
            <dt className={TEXT_MUTED_CLASS}>{labels.quota}</dt>
            <dd>
              {card.quotaIndex} / {card.quotaTotal}
            </dd>
          </>
        ) : null}
      </dl>
      {card ? (
        <p className={`m-0 ${TEXT_MUTED_CLASS}`}>
          {card.patientRefCode}
          {card.roomNumber ? ` · ${card.roomNumber}` : ""}
        </p>
      ) : null}
    </div>
  );
}
