"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Maximize2, Minimize2, X } from "lucide-react";
import {
  APP_SHELL_CLASS,
  CARD_CONTAINER_CLASS,
  CatalogField,
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
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
  MODAL_CHECKBOX_CLASS,
} from "@era/satellite-kit/ui";
import {
  ResourceDayMatrix,
  type Slot,
  type ResourceRow,
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

type AvailSlot = {
  resourceId: string;
  resourceCode?: string;
  startsAt: string;
  endsAt: string;
};

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
  const [msg, setMsg] = useState<string | null>(null);
  const [msgErr, setMsgErr] = useState(false);
  const [moveOrder, setMoveOrder] = useState<{
    id: string;
    procedureCode?: string;
    patientRefId?: string;
  } | null>(null);
  const [avail, setAvail] = useState<AvailSlot[]>([]);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [detailSlot, setDetailSlot] = useState<Slot | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [replanOpen, setReplanOpen] = useState(false);
  const [replanBusy, setReplanBusy] = useState(false);
  const [replanMode, setReplanMode] = useState<
    "FILL_HOLES" | "PACK_RESOURCE" | "APPLY_GENDER_WINDOWS" | "NUCLEAR_DAY"
  >("FILL_HOLES");
  const [replanResourceId, setReplanResourceId] = useState("");
  const [replanTypeId, setReplanTypeId] = useState("");
  const [replanRespectPins, setReplanRespectPins] = useState(true);
  const [replanReason, setReplanReason] = useState("");
  const [replanConfirm, setReplanConfirm] = useState("");
  const [replanSnapshotId, setReplanSnapshotId] = useState<string | null>(null);
  const [isPlatformSuperAdmin, setIsPlatformSuperAdmin] = useState(false);
  const [procedureTypes, setProcedureTypes] = useState<Array<{ id: string; code: string; name: string }>>(
    [],
  );
  const [replanPreview, setReplanPreview] = useState<{
    previewId: string;
    counts: { candidates: number; pinnedSkipped: number };
    sample?: Array<{
      orderId: string;
      code?: string;
      from?: string;
      resourceId?: string | null;
      status?: string;
    }>;
  } | null>(null);

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
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        const row = d.data ?? d;
        setIsPlatformSuperAdmin(Boolean(row.isPlatformSuperAdmin));
      })
      .catch(() => setIsPlatformSuperAdmin(false));
    void fetch("/api/admin/procedure-types")
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.data ?? d) as Array<{ id: string; code: string; name: string }>;
        setProcedureTypes(Array.isArray(rows) ? rows : []);
      })
      .catch(() => setProcedureTypes([]));
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  function flash(text: string, err = false) {
    setMsg(text);
    setMsgErr(err);
  }

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
      flash(data.error ?? t("moveFailed"), true);
      return;
    }
    flash(t("moved"));
    await load();
  }

  async function openMovePicker(slot: Slot) {
    if (!slot.procedureOrderId) return;
    setMoveOrder({
      id: slot.procedureOrderId,
      procedureCode: slot.procedureCode,
      patientRefId: slot.patientRefId,
    });
    const params = new URLSearchParams({ date, excludeOrderId: slot.procedureOrderId });
    if (slot.procedureCode) params.set("procedureCode", slot.procedureCode);
    if (slot.patientRefId) params.set("patientRefId", slot.patientRefId);
    const res = await fetch(`/api/sanatorium/resources/available-slots?${params}`);
    const data = await res.json();
    setAvail((data.data ?? data).slots ?? []);
  }

  async function confirmMove(startsAt: string, resourceId: string) {
    if (!moveOrder) return;
    const res = await fetch(`/api/procedures/${moveOrder.id}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: startsAt, resourceId }),
    });
    const data = await res.json();
    if (!res.ok) {
      flash(data.error ?? t("moveFailed"), true);
      return;
    }
    setMoveOrder(null);
    flash(t("moved"));
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
      flash(data.error ?? t("cancelFailed"), true);
      return;
    }
    flash(t("cancelled"));
    await load();
  }

  async function previewReplan() {
    if (replanMode === "PACK_RESOURCE" && !replanResourceId) {
      flash(t("replanNeedResource"), true);
      return;
    }
    if (replanMode === "NUCLEAR_DAY" && !isPlatformSuperAdmin) {
      flash(t("replanNuclearDenied"), true);
      return;
    }
    setReplanBusy(true);
    setReplanPreview(null);
    setReplanSnapshotId(null);
    const res = await fetch("/api/admin/procedures/replan/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        mode: replanMode,
        resourceId: replanResourceId || null,
        procedureTypeId: replanTypeId || null,
        respectPins: replanMode === "NUCLEAR_DAY" && isPlatformSuperAdmin ? replanRespectPins : true,
      }),
    });
    const data = await res.json();
    setReplanBusy(false);
    if (!res.ok) {
      flash(data.error ?? t("replanFailed"), true);
      return;
    }
    const payload = data.data ?? data;
    setReplanPreview({
      previewId: payload.previewId,
      counts: payload.counts ?? { candidates: 0, pinnedSkipped: 0 },
      sample: payload.sample ?? [],
    });
  }

  async function applyReplan() {
    if (!replanPreview) return;
    if (replanConfirm !== "REPLAN") {
      flash(t("replanConfirmHint"), true);
      return;
    }
    if (replanReason.trim().length < 3) {
      flash(t("replanNeedReason"), true);
      return;
    }
    setReplanBusy(true);
    const res = await fetch("/api/admin/procedures/replan/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        previewId: replanPreview.previewId,
        confirm: "REPLAN",
        reason: replanReason.trim(),
      }),
    });
    const data = await res.json();
    setReplanBusy(false);
    if (!res.ok) {
      flash(data.error ?? t("replanFailed"), true);
      return;
    }
    const payload = data.data ?? data;
    setReplanSnapshotId(payload.snapshotId ?? null);
    setReplanPreview(null);
    flash(t("replanApplied"));
    await load();
  }

  async function undoReplan() {
    if (!replanSnapshotId) return;
    setReplanBusy(true);
    const res = await fetch("/api/admin/procedures/replan/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshotId: replanSnapshotId }),
    });
    const data = await res.json();
    setReplanBusy(false);
    if (!res.ok) {
      flash(data.error ?? t("replanUndoFailed"), true);
      return;
    }
    setReplanSnapshotId(null);
    flash(t("replanUndone"));
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
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => {
              setReplanOpen(true);
              setReplanPreview(null);
              setReplanSnapshotId(null);
              setReplanConfirm("");
              setReplanReason("");
              setReplanMode("FILL_HOLES");
              setReplanResourceId("");
              setReplanTypeId("");
              setReplanRespectPins(true);
            }}
          >
            {t("replan")}
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
      onDropFree={(resourceId, slotTimeIso) => void dropOnSlot(resourceId, slotTimeIso)}
      onMove={(slot) => void openMovePicker(slot)}
      onCancel={(orderId) => setCancelId(orderId)}
      onSelect={(slot) => setDetailSlot(slot)}
    />
  );

  const closedHint =
    resources.length > 0 && resources.every((r) => (r.slots?.length ?? 0) === 0) ? (
      <p className={`mb-3 text-sm ${SUBSECTION_SURFACE_CLASS}`}>{t("closedDayHint")}</p>
    ) : null;

  const flashMsg = msg ? (
    <p className={`mb-3 text-sm ${msgErr ? TEXT_DANGER_CLASS : TEXT_SUCCESS_CLASS}`}>{msg}</p>
  ) : null;

  return (
    <>
      {!fullscreen ? (
        <>
          <PageHeader title={t("title")} subtitle={t("subtitle")} />
          {closedHint}
          {flashMsg}
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
            {flashMsg}
            {filters}
            <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>{matrix}</div>
          </div>
        </div>
      )}

      <ModalShell
        open={Boolean(moveOrder)}
        title={t("pickSlot")}
        onClose={() => setMoveOrder(null)}
        closeLabel="Close"
      >
        {avail.length === 0 ? (
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t("noFreeSlots")}</p>
        ) : (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto text-[13px]">
            {avail.map((s) => (
              <li key={`${s.resourceId}-${s.startsAt}`}>
                <button
                  type="button"
                  className={`${SECONDARY_BUTTON_CLASS} w-full !justify-start`}
                  onClick={() => void confirmMove(s.startsAt, s.resourceId)}
                >
                  {(s.resourceCode ? `${s.resourceCode} · ` : "") +
                    new Date(s.startsAt).toLocaleString()}
                </button>
              </li>
            ))}
          </ul>
        )}
      </ModalShell>

      <ModalShell
        open={Boolean(detailSlot)}
        title={t("detailsTitle")}
        onClose={() => setDetailSlot(null)}
        closeLabel="Close"
      >
        {detailSlot ? (
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-[13px]">
            <dt className={TEXT_MUTED_CLASS}>{t("detailPatient")}</dt>
            <dd className="font-medium">
              {detailSlot.patientName ?? "—"}
              {detailSlot.patientRefCode ? ` · ${detailSlot.patientRefCode}` : ""}
            </dd>
            <dt className={TEXT_MUTED_CLASS}>{t("detailProcedure")}</dt>
            <dd className="font-medium">
              {detailSlot.procedureName ?? detailSlot.procedureCode ?? "—"}
              {detailSlot.procedureCode ? ` (${detailSlot.procedureCode})` : ""}
            </dd>
            <dt className={TEXT_MUTED_CLASS}>{t("detailTime")}</dt>
            <dd>
              {new Date(detailSlot.time).toLocaleString()}
              {detailSlot.endsAt
                ? ` – ${new Date(detailSlot.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </dd>
            <dt className={TEXT_MUTED_CLASS}>{t("staff")}</dt>
            <dd>{detailSlot.staffName ?? "—"}</dd>
            <dt className={TEXT_MUTED_CLASS}>{t("detailStatus")}</dt>
            <dd>{detailSlot.status ?? "—"}</dd>
          </dl>
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

      <ModalShell
        open={replanOpen}
        title={t("replan")}
        onClose={() => setReplanOpen(false)}
        closeLabel="Close"
      >
        <div className="space-y-3">
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t("replanHint")}</p>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("replanMode")}
            value={replanMode}
            onChange={(v) => {
              setReplanMode(
                String(v) as
                  | "FILL_HOLES"
                  | "PACK_RESOURCE"
                  | "APPLY_GENDER_WINDOWS"
                  | "NUCLEAR_DAY",
              );
              setReplanPreview(null);
            }}
            options={[
              { value: "FILL_HOLES", label: t("replanFillHoles") },
              { value: "PACK_RESOURCE", label: t("replanPackResource") },
              { value: "APPLY_GENDER_WINDOWS", label: t("replanApplyGender") },
              ...(isPlatformSuperAdmin
                ? [{ value: "NUCLEAR_DAY", label: t("replanNuclear") }]
                : []),
            ]}
            emptyLabel={null}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("replanResource")}
            value={replanResourceId}
            onChange={(v) => {
              setReplanResourceId(String(v));
              if (v) setReplanTypeId("");
              setReplanPreview(null);
            }}
            options={resources.map((r) => ({
              value: r.resourceId,
              label: `${r.code} — ${r.name}`,
            }))}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("replanProcedureType")}
            value={replanTypeId}
            onChange={(v) => {
              setReplanTypeId(String(v));
              if (v) setReplanResourceId("");
              setReplanPreview(null);
            }}
            options={procedureTypes.map((pt) => ({
              value: pt.id,
              label: `${pt.code} — ${pt.name}`,
            }))}
          />
          {replanMode === "NUCLEAR_DAY" && isPlatformSuperAdmin ? (
            <label className={`flex items-center gap-2 text-[13px]`}>
              <input
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                checked={!replanRespectPins}
                onChange={(e) => setReplanRespectPins(!e.target.checked)}
              />
              {t("replanUnpin")}
            </label>
          ) : null}
          {replanPreview ? (
            <>
              <p className="text-[13px]">
                {t("replanCounts", {
                  n: replanPreview.counts.candidates,
                  pinned: replanPreview.counts.pinnedSkipped,
                })}
              </p>
              {replanPreview.sample && replanPreview.sample.length > 0 ? (
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr>
                      <th>{t("replanSampleCode")}</th>
                      <th>{t("replanSampleFrom")}</th>
                      <th>{t("replanSampleStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {replanPreview.sample.map((row) => (
                      <tr key={row.orderId}>
                        <td>{row.code ?? row.orderId.slice(0, 8)}</td>
                        <td>{row.from ? new Date(row.from).toLocaleTimeString() : "—"}</td>
                        <td>{row.status ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              <Field
                label={t("replanReason")}
                preset="shortText"
                value={replanReason}
                onChange={(e) => setReplanReason(e.target.value)}
              />
              <Field
                label={t("replanConfirmHint")}
                preset="code"
                value={replanConfirm}
                onChange={(e) => setReplanConfirm(e.target.value)}
              />
            </>
          ) : null}
          {replanSnapshotId ? (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={replanBusy}
              onClick={() => void undoReplan()}
            >
              {t("replanUndo")}
            </button>
          ) : null}
        </div>
        <ModalFooter
          onCancel={() => setReplanOpen(false)}
          onSubmit={() => void (replanPreview ? applyReplan() : previewReplan())}
          submitLabel={replanBusy ? "…" : replanPreview ? t("replanApply") : t("replanPreview")}
        />
      </ModalShell>
    </>
  );
}
