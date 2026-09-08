"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  parseApiError,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { fileToWorkforceImportBody, workforceFetch } from "../../../../lib/workforce-fetch";

type ImportRowResult = {
  index: number;
  status: "created" | "skipped" | "error";
  message: string;
};

type ImportResult = {
  dryRun: boolean;
  created: number;
  skipped: number;
  errors: number;
  rows: ImportRowResult[];
};

async function downloadExport(path: string, filename: string) {
  const res = await workforceFetch(path);
  if (!res.ok) {
    throw new Error(
      parseApiError(await res.text().catch(() => null), `Export failed (${res.status})`),
    );
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function postImport(
  path: string,
  body: { csv?: string; xlsxBase64?: string },
  dryRun: boolean,
): Promise<ImportResult> {
  const qs = dryRun ? "?dryRun=true" : "";
  const res = await workforceFetch(`${path}${qs}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      parseApiError(await res.text().catch(() => null), `Import failed (${res.status})`),
    );
  }
  return (await res.json()) as ImportResult;
}

function downloadBlob(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ROSTER_TEMPLATE =
  "fin,firstName,middleName,lastName,sex,birthDate,orgUnit,position,hireDate,workplace,satellites\n" +
  "1A2B3C4,Ali,Vali,Mammadov,MALE,1990-01-15,Resepşn,Qeydiyyatçı,2026-07-01,PRIMARY,industry_hotel_pms\n" +
  "5B6C7D8,Second,,Job,FEMALE,1992-03-20,Resepşn,Qeydiyyatçı,2026-07-01,ADDITIONAL,\n";

const ABSENCE_TEMPLATE =
  "staffCode,kind,startDate,endDate,note\n" +
  "493F2CAA,VACATION,2026-08-01,2026-08-14,Summer leave\n";

export default function WorkforceExportImportPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceExport");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rosterCsv, setRosterCsv] = useState("");
  const [rosterXlsx, setRosterXlsx] = useState<string | null>(null);
  const [rosterName, setRosterName] = useState<string | null>(null);
  const [absenceCsv, setAbsenceCsv] = useState("");
  const [absenceXlsx, setAbsenceXlsx] = useState<string | null>(null);
  const [absenceName, setAbsenceName] = useState<string | null>(null);
  const [rosterResult, setRosterResult] = useState<ImportResult | null>(null);
  const [absenceResult, setAbsenceResult] = useState<ImportResult | null>(null);

  const rosterInputRef = useRef<HTMLInputElement>(null);
  const absenceInputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = now.toISOString().slice(0, 10);

  const rosterReady = rosterCsv.trim().length > 0 || Boolean(rosterXlsx);
  const absenceReady = absenceCsv.trim().length > 0 || Boolean(absenceXlsx);

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

  async function runImport(
    kind: "roster" | "absences",
    body: { csv?: string; xlsxBase64?: string },
    dryRun: boolean,
  ) {
    if (!body.csv?.trim() && !body.xlsxBase64?.trim()) {
      setError(t("importNeedFile"));
      return;
    }
    const result = await postImport(`import/${kind}`, body, dryRun);
    if (kind === "roster") setRosterResult(result);
    else setAbsenceResult(result);
  }

  async function onPickFile(
    file: File | null,
    setCsv: (v: string) => void,
    setXlsx: (v: string | null) => void,
    setName: (v: string | null) => void,
    clearResult: () => void,
  ) {
    clearResult();
    if (!file) {
      setCsv("");
      setXlsx(null);
      setName(null);
      return;
    }
    const body = await fileToWorkforceImportBody(file);
    setCsv(body.csv ?? "");
    setXlsx(body.xlsxBase64 ?? null);
    setName(file.name);
  }

  if (!ready) return null;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? (
        <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-[#34495E]">{t("exportColumn")}</h2>
          <div className={`${CARD_CONTAINER_CLASS} p-4`}>
            <h3 className="text-sm font-semibold text-[#34495E]">{t("rosterTitle")}</h3>
            <p className="mt-1 text-xs text-[#7F8C8D]">{t("rosterHint")}</p>
            <button
              type="button"
              className={`${PRIMARY_BUTTON_CLASS} mt-4`}
              disabled={busy === "roster"}
              onClick={() =>
                void run("roster", () =>
                  downloadExport("export/roster?format=csv", "workforce-roster.csv"),
                )
              }
            >
              {busy === "roster" ? t("downloading") : t("downloadRoster")}
            </button>
          </div>
          <div className={`${CARD_CONTAINER_CLASS} p-4`}>
            <h3 className="text-sm font-semibold text-[#34495E]">{t("absencesTitle")}</h3>
            <p className="mt-1 text-xs text-[#7F8C8D]">{t("absencesHint")}</p>
            <button
              type="button"
              className={`${PRIMARY_BUTTON_CLASS} mt-4`}
              disabled={busy === "absences"}
              onClick={() =>
                void run("absences", () =>
                  downloadExport(
                    `export/absences?from=${from}&to=${to}`,
                    "workforce-absences.csv",
                  ),
                )
              }
            >
              {busy === "absences" ? t("downloading") : t("downloadAbsences")}
            </button>
          </div>
          <div className={`${CARD_CONTAINER_CLASS} p-4`}>
            <h3 className="text-sm font-semibold text-[#34495E]">{t("timesheetTitle")}</h3>
            <p className="mt-1 text-xs text-[#7F8C8D]">{t("timesheetHint")}</p>
            <button
              type="button"
              className={`${PRIMARY_BUTTON_CLASS} mt-4`}
              disabled={busy === "timesheet"}
              onClick={() =>
                void run("timesheet", () =>
                  downloadExport(
                    `export/timesheet?year=${year}&month=${month}`,
                    `workforce-timesheet-${year}-${String(month).padStart(2, "0")}.csv`,
                  ),
                )
              }
            >
              {busy === "timesheet" ? t("downloading") : t("downloadTimesheet")}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-[#34495E]">{t("importColumn")}</h2>
          <p className="text-xs text-[#7F8C8D]">{t("importHowTo")}</p>

          <ImportCard
            title={t("importRosterTitle")}
            hint={t("importRosterHint")}
            csv={rosterCsv}
            fileName={rosterName}
            result={rosterResult}
            busyDry={busy === "import-roster-dry"}
            busyApply={busy === "import-roster"}
            ready={rosterReady}
            inputRef={rosterInputRef}
            t={t}
            onCsvChange={(v) => {
              setRosterCsv(v);
              setRosterXlsx(null);
              setRosterName(null);
              setRosterResult(null);
            }}
            onPickClick={() => rosterInputRef.current?.click()}
            onFile={(file) =>
              void onPickFile(
                file,
                setRosterCsv,
                setRosterXlsx,
                setRosterName,
                () => setRosterResult(null),
              )
            }
            onLoadTemplate={() => {
              setRosterCsv(ROSTER_TEMPLATE);
              setRosterXlsx(null);
              setRosterName("workforce-roster-template.csv");
              setRosterResult(null);
              downloadBlob("workforce-roster-template.csv", ROSTER_TEMPLATE);
            }}
            onValidate={() =>
              void run("import-roster-dry", () =>
                runImport(
                  "roster",
                  {
                    ...(rosterCsv.trim() ? { csv: rosterCsv } : {}),
                    ...(rosterXlsx ? { xlsxBase64: rosterXlsx } : {}),
                  },
                  true,
                ),
              )
            }
            onApply={() =>
              void run("import-roster", () =>
                runImport(
                  "roster",
                  {
                    ...(rosterCsv.trim() ? { csv: rosterCsv } : {}),
                    ...(rosterXlsx ? { xlsxBase64: rosterXlsx } : {}),
                  },
                  false,
                ),
              )
            }
          />

          <ImportCard
            title={t("importAbsencesTitle")}
            hint={t("importAbsencesHint")}
            csv={absenceCsv}
            fileName={absenceName}
            result={absenceResult}
            busyDry={busy === "import-abs-dry"}
            busyApply={busy === "import-abs"}
            ready={absenceReady}
            inputRef={absenceInputRef}
            t={t}
            onCsvChange={(v) => {
              setAbsenceCsv(v);
              setAbsenceXlsx(null);
              setAbsenceName(null);
              setAbsenceResult(null);
            }}
            onPickClick={() => absenceInputRef.current?.click()}
            onFile={(file) =>
              void onPickFile(
                file,
                setAbsenceCsv,
                setAbsenceXlsx,
                setAbsenceName,
                () => setAbsenceResult(null),
              )
            }
            onLoadTemplate={() => {
              setAbsenceCsv(ABSENCE_TEMPLATE);
              setAbsenceXlsx(null);
              setAbsenceName("workforce-absences-template.csv");
              setAbsenceResult(null);
              downloadBlob("workforce-absences-template.csv", ABSENCE_TEMPLATE);
            }}
            onValidate={() =>
              void run("import-abs-dry", () =>
                runImport(
                  "absences",
                  {
                    ...(absenceCsv.trim() ? { csv: absenceCsv } : {}),
                    ...(absenceXlsx ? { xlsxBase64: absenceXlsx } : {}),
                  },
                  true,
                ),
              )
            }
            onApply={() =>
              void run("import-abs", () =>
                runImport(
                  "absences",
                  {
                    ...(absenceCsv.trim() ? { csv: absenceCsv } : {}),
                    ...(absenceXlsx ? { xlsxBase64: absenceXlsx } : {}),
                  },
                  false,
                ),
              )
            }
          />
        </section>
      </div>
    </>
  );
}

function ImportCard({
  title,
  hint,
  csv,
  fileName,
  result,
  busyDry,
  busyApply,
  ready,
  inputRef,
  t,
  onCsvChange,
  onPickClick,
  onFile,
  onLoadTemplate,
  onValidate,
  onApply,
}: {
  title: string;
  hint: string;
  csv: string;
  fileName: string | null;
  result: ImportResult | null;
  busyDry: boolean;
  busyApply: boolean;
  ready: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  t: ReturnType<typeof useTranslations<"workforceExport">>;
  onCsvChange: (v: string) => void;
  onPickClick: () => void;
  onFile: (file: File | null) => void;
  onLoadTemplate: () => void;
  onValidate: () => void;
  onApply: () => void;
}) {
  return (
    <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
      <h3 className="text-sm font-semibold text-[#34495E]">{title}</h3>
      <p className="text-xs text-[#7F8C8D]">{hint}</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onLoadTemplate}>
          {t("loadTemplate")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onPickClick}>
          {t("chooseFile")}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      <p className="text-xs text-[#34495E]">
        {fileName
          ? t("fileSelected", { name: fileName })
          : csv.trim()
            ? t("csvPasted")
            : t("fileNone")}
      </p>

      <label className="block text-xs font-medium text-[#34495E]">
        {t("csvEditor")}
        <textarea
          className="mt-1 block min-h-[7rem] w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 font-mono text-[12px] text-[#34495E]"
          value={csv}
          onChange={(e) => onCsvChange(e.target.value)}
          placeholder={t("csvPlaceholder")}
          spellCheck={false}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busyDry || !ready}
          onClick={onValidate}
        >
          {busyDry ? t("working") : t("validate")}
        </button>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busyApply || !ready}
          onClick={onApply}
        >
          {busyApply ? t("working") : t("apply")}
        </button>
      </div>
      {result ? <ImportResultPanel result={result} t={t} /> : null}
    </div>
  );
}

function ImportResultPanel({
  result,
  t,
}: {
  result: ImportResult;
  t: ReturnType<typeof useTranslations<"workforceExport">>;
}) {
  return (
    <div className="rounded-lg border border-[#EBEDF0] bg-[#F8FAFC] p-3 text-xs text-[#34495E]">
      <p className="font-medium">
        {result.dryRun ? t("resultDryRun") : t("resultApplied")}:{" "}
        {t("resultSummary", {
          created: result.created,
          skipped: result.skipped,
          errors: result.errors,
        })}
      </p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
        {result.rows.map((r) => (
          <li
            key={`${r.index}-${r.status}-${r.message}`}
            className={
              r.status === "error"
                ? "text-[#C0392B]"
                : r.status === "created"
                  ? "text-[#27AE60]"
                  : "text-[#7F8C8D]"
            }
          >
            #{r.index} {r.status}: {r.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
