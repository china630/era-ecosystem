"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FieldSelect,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";
import AppointmentCreateModal, {
  type AppointmentCreatePrefill,
} from "@/components/AppointmentCreateModal";
import {
  ResourceDayMatrix,
  type ResourceRow,
  type Slot,
  type TimeHorizon,
} from "@/components/sanatorium/ResourceDayMatrix";

function bakuYmd(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

type DetailState = {
  appointmentId: string;
  patientName?: string;
  patientRefCode?: string;
  status?: string;
  visitId?: string | null;
  scheduledAt?: string;
};

export default function AppointmentsPage() {
  const t = useTranslations("appointments");
  const tc = useTranslations("common");
  const [date, setDate] = useState(() => bakuYmd());
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [practitionerFilter, setPractitionerFilter] = useState("");
  const debouncedPractitionerFilter = useDebouncedValue(practitionerFilter, 300);
  const [patientFilter, setPatientFilter] = useState("");
  const debouncedPatientFilter = useDebouncedValue(patientFilter, 300);
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>("full");
  const [dragId, setDragId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgErr, setMsgErr] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [prefill, setPrefill] = useState<AppointmentCreatePrefill | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/appointments/calendar?date=${encodeURIComponent(date)}`,
      );
      const data = await res.json();
      const payload = data.data ?? data;
      setResources(payload.resources ?? []);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  function flash(text: string, err = false) {
    setMsg(text);
    setMsgErr(err);
  }

  const codeByPractitionerId = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of resources) m.set(r.resourceId, r.code);
    return m;
  }, [resources]);

  async function dropOnSlot(practitionerId: string, slotTime: string) {
    if (!dragId) return;
    const scheduledAt = new Date(slotTime).toISOString();
    const res = await fetch(`/api/appointments/${dragId}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt, practitionerId }),
    });
    const data = await res.json();
    setDragId(null);
    if (!res.ok) {
      flash(data.error ?? t("rescheduleFailed"), true);
      return;
    }
    flash(t("rescheduled"));
    await load();
  }

  function openCreate(practitionerId: string, slotTime: string) {
    setPrefill({
      practitionerCode: codeByPractitionerId.get(practitionerId),
      scheduledAtIso: slotTime,
    });
    setCreateOpen(true);
  }

  function openDetail(slot: Slot) {
    if (!slot.procedureOrderId) return;
    setDetail({
      appointmentId: slot.procedureOrderId,
      patientName: slot.patientName,
      patientRefCode: slot.patientRefCode,
      status: slot.status,
      visitId: slot.visitId ?? null,
      scheduledAt: slot.time,
    });
  }

  async function checkIn() {
    if (!detail) return;
    const res = await fetch(`/api/appointments/${detail.appointmentId}/check-in`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json();
      flash(data.error ?? tc("failed"), true);
      return;
    }
    const data = await res.json();
    const visitId = (data.data ?? data)?.visit?.id ?? detail.visitId;
    setDetail({ ...detail, status: "CHECKED_IN", visitId });
    flash(t("checkedIn"));
    await load();
  }

  async function confirmCancel() {
    if (!detail) return;
    const res = await fetch(`/api/appointments/${detail.appointmentId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
    });
    if (!res.ok) {
      const data = await res.json();
      flash(data.error ?? tc("failed"), true);
      return;
    }
    setCancelOpen(false);
    setCancelReason("");
    setDetail(null);
    flash(t("cancelled"));
    await load();
  }

  const matrixLabels = {
    free: t("matrixFree"),
    empty: t("matrixEmpty"),
    move: t("matrixMove"),
    cancel: t("cancelVisit"),
    staff: t("practitioner"),
    now: t("matrixNow"),
    dragHint: t("dragHint"),
    legendFree: t("legendFree"),
    legendScheduled: t("legendScheduled"),
    legendCompleted: t("legendCompleted"),
    legendBlocked: t("legendBlocked"),
    legendLunch: t("legendLunch"),
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              setPrefill(null);
              setCreateOpen(true);
            }}
          >
            {t("createTitle")}
          </button>
        }
      />

      <EraListFilterBar
        resetLabel={tc("filterReset")}
        onReset={() => {
          setPractitionerFilter("");
          setPatientFilter("");
          setTimeHorizon("full");
          setDate(bakuYmd());
        }}
      >
        <DatePicker
          label={t("date")}
          value={date}
          onChange={setDate}
          placeholder={tc("datePlaceholder")}
          openCalendarLabel={tc("openCalendar")}
        />
        <Field
          label={t("filterPractitioner")}
          preset="shortText"
          value={practitionerFilter}
          onChange={(e) => setPractitionerFilter(e.target.value)}
        />
        <Field
          label={t("filterPatient")}
          preset="shortText"
          value={patientFilter}
          onChange={(e) => setPatientFilter(e.target.value)}
        />
        <FieldSelect
          label={t("horizon")}
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

      {msg && (
        <p className={`mb-2 text-sm ${msgErr ? TEXT_DANGER_CLASS : TEXT_MUTED_CLASS}`}>{msg}</p>
      )}

      <div className={`${CARD_CONTAINER_CLASS} p-3`}>
        {loading ? (
          <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>
        ) : (
          <ResourceDayMatrix
            date={date}
            resources={resources}
            labels={matrixLabels}
            resourceFilter={debouncedPractitionerFilter}
            patientFilter={debouncedPatientFilter}
            timeHorizon={timeHorizon}
            slotColumnWidth="3.5rem"
            onDropFree={(id, time) => void dropOnSlot(id, time)}
            onFreeClick={(id, time) => openCreate(id, time)}
            onDragStart={setDragId}
            onSelect={openDetail}
            onMove={openDetail}
            onCancel={(id) => {
              setDetail({ appointmentId: id });
              setCancelOpen(true);
            }}
          />
        )}
      </div>

      <AppointmentCreateModal
        open={createOpen}
        prefill={prefill}
        onClose={() => {
          setCreateOpen(false);
          setPrefill(null);
        }}
        onCreated={() => void load()}
      />

      <ModalShell
        open={!!detail && !cancelOpen}
        title={t("detailTitle")}
        onClose={() => setDetail(null)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setDetail(null)}>
              {tc("cancel")}
            </button>
            {detail?.status === "SCHEDULED" && (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void checkIn()}>
                {t("checkIn")}
              </button>
            )}
            {detail?.visitId && (
              <Link href={`/visits/${detail.visitId}`} className={PRIMARY_BUTTON_CLASS}>
                {t("openVisit")}
              </Link>
            )}
            {detail?.visitId && (
              <Link
                href={`/cashier?visitId=${detail.visitId}`}
                className={SECONDARY_BUTTON_CLASS}
              >
                {t("cashier")}
              </Link>
            )}
            {detail?.status !== "CANCELLED" && (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setCancelOpen(true)}
              >
                {t("cancelVisit")}
              </button>
            )}
          </div>
        }
      >
        {detail && (
          <div className="space-y-2 text-sm">
            <p>
              <span className={TEXT_MUTED_CLASS}>{t("patientName")}: </span>
              {detail.patientName ?? "—"}
              {detail.patientRefCode ? ` (${detail.patientRefCode})` : ""}
            </p>
            <p>
              <span className={TEXT_MUTED_CLASS}>{tc("status")}: </span>
              {detail.status ?? "—"}
            </p>
            {detail.scheduledAt && (
              <p>
                <span className={TEXT_MUTED_CLASS}>{t("scheduledAt")}: </span>
                {new Date(detail.scheduledAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </ModalShell>

      <ModalShell open={cancelOpen} title={t("cancelTitle")} onClose={() => setCancelOpen(false)}>
        <Field
          label={t("cancelReason")}
          preset="longText"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
        <ModalFooter
          onCancel={() => setCancelOpen(false)}
          onSubmit={() => void confirmCancel()}
          submitLabel={t("cancelConfirm")}
        />
      </ModalShell>
    </>
  );
}
