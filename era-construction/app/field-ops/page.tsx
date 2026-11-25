"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DatePicker,
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
import { punchStatusOptions } from "@/lib/punch-status";
import { apiJson } from "@/lib/client-api";

type Project = { id: string; code: string; name: string };

type PunchItem = {
  id: string;
  location: string;
  description: string;
  status: string;
  ifcElementId?: string | null;
  externalViewerUrl?: string | null;
};

type Sheet = { id: string; drawingCode: string; revision: string; status: string };

const logFormId = "daily-log-form";
const punchFormId = "punch-form";

export default function FieldOpsPage() {
  const t = useTranslations("fieldOps");
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [message, setMessage] = useState("");
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [punchModalOpen, setPunchModalOpen] = useState(false);
  const [workDate, setWorkDate] = useState("");
  const [logDate, setLogDate] = useState("");
  const [weather, setWeather] = useState("");
  const [crewCount, setCrewCount] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [equipmentNotes, setEquipmentNotes] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [punchLocation, setPunchLocation] = useState("");
  const [punchDesc, setPunchDesc] = useState("");
  const [punchAssignee, setPunchAssignee] = useState("");
  const [punchSheetId, setPunchSheetId] = useState("");
  const [punchPinX, setPunchPinX] = useState("");
  const [punchPinY, setPunchPinY] = useState("");
  const [punchIfc, setPunchIfc] = useState("");
  const [punchViewerUrl, setPunchViewerUrl] = useState("");
  const [bimEnabled, setBimEnabled] = useState(true);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [punches, setPunches] = useState<PunchItem[]>([]);
  const [busy, setBusy] = useState(false);

  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
    [projects],
  );

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/platform/billing-snapshot")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const mods: string[] = Array.isArray(data?.activeModules)
          ? data.activeModules
          : [];
        const tier = String(data?.tier ?? "").toUpperCase();
        setBimEnabled(tier === "TIER_3" || mods.includes("construction_bim_lite"));
      })
      .catch(() => {
        if (!cancelled) setBimEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!projectId) {
      setPunches([]);
      setSheets([]);
      return;
    }
    void fetch(`/api/projects/${projectId}/punch-list`)
      .then((r) => r.json())
      .then((d) => setPunches(Array.isArray(d) ? d : []));
    void fetch(`/api/cde/documents?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((d) => {
        const docs = Array.isArray(d.documents) ? d.documents : [];
        setSheets(docs.filter((s: Sheet) => s.status === "CURRENT"));
      });
  }, [projectId]);

  async function addDailyLog(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setBusy(true);
    const res = await apiJson(`/api/projects/${projectId}/daily-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logDate,
        weather: weather || undefined,
        crewCount: crewCount ? Number(crewCount) : undefined,
        notes: logNotes || undefined,
        reportedBy: reportedBy || undefined,
        equipmentNotes: equipmentNotes || undefined,
      }),
    });
    setBusy(false);
    setMessage(res.ok ? t("logSaved") : res.error || t("failed"));
    if (res.ok) {
      setLogModalOpen(false);
      setLogDate("");
      setWeather("");
      setCrewCount("");
      setLogNotes("");
      setEquipmentNotes("");
      setReportedBy("");
    }
  }

  async function addPunch(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    const viewer = punchViewerUrl.trim();
    if (bimEnabled && viewer && !/^https?:\/\//i.test(viewer)) {
      setMessage(t("bimViewerInvalid"));
      return;
    }
    setBusy(true);
    const res = await apiJson(`/api/projects/${projectId}/punch-list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: punchLocation.trim(),
        description: punchDesc.trim(),
        assignee: punchAssignee.trim() || undefined,
        drawingRevisionId: punchSheetId || undefined,
        pinX: punchPinX !== "" ? Number(punchPinX) : undefined,
        pinY: punchPinY !== "" ? Number(punchPinY) : undefined,
        ifcElementId: bimEnabled ? punchIfc.trim() || undefined : undefined,
        externalViewerUrl: bimEnabled ? viewer || undefined : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error || t("failed"));
      return;
    }
    setPunchLocation("");
    setPunchDesc("");
    setPunchAssignee("");
    setPunchSheetId("");
    setPunchPinX("");
    setPunchPinY("");
    setPunchIfc("");
    setPunchViewerUrl("");
    setPunchModalOpen(false);
    setMessage(t("punchSaved"));
    const listRes = await apiJson<PunchItem[]>(`/api/projects/${projectId}/punch-list`);
    if (listRes.ok) setPunches(Array.isArray(listRes.data) ? listRes.data : []);
  }

  async function updatePunchStatus(itemId: string, status: string) {
    if (!projectId) return;
    const res = await apiJson(`/api/projects/${projectId}/punch-list`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, status }),
    });
    if (!res.ok) {
      setMessage(res.error || t("failed"));
      return;
    }
    const listRes = await apiJson<PunchItem[]>(`/api/projects/${projectId}/punch-list`);
    if (listRes.ok) setPunches(Array.isArray(listRes.data) ? listRes.data : []);
  }

  async function importTimesheet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!projectId) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const res = await apiJson<{ imported?: number; warnings?: string[] }>("/api/timesheets/import", {
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
    setBusy(false);
    if (res.ok) {
      const warn = Array.isArray(res.data.warnings) && res.data.warnings.length
        ? ` (${res.data.warnings.join("; ")})`
        : "";
      setMessage(`${t("timesheetImported", { count: res.data.imported ?? 0 })}${warn}`);
    } else {
      setMessage(res.error || t("failed"));
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
        <CatalogField
          kind={projectOptions.length > 12 ? "SEARCHABLE" : "CLOSED_MEDIUM"}
          label={t("project")}
          value={projectId}
          onChange={(v) => setProjectId(String(v))}
          options={projectOptions}
          required
        />
        {projectId && (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => setLogModalOpen(true)}
              >
                {t("saveLog")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => setPunchModalOpen(true)}
              >
                {t("addPunch")}
              </button>
              <Link href={`/projects/${projectId}`} className="text-[#2980B9] hover:underline self-center">
                {t("projectDetailLink")}
              </Link>
            </div>

            <div className="rounded border p-3 space-y-2">
              <p className="font-medium">{t("punchList")}</p>
              {punches.length === 0 ? (
                <p className="text-[#7F8C8D]">{t("punchEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {punches.map((item) => (
                    <li key={item.id} className="flex flex-col gap-1 border-b py-1">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <span>
                          {item.location} — {item.description}
                        </span>
                        <CatalogField
                          kind="CLOSED_SMALL"
                          label={t("punchStatus")}
                          value={item.status}
                          onChange={(v) => {
                            const next = String(v);
                            if (next === item.status) return;
                            void updatePunchStatus(item.id, next);
                          }}
                          options={punchStatusOptions(item.status)}
                          hideLabel
                        />
                      </div>
                      {bimEnabled && (item.ifcElementId || item.externalViewerUrl) ? (
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          {item.ifcElementId ? (
                            <span className="rounded border px-1.5 py-0.5 text-[#7F8C8D]">
                              {t("bimIfc")}: {item.ifcElementId}
                            </span>
                          ) : null}
                          {item.externalViewerUrl ? (
                            <a
                              href={item.externalViewerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded border border-[#2980B9]/40 px-1.5 py-0.5 text-[#2980B9]"
                            >
                              {t("bimViewer")}
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form onSubmit={importTimesheet} className={`${FORM_STACK_CLASS} mt-4 rounded border p-3`}>
              <p className="font-medium">{t("timesheetImport")}</p>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t("workerRef")}</label>
                <input name="workerRef" defaultValue="W001" className={MODAL_INPUT_CLASS} />
              </div>
              <DatePicker
                label={t("workDate")}
                value={workDate}
                onChange={setWorkDate}
                placeholder="dd.mm.yyyy"
                required
              />
              <input type="hidden" name="workDate" value={workDate} />
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
        closeLabel={tc("cancel")}
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
          <DatePicker
            label={t("dailyLog")}
            value={logDate}
            onChange={setLogDate}
            placeholder="dd.mm.yyyy"
            required
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("weather")}
            value={weather}
            onChange={(v) => setWeather(String(v))}
            options={[
              { value: "", label: "—" },
              { value: "CLEAR", label: t("weatherClear") },
              { value: "RAIN", label: t("weatherRain") },
              { value: "CLOUD", label: t("weatherCloud") },
              { value: "WIND", label: t("weatherWind") },
            ]}
            emptyLabel={null}
          />
          <FieldRow cols={2}>
            <Field
              label={t("crewCount")}
              preset="count"
              value={crewCount}
              onChange={(e) => setCrewCount(e.target.value)}
            />
            <Field
              label={t("equipmentNotes")}
              preset="shortText"
              value={equipmentNotes}
              onChange={(e) => setEquipmentNotes(e.target.value)}
            />
          </FieldRow>
          <FieldTextarea
            label={t("notes")}
            value={logNotes}
            onChange={(e) => setLogNotes(e.target.value)}
            rows={2}
          />
          <Field
            label={t("reportedBy")}
            preset="shortText"
            value={reportedBy}
            onChange={(e) => setReportedBy(e.target.value)}
          />
        </form>
      </ModalShell>

      <ModalShell
        open={punchModalOpen}
        title={t("addPunch")}
        onClose={() => setPunchModalOpen(false)}
        closeLabel={tc("cancel")}
        footer={
          <ModalFooter
            formId={punchFormId}
            onCancel={() => setPunchModalOpen(false)}
            busy={busy}
            submitLabel={t("savePunch")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form id={punchFormId} onSubmit={addPunch} className={FORM_STACK_CLASS}>
          <Field
            label={t("punchLocation")}
            preset="shortText"
            value={punchLocation}
            onChange={(e) => setPunchLocation(e.target.value)}
            required
          />
          <Field
            label={t("punchDescription")}
            preset="shortText"
            value={punchDesc}
            onChange={(e) => setPunchDesc(e.target.value)}
            required
          />
          <Field
            label={t("punchAssignee")}
            preset="shortText"
            value={punchAssignee}
            onChange={(e) => setPunchAssignee(e.target.value)}
          />
          <CatalogField
            kind="CLOSED_MEDIUM"
            label={t("punchSheet")}
            value={punchSheetId}
            onChange={(v) => setPunchSheetId(String(v))}
            options={[
              { value: "", label: "—" },
              ...sheets.map((s) => ({
                value: s.id,
                label: `${s.drawingCode} rev ${s.revision}`,
              })),
            ]}
            emptyLabel={null}
          />
          <FieldRow cols={2}>
            <Field
              label={t("punchPinX")}
              preset="count"
              value={punchPinX}
              onChange={(e) => setPunchPinX(e.target.value)}
            />
            <Field
              label={t("punchPinY")}
              preset="count"
              value={punchPinY}
              onChange={(e) => setPunchPinY(e.target.value)}
            />
          </FieldRow>
          {bimEnabled ? (
            <FieldRow cols={2}>
              <Field
                label={t("bimIfc")}
                preset="shortText"
                value={punchIfc}
                onChange={(e) => setPunchIfc(e.target.value)}
              />
              <Field
                label={t("bimViewerUrl")}
                preset="shortText"
                value={punchViewerUrl}
                onChange={(e) => setPunchViewerUrl(e.target.value)}
              />
            </FieldRow>
          ) : null}
        </form>
      </ModalShell>
    </>
  );
}
