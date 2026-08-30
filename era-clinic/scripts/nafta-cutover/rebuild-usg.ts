/**
 * Write NAFTA-ERA-READY clinic/29-Diagnostics.xlsx (USG). Skip diagnoses leftover.
 * Parses WO Qeyd into resultJson lines. Run: node scripts/nafta-cutover/rebuild-usg.cjs
 */

import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { mapWoUsgServiceCode, woUsgServiceTitle, parseWoUsgNote } from "../../src/lib/import/parse-wo-usg-note";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const START = process.env.NAFTA_START || path.join("D:", "ERA-BACKUP", "NAFTA-START");
const OUT = process.env.NAFTA_READY || path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY");
const DUMP = path.join(START, "clinic", "dump");

const { FILES } = require("./pack-layout.cjs") as { FILES: Record<string, string> };

const { HEADERS, ymd, mapPatientImportRow, loadPatientCardIndex } = require("./map.cjs") as {
  HEADERS: { diagnostics: string[]; diagnoses: string[]; patients: string[] };
  ymd: (v: unknown) => string;
  mapPatientImportRow: (list: unknown, card: unknown) => { checkIn?: string };
  loadPatientCardIndex: (dir: string) => Map<number, unknown>;
};

function loadXlsx(): typeof import("xlsx") {
  const candidates = [
    path.join(__dirname, "../../../era-hotel-pms/node_modules/xlsx"),
    path.join(__dirname, "../../node_modules/xlsx"),
    "xlsx",
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* next */
    }
  }
  throw new Error("xlsx package not found");
}

function readDumpJson(rel: string): unknown {
  const file = path.join(DUMP, rel);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function rowsOf(doc: unknown): Array<Record<string, unknown>> {
  if (!doc) return [];
  if (Array.isArray(doc)) return doc as Array<Record<string, unknown>>;
  if (typeof doc === "object" && Array.isArray((doc as { data?: unknown }).data)) {
    return (doc as { data: Array<Record<string, unknown>> }).data;
  }
  return [];
}

function writeSheet(
  XLSX: typeof import("xlsx"),
  outFile: string,
  headers: string[],
  rows: Array<Record<string, unknown>>,
): number {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const aoa = [headers, ...rows.map((r) => headers.map((h) => (r[h] == null ? "" : r[h])))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "import");
  XLSX.writeFile(wb, outFile);
  return rows.length;
}

function main() {
  const XLSX = loadXlsx();
  const patients = rowsOf(readDumpJson("bulk/patients.json"));
  const cardIndex = loadPatientCardIndex(path.join(DUMP, "cards"));
  const patientRows = patients.map((p) => mapPatientImportRow(p, cardIndex.get(Number(p.id))));
  const checkInByWoId = new Map(
    patients.map((p, i) => [String(p.id), patientRows[i].checkIn || ""]),
  );

  const examForms = rowsOf(readDumpJson("bulk/examination-forms.json"));
  const usgRows: Array<Record<string, unknown>> = [];
  const dxRows: Array<Record<string, unknown>> = [];
  const usgByCode: Record<string, number> = {};
  const woNameCounts: Record<string, number> = {};
  let parsedFields = 0;
  for (const form of examForms) {
    const takenAt = ymd(form.date) || checkInByWoId.get(String(form.patientId)) || "";
    const usgCode = mapWoUsgServiceCode(form);
    const note = String(form.notes || "").trim();
    const diagnoses = Array.isArray(form.diagnoses) ? form.diagnoses : [];
    const woName = diagnoses
      .map((d) => {
        if (!d || typeof d !== "object") return "";
        const row = d as { diagnosisName?: unknown; name?: unknown };
        return String(row.diagnosisName || row.name || "");
      })
      .filter(Boolean)
      .join(" | ") || "(empty)";
    woNameCounts[woName] = (woNameCounts[woName] || 0) + 1;
    if (usgCode) {
      const title = woUsgServiceTitle(usgCode);
      const lines = parseWoUsgNote(usgCode, note);
      parsedFields += lines.length;
      usgByCode[usgCode] = (usgByCode[usgCode] || 0) + 1;
      usgRows.push({
        externalRef: `wo:usg:${form.id}`,
        patientRef: `wo:patient:${form.patientId}`,
        code: usgCode,
        name: title.az,
        resultText: note,
        resultJson: JSON.stringify(lines),
        takenAt,
      });
    } else if (note) {
      dxRows.push({
        patientRef: `wo:patient:${form.patientId}`,
        rawText: note,
        icd10: "",
        recordedAt: takenAt,
      });
    }
  }

  const diagnostics = writeSheet(XLSX, path.join(OUT, FILES.clinicDiagnostics), HEADERS.diagnostics, usgRows);
  const diagnosesOut = 0;
  const sample2019 = usgRows
    .filter((r) => r.patientRef === "wo:patient:2019")
    .map((r) => ({
      externalRef: r.externalRef,
      code: r.code,
      fieldCodes: (JSON.parse(String(r.resultJson || "[]")) as Array<{ code: string }>).map((l) => l.code),
    }));
  const report = { diagnostics, diagnoses: diagnosesOut, usgByCode, woNameCounts, parsedFields, sample2019 };
  fs.writeFileSync(path.join(OUT, "clinic", "rebuild-usg-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
