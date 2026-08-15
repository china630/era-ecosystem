const fs = require("fs");
const path = require("path");
const out = path.join(__dirname, "../../app/sanatorium/resources/page.tsx");

const src = `"use client";

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
import {
  ResourceDayMatrix,
  type Slot,
  type ResourceRow,
} from "@/components/sanatorium/ResourceDayMatrix";

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
  const [resourceFilter, setResourceFilter] = useState("");
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
    const res = await fetch(\`/api/sanatorium/resources/calendar?date=\${date}\`);
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
    const res = await fetch(\`/api/procedures/\${dragOrderId}/reschedule\`, {
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
    const res = await fetch(\`/api/sanatorium/resources/available-slots?\${params}\`);
    const data = await res.json();
    setAvail((data.data ?? data).slots ?? []);
  }

  async function confirmMove(startsAt: string, resourceId: string) {
    if (!moveOrder) return;
    const res = await fetch(\`/api/procedures/\${moveOrder.id}/reschedule\`, {
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
    const res = await fetch(\`/api/procedures/\${cancelId}/cancel\`, {
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
        <p className={\`mb-3 text-sm \${msgErr ? "text-red-700" : "text-emerald-700"}\`}>{msg}</p>
      ) : null}
      <div className={\`\${CARD_CONTAINER_CLASS} space-y-4 p-4\`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            {t("date")}{" "}
            <input
              type="date"
              className={MODAL_INPUT_CLASS}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
            {t("refresh")}
          </button>
        </div>
        <ResourceDayMatrix
          date={date}
          resources={resources}
          resourceFilter={resourceFilter}
          onResourceFilterChange={setResourceFilter}
          labels={{
            free: t("free"),
            empty: t("empty"),
            move: t("move"),
            cancel: t("cancel"),
            staff: t("staff"),
            now: t("now"),
            dragHint: t("dragHint"),
            filterResource: t("filterResource"),
            legendFree: t("legendFree"),
            legendScheduled: t("legendScheduled"),
            legendCompleted: t("legendCompleted"),
            legendBlocked: t("legendBlocked"),
            refresh: t("refresh"),
          }}
          onDragStart={setDragOrderId}
          onDropFree={(resourceId, slotTimeIso) => void dropOnSlot(resourceId, slotTimeIso)}
          onMove={(slot) => void openMovePicker(slot)}
          onCancel={(orderId) => setCancelId(orderId)}
        />
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
              <li key={\`\${s.resourceId}-\${s.startsAt}\`}>
                <button
                  type="button"
                  className={\`\${SECONDARY_BUTTON_CLASS} w-full !justify-start\`}
                  onClick={() => void confirmMove(s.startsAt, s.resourceId)}
                >
                  {(s.resourceCode ? \`\${s.resourceCode} · \` : "") +
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
`;

fs.writeFileSync(out, src, "utf8");
const b = fs.readFileSync(out);
console.log("wrote resources page byte0=", b[0], "bytes=", b.length);
if (b[0] === 0) process.exit(1);