"use strict";

/**
 * Report Nafta intake checklist groups from WO card dumps (slices.diagnostics).
 * Does NOT write a second USG import workbook — reconciliation only.
 *
 *   node era-clinic/scripts/nafta-cutover/rebuild-intake.cjs
 *   node era-clinic/scripts/nafta-cutover/rebuild-intake.cjs --xlsx
 */

const fs = require("fs");
const path = require("path");
const {
  NAFTA_INTAKE_SLOT_CODES,
  isNaftaIntakeGroupName,
  mapWoIntakeProcedureName,
  naftaIntakeSlotTitle,
} = require("./wo-era-intake-map.cjs");

const START = process.env.NAFTA_START || path.join("D:", "ERA-BACKUP", "NAFTA-START");
const OUT = process.env.NAFTA_READY || path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY");
const CARDS = path.join(START, "clinic", "dump", "cards");
const writeXlsx = process.argv.includes("--xlsx");

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

function listCardFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d+\.json$/i.test(f))
    .map((f) => path.join(dir, f));
}

function main() {
  const files = listCardFiles(CARDS);
  const lines = [];
  const groupNameCounts = {};
  const lineCodeCounts = {};
  const unmappedNames = {};
  let groupsCanon4 = 0;
  let groupsOther = 0;
  let groupsIntakeNamed = 0;
  const spot = { "2152": null, "2019": null };

  for (const file of files) {
    const patientRef = path.basename(file, ".json");
    let card;
    try {
      card = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      console.warn("skip bad json", file, e.message);
      continue;
    }
    const diagnostics = card?.slices?.diagnostics;
    if (!Array.isArray(diagnostics) || diagnostics.length === 0) continue;

    for (const group of diagnostics) {
      const groupName = String(group.groupName || group.name || "");
      const groupId = group.groupId ?? group.id ?? "";
      groupNameCounts[groupName] = (groupNameCounts[groupName] || 0) + 1;
      const intakeNamed = isNaftaIntakeGroupName(groupName);
      if (intakeNamed) groupsIntakeNamed += 1;

      const procedures = Array.isArray(group.procedures) ? group.procedures : [];
      const mapped = [];
      for (const proc of procedures) {
        const woName = String(proc.procedureName || proc.name || "");
        const lineCode = mapWoIntakeProcedureName(woName);
        if (lineCode) {
          lineCodeCounts[lineCode] = (lineCodeCounts[lineCode] || 0) + 1;
          mapped.push(lineCode);
        } else if (woName.trim()) {
          unmappedNames[woName] = (unmappedNames[woName] || 0) + 1;
        }
        const row = {
          patientRef,
          groupId,
          groupName,
          treatmentId: proc.treatmentId ?? "",
          woName,
          lineCode: lineCode || "",
          takenAt: proc.date || "",
          room: proc.selectedRoomName || "",
        };
        lines.push(row);
      }

      const uniqueSlots = [...new Set(mapped)];
      const isCanon =
        intakeNamed &&
        uniqueSlots.length === 4 &&
        NAFTA_INTAKE_SLOT_CODES.every((c) => uniqueSlots.includes(c));
      if (isCanon) groupsCanon4 += 1;
      else if (intakeNamed) groupsOther += 1;

      if (spot[patientRef] === null && intakeNamed) {
        spot[patientRef] = {
          groupId,
          groupName,
          procedureCount: procedures.length,
          mappedSlots: uniqueSlots,
          isCanon,
          procedures: procedures.map((p) => ({
            name: p.procedureName,
            code: mapWoIntakeProcedureName(String(p.procedureName || "")),
            treatmentId: p.treatmentId,
            date: p.date,
          })),
        };
      }
    }
  }

  const report = {
    cardsScanned: files.length,
    diagnosticLines: lines.length,
    groupsIntakeNamed,
    groupsCanon4,
    groupsIntakeNonCanon: groupsOther,
    lineCodeCounts,
    groupNameCounts,
    unmappedTop: Object.entries(unmappedNames)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30),
    spotCheck: spot,
    slotTitles: Object.fromEntries(
      NAFTA_INTAKE_SLOT_CODES.map((c) => [c, naftaIntakeSlotTitle(c)]),
    ),
  };

  const outDir = path.join(OUT, "clinic", "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "intake-checklist-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log("[rebuild-intake] report", reportPath);
  console.log(
    JSON.stringify(
      {
        cardsScanned: report.cardsScanned,
        diagnosticLines: report.diagnosticLines,
        groupsIntakeNamed: report.groupsIntakeNamed,
        groupsCanon4: report.groupsCanon4,
        groupsIntakeNonCanon: report.groupsIntakeNonCanon,
        lineCodeCounts: report.lineCodeCounts,
        spotCheck: report.spotCheck,
      },
      null,
      2,
    ),
  );

  if (writeXlsx) {
    const XLSX = loadXlsx();
    const headers = [
      "patientRef",
      "groupId",
      "groupName",
      "treatmentId",
      "woName",
      "lineCode",
      "takenAt",
      "room",
    ];
    const aoa = [headers, ...lines.map((r) => headers.map((h) => (r[h] == null ? "" : r[h])))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, "intake", ws);
    const xlsxPath = path.join(outDir, "intake-checklist-lines.xlsx");
    XLSX.writeFile(wb, xlsxPath);
    console.log("[rebuild-intake] xlsx", xlsxPath, "rows=", lines.length);
  }
}

main();
