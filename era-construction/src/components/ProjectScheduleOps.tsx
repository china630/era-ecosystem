"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DatePicker, Field, FieldRow, FORM_STACK_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { apiJson } from "@/lib/client-api";

type Task = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progressPct: number;
};

export function ProjectScheduleOps({ projectId }: { projectId: string }) {
  const t = useTranslations("projectsDetail.schedule");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [progressPct, setProgressPct] = useState("0");

  const load = useCallback(async () => {
    const res = await apiJson<{ tasks: Task[] }>(`/api/projects/${projectId}/gantt`);
    if (!res.ok) {
      setMessage(res.error);
      setTasks([]);
      return;
    }
    setTasks(Array.isArray(res.data.tasks) ? res.data.tasks : []);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveTask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await apiJson(`/api/projects/${projectId}/gantt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        startDate,
        endDate,
        progressPct: Number(progressPct) || 0,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    setName("");
    setStartDate("");
    setEndDate("");
    setProgressPct("0");
    setMessage(t("taskSaved"));
    await load();
  }

  async function removeTask(taskId: string) {
    setBusy(true);
    const res = await apiJson(`/api/projects/${projectId}/gantt?taskId=${encodeURIComponent(taskId)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[13px] font-semibold">{t("title")}</h2>
        <p className="text-[12px] text-[#7F8C8D]">{t("subtitle")}</p>
      </div>
      {message ? <p className="text-[13px]">{message}</p> : null}
      {tasks.length === 0 ? (
        <p className="text-[12px] text-[#7F8C8D]">{t("empty")}</p>
      ) : (
        <ul className="space-y-1 text-[13px]">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-1">
              <span>
                {task.name} · {String(task.startDate).slice(0, 10)} → {String(task.endDate).slice(0, 10)} ·{" "}
                {task.progressPct}%
              </span>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void removeTask(task.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={saveTask} className={FORM_STACK_CLASS}>
        <Field
          label={t("taskName")}
          preset="shortText"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <FieldRow cols={2}>
          <DatePicker label={t("startDate")} value={startDate} onChange={setStartDate} placeholder="dd.mm.yyyy" required />
          <DatePicker label={t("endDate")} value={endDate} onChange={setEndDate} placeholder="dd.mm.yyyy" required />
        </FieldRow>
        <Field
          label={t("progressPct")}
          preset="count"
          value={progressPct}
          onChange={(e) => setProgressPct(e.target.value)}
        />
        <button
          type="submit"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || !name.trim() || !startDate || !endDate}
        >
          {t("saveTask")}
        </button>
      </form>
    </div>
  );
}
