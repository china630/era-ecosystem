"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  parseApiError,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { fileToWorkforceImportBody, workforceFetch } from "../../../../lib/workforce-fetch";

type StepStatus = "open" | "applied" | "skipped";

type StepSummary = {
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: number;
  outcome?: string;
};

type MigrationStep = {
  id: string;
  required: boolean;
  skippable: boolean;
  needsFile: boolean;
  writes: boolean;
  status: StepStatus;
  summary: StepSummary | null;
  updatedAt: string | null;
};

type StatusPayload = {
  steps: MigrationStep[];
  priorStepWarning: { stepId: string; message: string } | null;
  fields?: Record<string, { required: string[]; optional: string[] }>;
};

type RowResult = {
  index: number;
  status: "created" | "updated" | "skipped" | "error";
  message: string;
};

type ApplyResult = {
  dryRun: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: RowResult[];
};

type StepFile = { body: { csv?: string; xlsxBase64?: string }; name: string };

function bakuDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export default function WorkforceMigrationPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceMigration");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [selected, setSelected] = useState<string>("org-structure");
  const [files, setFiles] = useState<Record<string, StepFile>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const orgId = user?.organizationId ?? "";

  const loadStatus = useCallback(async () => {
    const res = await workforceFetch("migration");
    if (!res.ok) {
      throw new Error(
        parseApiError(await res.text().catch(() => null), `Status failed (${res.status})`),
      );
    }
    const json = (await res.json()) as StatusPayload;
    setStatus(json);
    return json;
  }, []);

  useEffect(() => {
    if (!ready || !orgId) return;
    setFiles({});
    setResult(null);
    setError(null);
    setFileNote(null);
    setSelected("org-structure");
    setStatus(null);
    loadStatus().catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load");
    });
  }, [ready, orgId, loadStatus]);

  const step = useMemo(
    () => status?.steps.find((s) => s.id === selected) ?? null,
    [status, selected],
  );
  const stepFile = selected ? files[selected] : undefined;

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(null);
    }
  }

  async function postStep(action: "preview" | "apply") {
    if (!step) return;
    if (step.needsFile && !stepFile) {
      setError(t("needFile"));
      return;
    }
    const res = await workforceFetch(`migration/${step.id}/${action}`, {
      method: "POST",
      body: JSON.stringify(stepFile?.body ?? {}),
    });
    if (!res.ok) {
      throw new Error(
        parseApiError(await res.text().catch(() => null), `${action} failed (${res.status})`),
      );
    }
    setResult((await res.json()) as ApplyResult);
    if (action === "apply") await loadStatus();
  }

  async function skipStep() {
    if (!step) return;
    const res = await workforceFetch(`migration/${step.id}/skip`, { method: "POST" });
    if (!res.ok) {
      throw new Error(
        parseApiError(await res.text().catch(() => null), `Skip failed (${res.status})`),
      );
    }
    setResult(null);
    await loadStatus();
  }

  if (!ready) return null;

  const last = step?.summary;
  const lastHasCounts =
    last &&
    last.outcome !== "skipped" &&
    (last.created != null || last.errors != null);

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader className="!mb-0" title={t("title")} subtitle={t("subtitle")} />
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {status?.priorStepWarning ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("priorWarning", { step: t(`step.${status.priorStepWarning.stepId}` as never) })}
        </p>
      ) : null}
      <div className={`${CARD_CONTAINER_CLASS} divide-y overflow-hidden`}>
        {(status?.steps ?? []).map((s, i) => {
          const errCount =
            s.summary && typeof s.summary.errors === "number" ? s.summary.errors : 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSelected(s.id);
                setResult(null);
                setError(null);
                setFileNote(null);
              }}
              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm ${
                selected === s.id ? "bg-slate-50" : ""
              }`}
            >
              <span className="font-medium">
                {i + 1}. {t(`step.${s.id}` as never)}
              </span>
              <span className="flex items-center gap-2">
                {s.status === "applied" && errCount > 0 ? (
                  <span className="text-xs text-red-700">
                    {t("badgeErrors", { count: errCount })}
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    s.status === "applied"
                      ? "bg-emerald-100 text-emerald-800"
                      : s.status === "skipped"
                        ? "bg-slate-200 text-slate-700"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {t(`badge.${s.status}`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {step ? (
        <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
          <h2 className="text-base font-semibold">{t(`step.${step.id}` as never)}</h2>
          <p className="text-sm text-slate-600">{t(`hint.${step.id}` as never)}</p>
          {step.updatedAt ? (
            <p className="text-xs text-slate-500">
              {t("lastUpdated", { date: bakuDate(step.updatedAt) })}
            </p>
          ) : null}
          {lastHasCounts && !result ? (
            <p className="text-xs text-slate-500">
              {t("lastSummary", {
                created: last.created ?? 0,
                updated: last.updated ?? 0,
                skipped: last.skipped ?? 0,
                errors: last.errors ?? 0,
              })}
            </p>
          ) : null}
          {step.needsFile ? (
            <div className="space-y-2">
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file || !step) return;
                  setFileBusy(true);
                  setFileNote(t("fileReading", { name: file.name }));
                  setError(null);
                  try {
                    const body = await fileToWorkforceImportBody(file);
                    const text = body.csv ?? "";
                    const rowCount = text
                      ? text.split(/\r?\n/).filter((l) => l.trim()).length
                      : undefined;
                    setFiles((prev) => ({
                      ...prev,
                      [step.id]: { body, name: file.name },
                    }));
                    setResult(null);
                    setFileNote(
                      t("fileReady", {
                        name: file.name,
                        size: Math.max(1, Math.round(file.size / 1024)),
                        rows: rowCount ?? "—",
                      }),
                    );
                  } catch (err) {
                    setFileNote(null);
                    setError(
                      err instanceof Error ? err.message : t("fileReadError"),
                    );
                  } finally {
                    setFileBusy(false);
                  }
                }}
              />
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={fileBusy}
                onClick={() => inputRef.current?.click()}
              >
                {fileBusy ? t("fileReadingShort") : t("chooseFile")}
              </button>
              <p className="text-xs text-slate-500">
                {fileNote
                  ? fileNote
                  : stepFile
                    ? t("fileSelected", { name: stepFile.name })
                    : t("fileNone")}
              </p>
              {status?.fields?.[step.id] ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <p>
                    <span className="font-medium">{t("fieldsRequired")}: </span>
                    {status.fields[step.id].required.join("; ") || "—"}
                  </p>
                  <p className="mt-1">
                    <span className="font-medium">{t("fieldsOptional")}: </span>
                    {status.fields[step.id].optional.join("; ") || "—"}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-600">{t("yearGridNoFile")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {step.writes ? (
              <>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={Boolean(busy) || (step.needsFile && !stepFile)}
                  onClick={() => run("preview", () => postStep("preview"))}
                >
                  {busy === "preview" ? t("sending") : t("preview")}
                </button>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={Boolean(busy) || (step.needsFile && !stepFile)}
                  onClick={() => run("apply", () => postStep("apply"))}
                >
                  {busy === "apply" ? t("sending") : t("apply")}
                </button>
              </>
            ) : null}
            {step.skippable ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={Boolean(busy)}
                onClick={() => run("skip", skipStep)}
              >
                {busy === "skip" ? t("working") : t("skip")}
              </button>
            ) : null}
          </div>
          {result ? (
            <div className="space-y-3">
              <p className="text-sm">
                {result.dryRun ? t("resultPreview") : t("resultApplied")}:{" "}
                {t("resultSummary", {
                  created: result.created,
                  updated: result.updated,
                  skipped: result.skipped,
                  errors: result.errors,
                })}
              </p>
              {result.rows.filter((r) => r.status === "error").length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="py-1 pr-3">{t("colRow")}</th>
                      <th className="py-1">{t("colMessage")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows
                      .filter((r) => r.status === "error")
                      .map((r) => (
                        <tr key={`${r.index}-${r.message}`}>
                          <td className="py-1 pr-3 align-top">{r.index}</td>
                          <td className="py-1 text-red-700">{r.message}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : null}
              {result.rows.filter((r) => r.status !== "error").length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-600">{t("sampleOk")}</p>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="py-1 pr-3">{t("colRow")}</th>
                        <th className="py-1">{t("colSample")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows
                        .filter((r) => r.status !== "error")
                        .slice(0, 8)
                        .map((r) => (
                          <tr key={`${r.index}-${r.status}`}>
                            <td className="py-1 pr-3 align-top">{r.index}</td>
                            <td className="py-1 text-slate-700">
                              {r.status}: {r.message}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
