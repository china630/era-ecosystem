"use strict";

/**
 * Convert START HR workbooks → READY workforce import books.
 * Dates stay calendar-day strings YYYY-MM-DD (not Excel serials, not ISO timestamps).
 *
 *   node era-clinic/scripts/nafta-cutover/build-hr-roster.cjs
 */

const fs = require("fs");
const path = require("path");
const { HEADERS, mapRosterRow, mapOrgStructureRow } = require("./map.cjs");
const { stampDateCells } = require("./excel-date.cjs");
const { readyFile } = require("./pack-layout.cjs");

const START = process.env.NAFTA_START || path.join("D:", "ERA-BACKUP", "NAFTA-START");
const OUT = process.env.NAFTA_READY || path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY");

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

function findHrEmployeesPath(startRoot) {
  const dir = path.join(startRoot, "hr");
  if (!fs.existsSync(dir)) return null;
  const names = fs.readdirSync(dir).filter((n) => /\.xlsx$/i.test(n) && !n.startsWith("~$"));
  const updated = names.filter((n) => /yenil/i.test(n) && /siyah/i.test(n));
  if (updated.length) {
    updated.sort(
      (a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs,
    );
    return path.join(dir, updated[0]);
  }
  const classic = names.find((n) => n === "02-Employees.xlsx" || n === "37-Employees.xlsx");
  return classic ? path.join(dir, classic) : null;
}

function findOrgStructurePath(startRoot) {
  const dir = path.join(startRoot, "hr");
  if (!fs.existsSync(dir)) return null;
  const names = fs.readdirSync(dir).filter((n) => /\.xlsx$/i.test(n) && !n.startsWith("~$"));
  const hit = names.find((n) => /ştat|stat vahid|staff.?unit/i.test(n));
  return hit ? path.join(dir, hit) : null;
}

function loadMappedRoster(XLSX, startRoot) {
  const hrPath = findHrEmployeesPath(startRoot);
  if (!hrPath) return { path: null, rows: [] };
  const wb = XLSX.readFile(hrPath, { cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  return { path: hrPath, rows: raw.map(mapRosterRow).filter((r) => r.fin) };
}

function loadMappedOrgStructure(XLSX, startRoot) {
  const srcPath = findOrgStructurePath(startRoot);
  if (!srcPath) return { path: null, rows: [] };
  const wb = XLSX.readFile(srcPath, { cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  return {
    path: srcPath,
    rows: raw.map(mapOrgStructureRow).filter((r) => r.orgUnit && r.position),
  };
}

function writeRosterSheet(XLSX, outFile, headers, rows) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const aoa = [headers, ...rows.map((r) => headers.map((h) => (r[h] == null ? "" : r[h])))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  stampDateCells(XLSX, ws, headers, ["hireDate", "birthDate"]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "import");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(outFile, buf);
  return rows.length;
}

function writeSheet(XLSX, outFile, headers, rows) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const aoa = [headers, ...rows.map((r) => headers.map((h) => (r[h] == null ? "" : r[h])))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "import");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(outFile, buf);
  return rows.length;
}

function buildHrRoster(XLSX, startRoot, outRoot) {
  const hrDir = path.join(outRoot, "hr");
  fs.mkdirSync(hrDir, { recursive: true });
  for (const stale of ["hr-01-Employees.xlsx", "37-Employees.xlsx", "org-structure.xlsx"]) {
    const p = path.join(hrDir, stale);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const roster = loadMappedRoster(XLSX, startRoot);
  const org = loadMappedOrgStructure(XLSX, startRoot);
  const outRoster = readyFile(outRoot, "hrEmployees");
  const outOrg = readyFile(outRoot, "hrOrg");
  const nRoster = roster.path ? writeRosterSheet(XLSX, outRoster, HEADERS.roster, roster.rows) : 0;
  const nOrg = org.path ? writeSheet(XLSX, outOrg, HEADERS.orgStructure, org.rows) : 0;
  return {
    n: nRoster,
    srcPath: roster.path,
    outPath: roster.path ? outRoster : null,
    nOrg,
    orgSrcPath: org.path,
    orgOutPath: org.path ? outOrg : null,
  };
}

if (require.main === module) {
  const XLSX = loadXlsx();
  const result = buildHrRoster(XLSX, START, OUT);
  if (!result.srcPath && !result.orgSrcPath) {
    console.error("No START hr workbook found");
    process.exit(1);
  }
  const { rows } = loadMappedRoster(XLSX, START);
  console.log(
    JSON.stringify(
      {
        src: result.srcPath,
        out: result.outPath,
        rows: result.n,
        missingHire: rows.filter((r) => !r.hireDate).length,
        missingDob: rows.filter((r) => !r.birthDate).length,
        sexKnown: rows.filter((r) => r.sex === "MALE" || r.sex === "FEMALE").length,
        orgSrc: result.orgSrcPath,
        orgOut: result.orgOutPath,
        orgRows: result.nOrg,
      },
      null,
      2,
    ),
  );
}

module.exports = {
  findHrEmployeesPath,
  findOrgStructurePath,
  loadMappedRoster,
  loadMappedOrgStructure,
  buildHrRoster,
  writeRosterSheet,
};
