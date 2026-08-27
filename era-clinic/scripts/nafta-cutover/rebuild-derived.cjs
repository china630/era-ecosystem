"use strict";

/**
 * Rebuild derived clinic import books without touching curated #25/#26/#27.
 *
 *   node era-clinic/scripts/nafta-cutover/rebuild-derived.cjs
 *   NAFTA_PATIENTS_ALL=1 node era-clinic/scripts/nafta-cutover/rebuild-derived.cjs
 *
 * Outputs: 21, 23, 24, 29, 31, 32, 38, 39 + summary snippet + lab verify report.
 */

const fs = require("fs");
const path = require("path");
const {
  HEADERS,
  CUTOVER,
  ymd,
  procedureCode,
  roomCode,
  slotStatus,
  isOpsSlotDate,
  mapSex,
  isUsgExam,
  loadNahiyeByProcedureId,
  slotNahiye,
} = require("./map.cjs");
const { parseLabDocxFile, testCodeFromPanel, panelFromName } = require("./parse-lab-docx.cjs");
const { eraCodeForWoAnalysis, eraAnalyteCode } = require("./wo-era-lab-map.cjs");

const START = process.env.NAFTA_START || path.join("D:", "ERA-BACKUP", "NAFTA-START");
const OUT = process.env.NAFTA_READY || path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY");
const DUMP = path.join(START, "clinic", "dump");
const CLINIC_OUT = path.join(OUT, "clinic");
const SEED_PATH = path.join(__dirname, "../../prisma/seed-data/diagnostic-lab-catalog.json");

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

function readDumpJson(rel) {
  const file = path.join(DUMP, rel);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function rowsOf(doc) {
  if (!doc) return [];
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc.data)) return doc.data;
  return [];
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

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function baseName(s) {
  return String(s || "")
    .replace(/\s*\((жен\.|муж\.|Qadın|Kişi)\)\s*$/i, "")
    .trim();
}

function loadCuratedProcedureMap(XLSX) {
  const file = path.join(CLINIC_OUT, "25-Treatments.xlsx");
  if (!fs.existsSync(file)) return { codes: new Set(), woIdToCode: new Map() };
  const wb = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const codes = new Set();
  const woIdToCode = new Map();
  for (const row of rows) {
    const code = String(row.code || "").trim();
    if (code) codes.add(code);
    const ref = String(row.externalRef || "");
    const m = ref.match(/^wo:treatment:(\d+)$/);
    if (m && code) woIdToCode.set(Number(m[1]), code);
  }

  const woTreatments = rowsOf(readDumpJson("catalogs/treatments.json"));
  for (const row of rows) {
    const code = String(row.code || "").trim();
    if (!code) continue;
    const names = new Set([normName(row.nameAz), normName(baseName(row.nameAz))]);
    if (String(row.nameAz).includes("/")) {
      for (const part of String(row.nameAz).split(/\s*\/\s*/)) {
        names.add(normName(part));
        names.add(normName(baseName(part)));
      }
    }
    for (const t of woTreatments) {
      const tn = normName(t.procedureName || t.procedureNameAz);
      const tb = normName(baseName(t.procedureName || t.procedureNameAz));
      if (names.has(tn) || names.has(tb)) {
        woIdToCode.set(Number(t.id), code);
      }
    }
  }

  applyAplikasiyaAliases(woIdToCode, woTreatments, rows);

  return { codes, woIdToCode };
}

/** WO «Aplikasiya» → curated Naftalan vannası (same physical vannas). */
function applyAplikasiyaAliases(woIdToCode, woTreatments, curatedRows) {
  const qRow = curatedRows.find((r) => /naftalan.*qad/i.test(String(r.nameAz || "")));
  const mRow = curatedRows.find((r) => /naftalan.*kişi/i.test(String(r.nameAz || "")));
  const qCode = qRow ? String(qRow.code || "").trim() : "";
  const mCode = mRow ? String(mRow.code || "").trim() : "";
  if (!qCode && !mCode) return;

  for (const t of woTreatments) {
    if (normName(t.procedureName || t.procedureNameAz) !== "aplikasiya") continue;
    const roomNames = (t.rooms || []).map((r) => String(r.roomName || "")).join(" ");
    if (/qadın|жен/i.test(roomNames) && qCode) {
      woIdToCode.set(Number(t.id), qCode);
    } else if (/kişi|муж/i.test(roomNames) && mCode) {
      woIdToCode.set(Number(t.id), mCode);
    }
  }
}

