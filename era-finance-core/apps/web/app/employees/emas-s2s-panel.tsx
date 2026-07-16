"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api-client";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../lib/design-system";

type EmasEvent = {
  id: string;
  eventType: string;
  status: string;
  emasExternalId: string | null;
  createdAt: string;
  errorMessage: string | null;
};

function parseApiError(data: unknown, status: number): string {
  if (status === 503) return "503";
  if (!data || typeof data !== "object") return String(status);
  const payload = data as Record<string, unknown>;
  const m = payload.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.join("; ");
  return String(status);
}

export function EmasS2sPanel({ employeeId, open }: { employeeId: string | null; open: boolean }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<EmasEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [transferDate, setTransferDate] = useState("");
  const [terminateDate, setTerminateDate] = useState("");
  const [terminateReason, setTerminateReason] = useState("");

  const loadEvents = useCallback(async () => {
    if (!employeeId || !expanded) return;
    setLoadingEvents(true);
    setErr(null);
    try {
      const res = await apiFetch(`/api/hr/employees/${employeeId}/emas/events`);
      const data = (await res.json()) as unknown;
      if (!res.ok) {
        if (res.status === 503) {
          setErr(t("employees.emas.unavailable"));
        } else {
          setErr(parseApiError(data, res.status));
        }
        setEvents([]);
        setLoadingEvents(false);
        return;
      }
      setEvents(Array.isArray(data) ? (data as EmasEvent[]) : []);
    } catch {
      setErr(t("employees.emas.loadErr"));
    }
    setLoadingEvents(false);
  }, [employeeId, expanded, t]);

  useEffect(() => {
    if (!open) {
      setExpanded(false);
      setMsg(null);
      setErr(null);
      return;
    }
    if (expanded) void loadEvents();
  }, [open, expanded, loadEvents]);

  async function postAction(
    action: "hire" | "transfer" | "terminate",
    body: Record<string, string> = {},
  ) {
    if (!employeeId) return;
    setBusy(action);
    setMsg(null);
    setErr(null);
    try {
      const res = await apiFetch(`/api/hr/employees/${employeeId}/emas/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as unknown;
      if (!res.ok) {
        if (res.status === 503) {
          setErr(t("employees.emas.unavailable"));
        } else {
          setErr(parseApiError(data, res.status));
        }
        setBusy(null);
        return;
      }
      setMsg(t("employees.emas.actionOk", { action: action.toUpperCase() }));
      await loadEvents();
    } catch {
      setErr(t("employees.emas.actionErr"));
    }
    setBusy(null);
  }

  if (!employeeId) return null;

  return (
    <div className="mt-4 rounded-xl border border-[#D5DADF] bg-[#F8F9FA] p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-[#34495E]"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>{t("employees.emas.panelTitle")}</span>
        <span className="text-xs font-normal text-[#7F8C8D]">
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded ? (
        <div className="mt-3 space-y-3 text-sm">
          <p className="m-0 text-[#7F8C8D]">{t("employees.emas.panelHint")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy !== null}
              onClick={() => void postAction("hire")}
            >
              {busy === "hire" ? "…" : t("employees.emas.hire")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy !== null}
              onClick={() => void postAction("transfer", transferDate ? { effectiveDate: transferDate } : {})}
            >
              {busy === "transfer" ? "…" : t("employees.emas.transfer")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={busy !== null}
              onClick={() =>
                void postAction("terminate", {
                  ...(terminateDate ? { terminationDate: terminateDate } : {}),
                  ...(terminateReason ? { reason: terminateReason } : {}),
                })
              }
            >
              {busy === "terminate" ? "…" : t("employees.emas.terminate")}
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-[#34495E]">
              {t("employees.emas.transferDate")}
              <input
                type="date"
                className={MODAL_INPUT_CLASS}
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-[#34495E]">
              {t("employees.emas.terminateDate")}
              <input
                type="date"
                className={MODAL_INPUT_CLASS}
                value={terminateDate}
                onChange={(e) => setTerminateDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-[#34495E] md:col-span-2">
              {t("employees.emas.terminateReason")}
              <input
                className={MODAL_INPUT_CLASS}
                value={terminateReason}
                onChange={(e) => setTerminateReason(e.target.value)}
              />
            </label>
          </div>
          {msg ? <p className="m-0 text-green-700">{msg}</p> : null}
          {err ? <p className="m-0 text-red-600">{err}</p> : null}
          <div>
            <p className="mb-2 font-medium text-[#34495E]">{t("employees.emas.eventsTitle")}</p>
            {loadingEvents ? (
              <p className="text-[#7F8C8D]">{t("common.loading")}</p>
            ) : events.length === 0 ? (
              <p className="text-[#7F8C8D]">{t("employees.emas.eventsEmpty")}</p>
            ) : (
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("employees.emas.thType")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("employees.emas.thStatus")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("employees.emas.thExternalId")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("employees.emas.thDate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{ev.eventType}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{ev.status}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{ev.emasExternalId ?? "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{String(ev.createdAt).slice(0, 19)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
