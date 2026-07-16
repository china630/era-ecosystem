"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type Slot = {
  time: string;
  occupied: boolean;
  blocked?: boolean;
  procedureOrderId?: string;
  patientName?: string;
  procedureName?: string;
  status?: string;
  patientRefId?: string;
  procedureCode?: string;
};

type ResourceRow = {
  resourceId: string;
  code: string;
  name: string;
  slots: Slot[];
};

type AvailSlot = {
  resourceId: string;
  resourceCode?: string;
  startsAt: string;
  endsAt: string;
};

export default function SanatoriumResourcesPage() {
  const t = useTranslations("sanatoriumResources");
  const tNav = useTranslations("nav");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [resources, setResources] = useState<ResourceRow[]>([]);
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

  const load = useCallback(async () => {
    const res = await fetch(`/api/sanatorium/resources/calendar?date=${date}`);
    const data = await res.json();
    const payload = data.data ?? data;
    setResources(payload.resources ?? []);
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/sanatorium" className={PRIMARY_BUTTON_CLASS}>
            {tNav("sanatorium")}
          </Link>
        }
      />
      {msg ? (
        <p className={`mb-3 text-sm ${msgErr ? "text-red-700" : "text-emerald-700"}`}>{msg}</p>
      ) : null}
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <label className="text-sm">
          {t("date")}{" "}
          <input
            type="date"
            className={MODAL_INPUT_CLASS}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <p className="text-[12px] text-[#7F8C8D]">{t("dragHint")}</p>
        {resources.length === 0 ? (
          <p className="text-sm text-[#7F8C8D]">{t("empty")}</p>
        ) : (
          resources.map((row) => (
            <div key={row.resourceId} className="space-y-2">
              <h3 className="text-sm font-semibold">
                {row.name}{" "}
                <span className="font-normal text-[#7F8C8D]">({row.code})</span>
              </h3>
              <div className="flex flex-wrap gap-1">
                {row.slots.map((slot) => {
                  const timeLabel = new Date(slot.time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const occupied = slot.occupied || slot.blocked;
                  return (
                    <div
                      key={slot.time}
                      draggable={occupied && Boolean(slot.procedureOrderId) && slot.status === "SCHEDULED"}
                      onDragStart={() => {
                        if (slot.procedureOrderId) setDragOrderId(slot.procedureOrderId);
                      }}
                      onDragOver={(e) => {
                        if (!occupied) e.preventDefault();
                      }}
                      onDrop={() => {
                        if (!occupied) void dropOnSlot(row.resourceId, slot.time);
                      }}
                      className={`min-w-[4.5rem] rounded border px-1.5 py-1 text-[11px] ${
                        occupied
                          ? "cursor-grab border-violet-300 bg-violet-50"
                          : "border-emerald-200 bg-emerald-50"
                      }`}
                      title={
                        occupied
                          ? `${slot.patientName ?? ""} ${slot.procedureName ?? ""} (${slot.status ?? ""})`
                          : t("free")
                      }
                    >
                      <div className="font-medium">{timeLabel}</div>
                      {occupied ? (
                        <div className="truncate">
                          {slot.patientName?.split(" ")[0] ?? "…"}
                          <div className="mt-0.5 flex gap-1">
                            <button
                              type="button"
                              className="underline"
                              onClick={() => void openMovePicker(slot)}
                            >
                              {t("move")}
                            </button>
                            {slot.status === "SCHEDULED" ? (
                              <button
                                type="button"
                                className="underline text-red-700"
                                onClick={() => setCancelId(slot.procedureOrderId ?? null)}
                              >
                                {t("cancel")}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="text-emerald-800">{t("free")}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <ModalShell
        open={Boolean(moveOrder)}
        title={t("pickSlot")}
        onClose={() => setMoveOrder(null)}
        closeLabel="Close"
      >
        {avail.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("noFreeSlots")}</p>
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
        open={Boolean(cancelId)}
        title={t("cancel")}
        onClose={() => setCancelId(null)}
      >
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