function loadSeedLabIndex() {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  const panels = new Map();
  const analytes = new Set();
  for (const p of seed.labPanels || []) {
    panels.set(p.code, p.title?.az || p.title?.en || p.code);
    for (const a of p.analytes || []) {
      if (a.code) analytes.add(a.code);
    }
  }
  return { panels, analytes };
}

function resolveSlotProcedureCode(treatmentId, woIdToCode) {
  const mapped = woIdToCode.get(Number(treatmentId));
  if (mapped) return mapped;
  return null;
}

function splitRef(range) {
  const m = String(range || "").match(/^([\d.,]+)\s*[-–]\s*([\d.,]+)/);
  return {
    refMin: m ? m[1].replace(",", ".") : "",
    refMax: m ? m[2].replace(",", ".") : "",
  };
}

function main() {
  const XLSX = loadXlsx();
  fs.mkdirSync(CLINIC_OUT, { recursive: true });

  const { codes: curatedCodes, woIdToCode } = loadCuratedProcedureMap(XLSX);
  if (!curatedCodes.size) {
    console.warn("WARN: 25-Treatments.xlsx missing or empty — quotas/slots will use all WO-TR-* codes");
  }

  const patients = rowsOf(readDumpJson("bulk/patients.json"));
  const calendarAll = readDumpJson("calendar/reservations-all.json");
  const slotsRaw = rowsOf(calendarAll);
  const nahiyeByProc = loadNahiyeByProcedureId(path.join(DUMP, "cards"));
  const analyses = rowsOf(readDumpJson("catalogs/analyses.json"));
  const patientsAll = process.env.NAFTA_PATIENTS_ALL !== "0";

  const livePatients = patientsAll ? patients : patients;
  const nPat = writeSheet(
    XLSX,
    path.join(CLINIC_OUT, "21-patients.xlsx"),
    HEADERS.patients,
    livePatients.map((p) => ({
      externalRef: `wo:patient:${p.id}`,
      fullName: p.fullName || "",
      sex: mapSex(p.gender || p.sex),
      birthDate: ymd(p.birthDate),
      hotelResNo: p.reservationId ? String(p.reservationId) : "",
      roomNumber: p.reservationRoomNumber || "",
      checkIn: ymd(p.checkInDate),
      checkOut: ymd(p.checkOutDate),
      programCode: "",
    })),
  );

  let slotsDropped = 0;
  let slotsOrphanCodes = new Set();
  const quotaMap = new Map();
  const opsSlots = [];
  for (const s of slotsRaw) {
    const date = ymd(s.date);
    const status = slotStatus(date);
    const procedureCd =
      curatedCodes.size > 0
        ? resolveSlotProcedureCode(s.treatmentId, woIdToCode)
        : procedureCode(s.treatmentId);
    if (!procedureCd) {
      slotsDropped += 1;
      slotsOrphanCodes.add(procedureCode(s.treatmentId));
      continue;
    }
    const patientRef = `wo:patient:${s.patientId}`;
    const row = {
      externalRef: `wo:res:${s.id}`,
      date,
      startTime: String(s.startTime || "").slice(0, 8),
      patientRef,
      procedureCode: procedureCd,
      roomCode: roomCode(s.roomId),
      status,
      nahiye: slotNahiye(s, nahiyeByProc),
    };
    if (isOpsSlotDate(date) && status === "SCHEDULED") opsSlots.push(row);

    const key = `${patientRef}|${procedureCd}`;
    const cur = quotaMap.get(key) || { total: 0, used: 0 };
    cur.total += 1;
    if (status === "COMPLETED") cur.used += 1;
    quotaMap.set(key, cur);
  }

  const liveRefs = new Set(livePatients.map((p) => `wo:patient:${p.id}`));
  let quotaDropped = 0;
  const quotaRows = [...quotaMap.entries()]
    .map(([key, v]) => {
      const [patientRef, procedureCd] = key.split("|");
      return {
        patientRef,
        procedureCode: procedureCd,
        quotaTotal: v.total,
        quotaUsed: v.used,
        quotaLeft: Math.max(0, v.total - v.used),
      };
    })
    .filter((r) => {
      if (!liveRefs.has(r.patientRef)) {
        quotaDropped += 1;
        return false;
      }
      if (curatedCodes.size && !curatedCodes.has(r.procedureCode)) {
        quotaDropped += 1;
        return false;
      }
      return true;
    });

  const nQuota = writeSheet(XLSX, path.join(CLINIC_OUT, "38-quotas.xlsx"), HEADERS.quotas, quotaRows);
  const nSlots = writeSheet(XLSX, path.join(CLINIC_OUT, "23-slots.xlsx"), HEADERS.slots, opsSlots);

  const seedLab = loadSeedLabIndex();
  const labCatRows = [];
  const labCatSeen = new Set();
  function addLabCat(externalRef, code, name) {
    if (!code || labCatSeen.has(code)) return;
    labCatSeen.add(code);
    labCatRows.push({
      externalRef,
      code,
      name: name || seedLab.panels.get(code) || code,
      group: "lab",
    });
  }
  for (const [code, name] of seedLab.panels) {
    addLabCat(`era:${code}`, code, name);
  }
  for (const a of analyses) {
    if (Number(a.id) === 57) continue;
    const code = eraCodeForWoAnalysis(a.id);
    if (!code) continue;
    addLabCat(`wo:analysis:${a.id}`, code, a.name || code);
  }
  addLabCat("era:LAB-WO-FILE", "LAB-WO-FILE", "Lab panel (other Word)");

  const labDumpDir = path.join(DUMP, "files", "lab");
  const labById = new Map();
  if (fs.existsSync(labDumpDir)) {
    for (const name of fs.readdirSync(labDumpDir)) {
      const m = String(name).match(/^(\d+)_/);
      if (!m) continue;
      const abs = path.join(labDumpDir, name);
      try {
        if (fs.statSync(abs).isFile() && fs.statSync(abs).size >= 1024) labById.set(m[1], abs);
      } catch {
        /* skip */
      }
    }
  }

  const labMeta = rowsOf(readDumpJson("bulk/lab-results.json"));
  const labLineRows = [];
  let parsedOk = 0;
  const orderTestCodes = new Set();
  const nLabOrd = writeSheet(
    XLSX,
    path.join(CLINIC_OUT, "24-lab-orders.xlsx"),
    HEADERS.labOrders,
    labMeta.map((r) => {
      const abs = labById.get(String(r.id));
      const panel = panelFromName(r.fileName || (abs ? path.basename(abs) : ""));
      let testCode = testCodeFromPanel(panel);
      if (panel === "OTHER" && r.labTestId) {
        testCode = eraCodeForWoAnalysis(r.labTestId) || testCode;
      }
      orderTestCodes.add(testCode);
      if (abs) {
        try {
          const parsed = parseLabDocxFile(abs);
          if (parsed.results && parsed.results.length) {
            parsedOk += 1;
            for (const line of parsed.results) {
              const refs = splitRef(line.refRange);
              labLineRows.push({
                orderRef: `wo:lab:${r.id}`,
                code: eraAnalyteCode(line.code),
                label: line.label,
                value: line.value,
                unit: line.unit || "",
                refMin: refs.refMin,
                refMax: refs.refMax,
              });
            }
          }
        } catch {
          /* skip unparsed — user decision: ignore empty Word */
        }
      }
      return {
        externalRef: `wo:lab:${r.id}`,
        patientRef: `wo:patient:${r.patientId}`,
        testCode,
        status: "COMPLETED",
        panel,
        takenAt: ymd(r.resultDate),
      };
    }),
  );

  for (const code of orderTestCodes) {
    if (!labCatSeen.has(code)) {
      addLabCat(`era:import:${code}`, code, seedLab.panels.get(code) || code);
    }
  }
  const nLabCat = writeSheet(
    XLSX,
    path.join(CLINIC_OUT, "29-Analyses.xlsx"),
    HEADERS.labCatalog,
    labCatRows,
  );
  const nLabLines = writeSheet(
    XLSX,
    path.join(CLINIC_OUT, "39-lab-results.xlsx"),
    HEADERS.labResultLines,
    labLineRows,
  );

  const examForms = rowsOf(readDumpJson("bulk/examination-forms.json"));
  const usgRows = [];
  const dxRows = [];
  for (const form of examForms) {
    const takenAt = ymd(form.date);
    if (isUsgExam(form)) {
      usgRows.push({
        externalRef: `wo:usg:${form.id}`,
        patientRef: `wo:patient:${form.patientId}`,
        code: "USG",
        name: "USM",
        resultText: String(form.notes || "").trim(),
        takenAt,
      });
    }
    const note = String(form.notes || "").trim();
    if (note) {
      dxRows.push({
        patientRef: `wo:patient:${form.patientId}`,
        rawText: note,
        icd10: "",
        recordedAt: takenAt,
      });
    }
  }
  const nDxImg = writeSheet(
    XLSX,
    path.join(CLINIC_OUT, "31-Diagnostics.xlsx"),
    HEADERS.diagnostics,
    usgRows,
  );
  const nDx = writeSheet(
    XLSX,
    path.join(CLINIC_OUT, "32-Diagnoses.xlsx"),
    HEADERS.diagnoses,
    dxRows,
  );

  const analyteCodes = [...new Set(labLineRows.map((r) => r.code))].sort();
  const missAnalytes = analyteCodes.filter((c) => !seedLab.analytes.has(c));
  const missOrderPanels = [...orderTestCodes].filter((c) => !seedLab.panels.has(c) && c !== "LAB-WO-FILE");
  const catCodes = labCatRows.map((r) => r.code);
  const missCatInSeed = catCodes.filter((c) => !seedLab.panels.has(c) && !c.startsWith("LAB-WO"));

  const orderRefs = new Set(labMeta.map((r) => `wo:lab:${r.id}`));
  const orphanResultRefs = labLineRows.filter((r) => !orderRefs.has(r.orderRef)).length;

  const woTreatments = rowsOf(readDumpJson("catalogs/treatments.json"));
  const woNameById = new Map(woTreatments.map((t) => [Number(t.id), t.procedureName || t.procedureNameAz || ""]));
  const opsMissing = new Map();
  for (const s of slotsRaw) {
    const date = ymd(s.date);
    if (!isOpsSlotDate(date) || slotStatus(date) !== "SCHEDULED") continue;
    const procedureCd = resolveSlotProcedureCode(s.treatmentId, woIdToCode);
    if (procedureCd) continue;
    const tid = Number(s.treatmentId);
    opsMissing.set(tid, (opsMissing.get(tid) || 0) + 1);
  }
  const opsWeekMissingTreatments = [...opsMissing.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([id, count]) => ({
      treatmentId: id,
      woCode: procedureCode(id),
      name: woNameById.get(id) || "",
      slotCount: count,
    }));

  const report = {
    builtAt: new Date().toISOString(),
    cutover: CUTOVER,
    patients: nPat,
    quotas: {
      rows: nQuota,
      dropped: quotaDropped,
      curatedProcedureCodes: curatedCodes.size,
      matchPct: curatedCodes.size
        ? Math.round((nQuota / (nQuota + quotaDropped || 1)) * 1000) / 10
        : 100,
    },
    slots: {
      opsRows: nSlots,
      droppedUnmapped: slotsDropped,
      orphanWoCodes: [...slotsOrphanCodes].sort().slice(0, 30),
      opsWeekMissingTreatments,
    },
    lab: {
      catalogRows: nLabCat,
      orders: nLabOrd,
      resultLines: nLabLines,
      parsedOrders: parsedOk,
      ordersWithoutLines: nLabOrd - parsedOk,
      orphanResultRefs,
      orderTestCodes: orderTestCodes.size,
      missOrderPanelsNotInSeed: missOrderPanels,
      missAnalytesNotInSeed: missAnalytes.length,
      missAnalytesSample: missAnalytes.slice(0, 25),
      missCatNotInSeed: missCatInSeed,
    },
    diagnostics: nDxImg,
    diagnoses: nDx,
  };

  fs.writeFileSync(path.join(CLINIC_OUT, "rebuild-derived-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
