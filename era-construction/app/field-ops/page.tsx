"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  MODAL_INPUT_CLASS,
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
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("dailyLog")}</label>
            <input name="logDate" type="date" required className={MODAL_INPUT_CLASS} />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("weather")}</label>
            <input name="weather" placeholder={t("weather")} className={MODAL_INPUT_CLASS} />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("crewCount")}</label>
            <input name="crewCount" type="number" min={0} placeholder={t("crewCount")} className={MODAL_INPUT_CLASS} />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("notes")}</label>
            <textarea name="notes" rows={2} placeholder={t("notes")} className={MODAL_INPUT_CLASS} />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("reportedBy")}</label>
            <input name="reportedBy" placeholder={t("reportedBy")} className={MODAL_INPUT_CLASS} />
          </div>
        </form>
      </ModalShell>
    </>
  );
}
