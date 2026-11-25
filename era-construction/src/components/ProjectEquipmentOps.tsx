"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DatePicker, Field, FieldRow, FORM_STACK_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { apiJson } from "@/lib/client-api";

type Log = {
  id: string;
  equipmentCode: string;
  hours: string | number;
  logDate: string;
};

export function ProjectEquipmentOps({ projectId }: { projectId: string }) {
  const t = useTranslations("projectsDetail.equipment");
  const [logs, setLogs] = useState<Log[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [equipmentCode, setEquipmentCode] = useState("");
  const [hours, setHours] = useState("8");
  const [logDate, setLogDate] = useState("");

  const load = useCallback(async () => {
    const res = await apiJson<Log[]>(`/api/equipment/hours?projectId=${encodeURIComponent(projectId)}`);
    if (!res.ok) {
      setMessage(res.error);
      setLogs([]);
      return;
    }
    setLogs(Array.isArray(res.data) ? res.data : []);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveLog(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await apiJson("/api/equipment/hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        equipmentCode: equipmentCode.trim(),
        hours: Number(hours) || 0,
        logDate,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    setEquipmentCode("");
    setHours("8");
    setLogDate("");
    setMessage(t("logSaved"));
    await load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[13px] font-semibold">{t("title")}</h2>
        <p className="text-[12px] text-[#7F8C8D]">{t("subtitle")}</p>
      </div>
      {message ? <p className="text-[13px]">{message}</p> : null}
      {logs.length === 0 ? (
        <p className="text-[12px] text-[#7F8C8D]">{t("empty")}</p>
      ) : (
        <ul className="space-y-1 text-[13px]">
          {logs.map((log) => (
            <li key={log.id} className="border-b py-1">
              {String(log.logDate).slice(0, 10)} · {log.equipmentCode} · {Number(log.hours)} h
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={saveLog} className={FORM_STACK_CLASS}>
        <FieldRow cols={2}>
          <Field
            label={t("equipmentCode")}
            preset="code"
            value={equipmentCode}
            onChange={(e) => setEquipmentCode(e.target.value)}
            required
          />
          <Field
            label={t("hours")}
            preset="count"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </FieldRow>
        <DatePicker label={t("logDate")} value={logDate} onChange={setLogDate} placeholder="dd.mm.yyyy" required />
        <button
          type="submit"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || !equipmentCode.trim() || !logDate}
        >
          {t("saveLog")}
        </button>
      </form>
    </div>
  );
}
