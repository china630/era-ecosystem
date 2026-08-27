/**
 * Build clinic #27 from human roster + HR FIN match.
 *
 * SSOT: NAFTA-START/clinic/reports/27-practitioners-roster.json
 * Output: NAFTA-ERA-READY/clinic/27-Doctors.xlsx
 *
 *   node era-clinic/scripts/nafta-cutover/build-practitioners-import.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { HEADERS, mapRosterRow } = require("./map.cjs");

const START = process.env.NAFTA_START || path.join("D:", "ERA-BACKUP", "NAFTA-START");
const READY = process.env.NAFTA_READY || path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY");
const ROSTER = path.join(START, "clinic", "reports", "27-practitioners-roster.json");
const HR_PATH = path.join(START, "hr", "37-Employees.xlsx");
const MIRROR = path.join(START, "clinic", "reports", "era-import");

function loadXlsx() {
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

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-zəıöüğşç0-9\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(fullName) {
  const parts = norm(fullName).split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return [parts[0], parts[parts.length - 1]];
  }
  return parts;
}

function loadHrIndex(XLSX) {
  if (!fs.existsSync(HR_PATH)) return [];
  const wb = XLSX.readFile(HR_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" }).map(mapRosterRow).filter((r) => r.fin);
}

function findFin(fullName, hrRows) {
  const [a, b] = nameTokens(fullName);
  if (!a || !b) return null;
  const hits = hrRows.filter((h) => {
    const n = norm(h.fullName);
    return n.includes(a) && n.includes(b);
  });
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    const exact = hits.find((h) => norm(h.fullName) === norm(fullName));
    return exact || hits[0];
  }
  return null;
}

function writeSheet(XLSX, outFile, headers, rows) {
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
  if (!fs.existsSync(ROSTER)) {
    throw new Error(`Missing roster SSOT: ${ROSTER}`);
  }
  const roster = JSON.parse(fs.readFileSync(ROSTER, "utf8"));
  const hrRows = loadHrIndex(XLSX);
  const outRows = [];
  const report = { matchedFin: [], missingFin: [], reception: [] };

  for (const p of roster.practitioners || []) {
    const hr = findFin(p.fullName, hrRows);
    const fin = hr?.fin || "";
    const externalRef =
      p.woDoctorId != null ? `wo:doctor:${p.woDoctorId}` : fin ? `hr:staff:${fin}` : `nafta:practitioner:${norm(p.fullName)}`;
    outRows.push({
      externalRef,
      fin,
      fullName: p.fullName,
      role: p.role || "DOCTOR",
    });
    if (fin) report.matchedFin.push({ fullName: p.fullName, fin, hrName: hr.fullName, titleAz: p.titleAz });
    else report.missingFin.push({ fullName: p.fullName, titleAz: p.titleAz });
  }

  for (const r of roster.clinicalReception || []) {
    const hr = findFin(r.fullName, hrRows);
    report.reception.push({
      fullName: r.fullName,
      titleAz: r.titleAz,
      fin: hr?.fin || "",
      note: "HR/CP workforce — not in 27-Doctors wizard",
    });
  }

  const outReady = path.join(READY, "clinic", "27-Doctors.xlsx");
  const outMirror = path.join(MIRROR, "27-Doctors.xlsx");
  const n = writeSheet(XLSX, outReady, HEADERS.practitioners, outRows);
  writeSheet(XLSX, outMirror, HEADERS.practitioners, outRows);

  fs.mkdirSync(MIRROR, { recursive: true });
  const manifest = {
    builtAt: new Date().toISOString(),
    source: ROSTER,
    practitioners: n,
    report,
  };
  fs.writeFileSync(path.join(MIRROR, "27-practitioners-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
  if (report.missingFin.length) process.exitCode = 1;
}

main();
