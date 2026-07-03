"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  FieldRow,
  FieldTextarea,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type Project = { id: string; code: string; name: string };

const logFormId = "daily-log-form";

export default function FieldOpsPage() {
  const t = useTranslations("fieldOps");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [message, setMessage] = useState("");
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(Array.isArray(d) ? d : []));
  }, []);

  async function addDailyLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!projectId) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/projects/${projectId}/daily-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logDate: fd.get("logDate"),
        weather: fd.get("weather") || undefined,
        crewCount: Number(fd.get("crewCount")) || undefined,
        notes: fd.get("notes") || undefined,
        reportedBy: fd.get("reportedBy") || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    setMessage(res.ok ? t("logSaved") : (data.error ?? t("failed")));
    if (res.ok) setLogModalOpen(false);
  }

  async function importTimesheet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!projectId) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/timesheets/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        rows: [
          {
            workerRef: String(fd.get("workerRef") ?? "W001"),
            hours: Number(fd.get("hours")) || 8,
            workDate: String(fd.get("workDate")),
          },
        ],
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      const warn = Array.isArray(data.warnings) && data.warnings.length
        ? ` (${data.warnings.join("; ")})`
        : "";
      setMessage(`${t("timesheetImported", { count: data.imported })}${warn}`);
    } else {
      setMessage(data.error ?? t("failed"));
    }
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            {tNav("home")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6 space-y-6 text-[13px]`}>
        {message && <p>{message}</p>}
        <label className="block">
          {t("project")}
          <select
            className="mt-1 block w-full rounded border px-2 py-1"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">{tc("select")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </label>
        {projectId && (
          <>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => setLogModalOpen(true)}
            >
              {t("saveLog")}
            </button>
            <p>
              <Link href={`/projects/${projectId}`} className="text-[#2980B9] hover:underline">
                {t("punchListLink")}
              </Link>
            </p>
            <form onSubmit={importTimesheet} className={`${FORM_STACK_CLASS} mt-4 rounded border p-3`}>
              <p className="font-medium">{t("timesheetImport")}</p>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t("workerRef")}</label>
                <input name="workerRef" defaultValue="W001" className={MODAL_INPUT_CLASS} />
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t("workDate")}</label>
                <input name="workDate" type="date" required className={MODAL_INPUT_CLASS} />
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t("hours")}</label>
                <input name="hours" type="number" defaultValue={8} min={0} step={0.5} className={MODAL_INPUT_CLASS} />
              </div>
              <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
                {t("importTimesheet")}
              </button>
            </form>
          </>
        )}
      </div>

      <ModalShell
        open={logModalOpen}
        title={t("dailyLog")}
        onClose={() => setLogModalOpen(false)}
        closeLabel={tc("close")}
        footer={
          <ModalFooter
            formId={logFormId}
            onCancel={() => setLogModalOpen(false)}
            busy={busy}
            submitLabel={t("saveLog")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form id={logFormId} onSubmit={addDailyLog} className={FORM_STACK_CLASS}>
          <Field
            label={t("dailyLog")}
            preset="date"
            name="logDate"
            type="date"
            required
          />
          <FieldRow cols={2}>
            <Field
              label={t("weather")}
              preset="shortText"
              name="weather"
              placeholder={t("weather")}
            />
            <Field
              label={t("crewCount")}
              preset="count"
              name="crewCount"
              type="number"
              min={0}
              placeholder={t("crewCount")}
            />
          </FieldRow>
          <FieldTextarea
            label={t("notes")}
            name="notes"
            rows={2}
            placeholder={t("notes")}
          />
          <Field
            label={t("reportedBy")}
            preset="shortText"
            name="reportedBy"
            placeholder={t("reportedBy")}
          />
        </form>
      </ModalShell>
    </>
  );
}
