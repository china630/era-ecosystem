"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";

type ProcedureLine = {
  procedureCode: string;
  quotaTotal: number;
  quotaUsed: number;
};

type ProgramInstance = {
  programCode: string;
  startsOn: string;
  endsOn: string;
  procedureLines: ProcedureLine[];
};

type ProcedureOrder = {
  id: string;
  procedureName: string;
  procedureCode: string;
  scheduledAt: string;
  status: string;
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
  patientRef: { id: string; fullName: string; refCode: string } | null;
  complaints: { text: string; recordedAt: string }[];
  diagnoses: {
    icdCodeText: string | null;
    icdCode?: { code: string } | null;
    description: string;
  }[];
  labOrders: { id: string; testCode: string; status: string }[];
  programInstance?: ProgramInstance | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysRemaining(endsOn: string): number {
  const end = new Date(endsOn);
  end.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000));
}

export default function SanatoriumPage() {
  const t = useTranslations("sanatorium");
  const tNav = useTranslations("nav");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodeDetail, setEpisodeDetail] = useState<Episode | null>(null);
  const [scheduleOrders, setScheduleOrders] = useState<ProcedureOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [chartDate, setChartDate] = useState(todayIso());
  const [complaint, setComplaint] = useState("");
  const [icdCode, setIcdCode] = useState("");
  const [icdCodeId, setIcdCodeId] = useState("");
  const [icdOptions, setIcdOptions] = useState<Array<{ id: string; code: string; description: string }>>([]);
  const [diagnosis, setDiagnosis] = useState("");
  const [testCode, setTestCode] = useState("CBC");
  const [programCode, setProgramCode] = useState("DETOX-7");
  const [programStartsOn, setProgramStartsOn] = useState(todayIso());
  const [msg, setMsg] = useState("");
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [diagnosisModalOpen, setDiagnosisModalOpen] = useState(false);
  const [labModalOpen, setLabModalOpen] = useState(false);
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [rescheduleOrderId, setRescheduleOrderId] = useState<string | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [walkInName, setWalkInName] = useState("");
  const [walkInFin, setWalkInFin] = useState("");
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/sanatorium/episodes");
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setEpisodes(list);
    if (!selectedId && list[0]?.id) setSelectedId(list[0].id);
  }, [selectedId]);

  const loadDetail = useCallback(async (episodeId: string) => {
    const res = await fetch(`/api/sanatorium/episodes/${episodeId}`);
    if (!res.ok) {
      setEpisodeDetail(null);
      return;
    }
    const data = await res.json();
    setEpisodeDetail(data);
  }, []);

  const loadSchedule = useCallback(async (episodeId: string, date: string) => {
    const day = new Date(`${date}T00:00:00`);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const qs = new URLSearchParams({
      from: day.toISOString(),
      to: next.toISOString(),
    });
    const res = await fetch(`/api/sanatorium/episodes/${episodeId}/schedule?${qs}`);
    if (!res.ok) {
      setScheduleOrders([]);
      return;
    }
    const data = await res.json();
    setScheduleOrders(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId);
    void loadSchedule(selectedId, chartDate);
  }, [selectedId, chartDate, loadDetail, loadSchedule]);

  const selected = episodeDetail ?? episodes.find((e) => e.id === selectedId);

  function statusLabel(status: string): string {
    switch (status) {
      case "SCHEDULED":
        return t("statusScheduled");
      case "IN_PROGRESS":
        return t("statusInProgress");
      case "COMPLETED":
        return t("statusCompleted");
      case "CANCELLED":
        return t("statusCancelled");
      default:
        return status;
    }
  }

  async function reloadEpisode() {
    await loadList();
    if (selectedId) {
      await loadDetail(selectedId);
      await loadSchedule(selectedId, chartDate);
    }
  }

  async function postAction(action: string, body: unknown) {
    if (!selectedId) return;
    setBusy(true);
    const res = await fetch(`/api/sanatorium/episodes/${selectedId}?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (action === "instantiate-program" && res.status === 409) {
      setMsg(t("alreadyHasProgram"));
      return;
    }
    setMsg(
      res.ok
        ? action === "instantiate-program" || action === "complete-checkup"
          ? t("programStarted")
          : t("saved")
        : (data.error ?? t("failed")),
    );
    if (res.ok) {
      if (action === "complaint") {
        setComplaint("");
        setComplaintModalOpen(false);
      }
      if (action === "diagnosis") {
        setIcdCode("");
        setIcdCodeId("");
        setDiagnosis("");
        setDiagnosisModalOpen(false);
      }
      if (action === "lab") setLabModalOpen(false);
      if (action === "instantiate-program" || action === "complete-checkup") {
        setProgramModalOpen(false);
      }
      await reloadEpisode();
    }
  }

  async function registerWalkIn() {
    setBusy(true);
    const res = await fetch("/api/sanatorium/episodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: walkInName,
        fin: walkInFin || undefined,
        programCode,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error ?? t("failed"));
      return;
    }
    setWalkInModalOpen(false);
    setWalkInName("");
    setWalkInFin("");
    setMsg(t("walkInRegistered"));
    await loadList();
    const ep = data.data ?? data;
    if (ep?.id) setSelectedId(ep.id);
  }

  async function rescheduleProcedure() {
    if (!rescheduleOrderId) return;
    setBusy(true);
    const scheduledAt = new Date(`${chartDate}T${rescheduleTime}:00`).toISOString();
    const res = await fetch(`/api/procedures/${rescheduleOrderId}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? t("rescheduled") : (data.error ?? t("failed")));
    setRescheduleOrderId(null);
    if (res.ok && selectedId) await loadSchedule(selectedId, chartDate);
  }

  async function completeProcedure(orderId: string) {
    setBusy(true);
    await fetch(`/api/procedures/${orderId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consumableLines: [{ sku: "CONS-1", qty: 1 }],
        amountNet: 0,
      }),
    });
    setBusy(false);
    await reloadEpisode();
  }

  const program = selected?.programInstance;
  const canCompleteCheckup =
    selected &&
    !program &&
    (selected.complaints.length > 0 || selected.diagnoses.length > 0);

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setWalkInModalOpen(true)}>
              {t("registerWalkIn")}
            </button>
            <Link href="/sanatorium/resources" className={PRIMARY_BUTTON_CLASS}>
              {t("resourceCalendar")}
            </Link>
            <Link href="/" className={PRIMARY_BUTTON_CLASS}>
              {tNav("home")}
            </Link>
          </div>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-6`}>
        {msg && <p className="text-[13px] text-emerald-700">{msg}</p>}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t("inHouseList")}</h2>
            <ul className="space-y-2 text-[13px]">
              {episodes.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={`w-full rounded border px-3 py-2 text-left ${
                      e.id === selectedId ? "border-sky-500 bg-sky-50" : "border-[#ECF0F1]"
                    }`}
                    onClick={() => setSelectedId(e.id)}
                  >
                    <div className="font-medium">{e.patientRef?.fullName ?? t("guest")}</div>
                    <div className="text-[#7F8C8D]">
                      {t("stay")} {e.reservationId?.slice(0, 8) ?? "—"} · {e.status}
                    </div>
                  </button>
                </li>
              ))}
              {episodes.length === 0 && (
                <li className="text-[#7F8C8D]">{t("noEpisodes")}</li>
              )}
            </ul>
          </div>
          {selected && (
            <div className="space-y-4 text-[13px]">
              <div>
                <strong>{selected.patientRef?.fullName}</strong> ({selected.patientRef?.refCode})
                {selected.patientRef?.id ? (
                  <Link
                    href={`/patients/${selected.patientRef.id}`}
                    className="ml-2 text-blue-600 hover:underline"
                  >
                    Body map
                  </Link>
                ) : null}
              </div>
              <div>
                <h3 className="font-semibold">{t("complaints")}</h3>
                <ul className="list-disc pl-5">
                  {selected.complaints.map((c, i) => (
                    <li key={i}>{c.text}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`${PRIMARY_BUTTON_CLASS} mt-2`}
                  onClick={() => setComplaintModalOpen(true)}
                >
                  {t("add")}
                </button>
              </div>
              <div>
                <h3 className="font-semibold">{t("diagnoses")}</h3>
                <ul className="list-disc pl-5">
                  {selected.diagnoses.map((d, i) => (
                    <li key={i}>
                      {(d.icdCode?.code ?? d.icdCodeText)
                        ? `${d.icdCode?.code ?? d.icdCodeText}: `
                        : ""}
                      {d.description}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`${PRIMARY_BUTTON_CLASS} mt-2`}
                  onClick={() => setDiagnosisModalOpen(true)}
                >
                  {t("addDiagnosis")}
                </button>
              </div>
              <div>
                <h3 className="font-semibold">{t("labOrders")}</h3>
                <ul>
                  {selected.labOrders.map((o) => (
                    <li key={o.id}>
                      {o.testCode} — {o.status}{" "}
                      <Link href={`/lab-orders/${o.id}`} className="text-sky-600 underline">
                        {t("workflow")}
                      </Link>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`${PRIMARY_BUTTON_CLASS} mt-2`}
                  onClick={() => setLabModalOpen(true)}
                >
                  {t("orderLab")}
                </button>
              </div>
            </div>
          )}
        </div>

        {selected && (
          <div className="space-y-4 border-t border-[#ECF0F1] pt-6 text-[13px]">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-sm font-semibold text-[#34495E]">{t("treatmentChart")}</h2>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t("chartDate")}</label>
                <input
                  type="date"
                  className={MODAL_INPUT_CLASS}
                  value={chartDate}
                  onChange={(e) => setChartDate(e.target.value)}
                />
              </div>
            </div>

            {program ? (
              <div className="rounded border border-[#ECF0F1] p-4 space-y-3">
                <div className="flex flex-wrap gap-4">
                  <span>
                    <strong>{t("programSummary")}:</strong> {program.programCode}
                  </span>
                  <span>
                    {t("daysRemaining")}: {daysRemaining(program.endsOn)}
                  </span>
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">{t("programQuota")}</h3>
                  <ul className="space-y-2">
                    {program.procedureLines.map((line) => {
                      const pct =
                        line.quotaTotal > 0
                          ? Math.min(100, (line.quotaUsed / line.quotaTotal) * 100)
                          : 0;
                      return (
                        <li key={line.procedureCode}>
                          <div className="mb-1 flex justify-between">
                            <span>{line.procedureCode}</span>
                            <span>{t("quotaUsed", { used: line.quotaUsed, total: line.quotaTotal })}</span>
                          </div>
                          <div className="h-2 rounded bg-[#ECF0F1]">
                            <div
                              className="h-2 rounded bg-sky-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="rounded border border-dashed border-[#ECF0F1] p-4 space-y-2">
                {!selected.checkupCompletedAt && (
                  <p className="text-[13px] text-[#7F8C8D]">{t("checkupPendingHint")}</p>
                )}
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={!canCompleteCheckup}
                  onClick={() => setProgramModalOpen(true)}
                >
                  {t("completeCheckupSchedule")}
                </button>
              </div>
            )}

            <div className="overflow-x-auto rounded border border-[#ECF0F1]">
              <table className="min-w-full text-left text-[13px]">
                <thead className="border-b border-[#ECF0F1] bg-[#F8F9FA]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{t("procedureTime")}</th>
                    <th className="px-3 py-2 font-semibold">{t("procedureName")}</th>
                    <th className="px-3 py-2 font-semibold">{t("procedureStatus")}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {scheduleOrders.map((o) => (
                    <tr key={o.id} className="border-b border-[#ECF0F1] last:border-0">
                      <td className="px-3 py-2">
                        {new Date(o.scheduledAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2">{o.procedureName}</td>
                      <td className="px-3 py-2">{statusLabel(o.status)}</td>
                      <td className="px-3 py-2 text-right space-x-2">
                        {o.status === "SCHEDULED" || o.status === "IN_PROGRESS" ? (
                          <>
                            <button
                              type="button"
                              className={PRIMARY_BUTTON_CLASS}
                              disabled={busy}
                              onClick={() => void completeProcedure(o.id)}
                            >
                              {t("complete")}
                            </button>
                            <button
                              type="button"
                              className="rounded border px-2 py-1 text-xs"
                              onClick={() => {
                                setRescheduleOrderId(o.id);
                                setRescheduleTime(
                                  new Date(o.scheduledAt).toISOString().slice(11, 16),
                                );
                              }}
                            >
                              {t("reschedule")}
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {scheduleOrders.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-[#7F8C8D]">
                        {t("noProcedures")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ModalShell
        open={complaintModalOpen}
        title={t("newComplaint")}
        onClose={() => setComplaintModalOpen(false)}
        footer={
          <ModalFooter
            onCancel={() => setComplaintModalOpen(false)}
            onSubmit={() => void postAction("complaint", { text: complaint })}
            busy={busy}
            submitLabel={t("add")}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("newComplaint")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
            />
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={diagnosisModalOpen}
        title={t("addDiagnosis")}
        onClose={() => setDiagnosisModalOpen(false)}
        footer={
          <ModalFooter
            onCancel={() => setDiagnosisModalOpen(false)}
            onSubmit={() =>
              void postAction("diagnosis", {
                icdCodeId,
                icdCode,
                description: diagnosis,
              })
            }
            busy={busy}
            submitLabel={t("addDiagnosis")}
          />
        }
      >
        <div className={`${FORM_STACK_CLASS} grid grid-cols-2 gap-3`}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>ICD</label>
            <select
              className={MODAL_INPUT_CLASS}
              value={icdCodeId}
              onFocus={() => {
                void fetch("/api/icd")
                  .then((r) => r.json())
                  .then((d) => setIcdOptions(d.items ?? []));
              }}
              onChange={(e) => {
                const id = e.target.value;
                setIcdCodeId(id);
                const row = icdOptions.find((x) => x.id === id);
                if (row) setIcdCode(row.code);
              }}
              required
            >
              <option value="">—</option>
              {icdOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code} — {row.description}
                </option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("description")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={labModalOpen}
        title={t("orderLab")}
        onClose={() => setLabModalOpen(false)}
        footer={
          <ModalFooter
            onCancel={() => setLabModalOpen(false)}
            onSubmit={() => void postAction("lab", { testCode })}
            busy={busy}
            submitLabel={t("orderLab")}
          />
        }
      >
        <div className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("orderLab")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
            />
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={programModalOpen}
        title={t("completeCheckupSchedule")}
        onClose={() => setProgramModalOpen(false)}
        footer={
          <ModalFooter
            onCancel={() => setProgramModalOpen(false)}
            onSubmit={() =>
              void postAction("complete-checkup", {
                programCode: programCode || selected?.programCode || "DETOX-7",
                startsOn: new Date(`${programStartsOn}T09:00:00`).toISOString(),
              })
            }
            busy={busy}
            submitDisabled={!canCompleteCheckup}
            submitLabel={t("completeCheckupSchedule")}
          />
        }
      >
        <div className={`${FORM_STACK_CLASS} grid grid-cols-2 gap-3`}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("programCode")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value)}
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("startsOn")}</label>
            <input
              type="date"
              className={MODAL_INPUT_CLASS}
              value={programStartsOn}
              onChange={(e) => setProgramStartsOn(e.target.value)}
            />
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={walkInModalOpen}
        title={t("registerWalkIn")}
        onClose={() => setWalkInModalOpen(false)}
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
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("walkInName")}</label>
            <input className={MODAL_INPUT_CLASS} value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("walkInFin")}</label>
            <input className={MODAL_INPUT_CLASS} value={walkInFin} onChange={(e) => setWalkInFin(e.target.value)} />
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(rescheduleOrderId)}
        title={t("reschedule")}
        onClose={() => setRescheduleOrderId(null)}
        footer={
          <ModalFooter
            onCancel={() => setRescheduleOrderId(null)}
            onSubmit={() => void rescheduleProcedure()}
            busy={busy}
            submitLabel={t("reschedule")}
          />
        }
      >
        <input
          type="time"
          className={MODAL_INPUT_CLASS}
          value={rescheduleTime}
          onChange={(e) => setRescheduleTime(e.target.value)}
        />
      </ModalShell>
    </>
  );
}
