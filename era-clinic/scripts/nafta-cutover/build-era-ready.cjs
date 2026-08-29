"use strict";

/**
 * Build NAFTA-ERA-READY/*.xlsx from D:\ERA-BACKUP\NAFTA-START dump.
 *
 *   node era-clinic/scripts/nafta-cutover/build-era-ready.cjs
 *   NAFTA_START=D:\ERA-BACKUP\NAFTA-START NAFTA_READY=D:\ERA-BACKUP\NAFTA-ERA-READY node era-clinic/scripts/nafta-cutover/build-era-ready.cjs
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
  mapPractitionerRole,
  mapPatientImportRow,
  loadPatientCardIndex,
  isUsgExam,
  loadNahiyeByProcedureId,
  slotNahiye,
} = require("./map.cjs");
const { parseLabDocxFile, testCodeFromPanel, panelFromName } = require("./parse-lab-docx.cjs");
const { eraCodeForWoAnalysis } = require("./wo-era-lab-map.cjs");
const { buildHrRoster, loadMappedRoster } = require("./build-hr-roster.cjs");

const START = process.env.NAFTA_START || path.join("D:", "ERA-BACKUP", "NAFTA-START");
const OUT = process.env.NAFTA_READY || path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY");
const DUMP = path.join(START, "clinic", "dump");

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
  throw new Error("xlsx package not found (install in era-hotel-pms or era-clinic)");
}

function readDumpJson(rel) {
  const alts = [rel];
  const swap = {
    "catalogs/treatments.json": "catalogs/treatments.json",
    "catalogs/rooms.json": "catalogs/rooms.json",
    "catalogs/doctors.json": "catalogs/doctors.json",
    "catalogs/analyses.json": "catalogs/analyses.json",
    "bulk/examination-forms.json": "bulk/examination-forms.json",
    "calendar/reservations-all.json": "calendar/reservations-all.json",
  };
  if (swap[rel]) alts.push(swap[rel]);
  for (const a of alts) {
    const file = path.join(DUMP, a);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  return null;
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
  return aoa.length - 1;
}

function slugName(name) {
  return String(name || "x")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function inHousePatient(p, today = CUTOVER) {
  const cin = ymd(p.checkInDate);
  const cout = ymd(p.checkOutDate);
  if (!cin) return false;
  return cin <= today && (!cout || cout >= today);
}

function main() {
  const XLSX = loadXlsx();
  const clinicOut = path.join(OUT, "clinic");
  fs.mkdirSync(clinicOut, { recursive: true });
  const KEEP_CURATED = [
    "25-Treatments.xlsx",
    "26-Rooms.xlsx",
    "27-Doctors.xlsx",
    "40-Procedure-Requirements.xlsx",
    "IMPORT-CHECKLIST.md",
    "rebuild-derived-report.json",
  ];
  if (fs.existsSync(clinicOut)) {
    for (const name of fs.readdirSync(clinicOut)) {
      if (KEEP_CURATED.includes(name)) continue;
      if (/\.(xlsx|csv)$/i.test(name)) fs.unlinkSync(path.join(clinicOut, name));
    }
  }
  fs.mkdirSync(path.join(OUT, "hr"), { recursive: true });
  const hrOut = path.join(OUT, "hr");
  for (const name of fs.readdirSync(hrOut)) {
    fs.unlinkSync(path.join(hrOut, name));
  }
  fs.mkdirSync(path.join(OUT, "hotel"), { recursive: true });

  const treatments = rowsOf(readDumpJson("catalogs/treatments.json"));
  const rooms = rowsOf(readDumpJson("catalogs/rooms.json"));
  const doctors = rowsOf(readDumpJson("catalogs/doctors.json"));
  const patients = rowsOf(readDumpJson("bulk/patients.json"));
  const analyses = rowsOf(readDumpJson("catalogs/analyses.json"));
  const calendarAll = readDumpJson("calendar/reservations-all.json");
  const slotsRaw = rowsOf(calendarAll);
  const nahiyeByProc = loadNahiyeByProcedureId(path.join(DUMP, "cards"));
  const cardIndex = loadPatientCardIndex(path.join(DUMP, "cards"));

  const curatedProcPath = path.join(clinicOut, "25-Treatments.xlsx");
  const useCuratedProcedures = fs.existsSync(curatedProcPath);
  let nProc = 0;
  let nRooms = 0;
  if (!useCuratedProcedures) {
    nProc = writeSheet(
      XLSX,
      path.join(clinicOut, "25-Treatments.xlsx"),
      HEADERS.procedures,
      treatments.map((t) => ({
        externalRef: `wo:treatment:${t.id}`,
        code: procedureCode(t.id),
        nameAz: t.procedureNameAz || t.procedureName || "",
        durationMin: t.duration ?? 10,
        resourceGapMinutes: 5,
        patientRestMinutes: t.breakForPatient ?? 15,
        price: t.price ?? 0,
      })),
    );
    nRooms = writeSheet(
      XLSX,
      path.join(clinicOut, "26-Rooms.xlsx"),
      HEADERS.rooms,
      rooms.map((r) => ({
        externalRef: `wo:room:${r.id}`,
        code: roomCode(r.id),
        name: r.name || "",
      })),
    );
  }

  const practRows = doctors.map((d) => ({
    externalRef: `wo:doctor:${d.id}`,
    fin: "",
    fullName: d.fullName || "",
    role: mapPractitionerRole(d.position),
  }));
  const { rows: hrMappedEarly } = loadMappedRoster(XLSX, START);
  if (hrMappedEarly.length) {
    for (const mapped of hrMappedEarly) {
      if (!mapped.fin || mapped.satellites !== "industry_clinic") continue;
      if (practRows.some((p) => p.fullName === mapped.fullName)) {
        const hit = practRows.find((p) => p.fullName === mapped.fullName);
        if (hit && !hit.fin) hit.fin = mapped.fin;
        continue;
      }
      practRows.push({
        externalRef: `wo:staff:${mapped.fin}`,
        fin: mapped.fin,
        fullName: mapped.fullName,
        role: mapPractitionerRole(mapped.position),
      });
    }
  }
  const nPract = writeSheet(
    XLSX,
    path.join(clinicOut, "27-Doctors.xlsx"),
    HEADERS.practitioners,
    practRows,
  );

  const liveIds = new Set();
  const patientsAll = process.env.NAFTA_PATIENTS_ALL !== "0";
  if (!patientsAll) {
    for (const p of patients) {
      if (inHousePatient(p)) liveIds.add(p.id);
    }
    for (const s of slotsRaw) {
      const date = ymd(s.date);
      if (isOpsSlotDate(date) && slotStatus(date) === "SCHEDULED") liveIds.add(s.patientId);
    }
    for (const r of rowsOf(readDumpJson("bulk/lab-results.json"))) {
      if (r.patientId) liveIds.add(r.patientId);
    }
  }
  const livePatients = patientsAll ? patients : patients.filter((p) => liveIds.has(p.id));
  const patientRows = livePatients.map((p) => mapPatientImportRow(p, cardIndex.get(p.id)));
  const checkInByWoId = new Map(
    livePatients.map((p, i) => [String(p.id), patientRows[i].checkIn || ""]),
  );
  const nPat = writeSheet(
    XLSX,
    path.join(clinicOut, "21-patients.xlsx"),
    HEADERS.patients,
    patientRows,
  );

  const quotaMap = new Map();
  const opsSlots = [];
  const archiveSlots = [];
  for (const s of slotsRaw) {
    const date = ymd(s.date);
    const status = slotStatus(date);
    const procedureCd = procedureCode(s.treatmentId);
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
    else archiveSlots.push(row);

    const key = `${patientRef}|${procedureCd}`;
    const cur = quotaMap.get(key) || { total: 0, used: 0 };
    cur.total += 1;
    if (status === "COMPLETED") cur.used += 1;
    quotaMap.set(key, cur);
  }

  const liveRefs = new Set(livePatients.map((p) => `wo:patient:${p.id}`));
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
    .filter((r) => liveRefs.has(r.patientRef));

  const nQuota = writeSheet(XLSX, path.join(clinicOut, "38-quotas.xlsx"), HEADERS.quotas, quotaRows);
  const nSlots = writeSheet(XLSX, path.join(clinicOut, "23-slots.xlsx"), HEADERS.slots, opsSlots);

  const labCatRows = [];
  const labCatSeen = new Set();
  function addLabCat(externalRef, code, name) {
    if (!code || labCatSeen.has(code)) return;
    labCatSeen.add(code);
    labCatRows.push({ externalRef, code, name: name || code, group: "lab" });
  }
  addLabCat("era:LAB-CBC", "LAB-CBC", "Qanın ümumi analizi");
  addLabCat("era:LAB-BIOCHEM", "LAB-BIOCHEM", "Biokimya");
  addLabCat("era:LAB-URINE", "LAB-URINE", "Sidiyin ümumi analizi");
  addLabCat("era:LAB-WO-FILE", "LAB-WO-FILE", "Lab panel (other Word)");
  for (const a of analyses) {
    if (Number(a.id) === 57) continue;
    const code = eraCodeForWoAnalysis(a.id);
    if (!code) continue;
    addLabCat(`wo:analysis:${a.id}`, code, a.name || code);
  }
  const nLabCat = writeSheet(
    XLSX,
    path.join(clinicOut, "29-Analyses.xlsx"),
    HEADERS.labCatalog,
    labCatRows,
  );

  const labDumpDir = path.join(START, "clinic", "dump", "files", "lab");
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

  function splitRef(range) {
    const m = String(range || "").match(/^([\d.,]+)\s*[-–]\s*([\d.,]+)/);
    return {
      refMin: m ? m[1].replace(",", ".") : "",
      refMax: m ? m[2].replace(",", ".") : "",
    };
  }

  const labMeta = rowsOf(readDumpJson("bulk/lab-results.json"));
  const labLineRows = [];
  let parsedOk = 0;
  let parsedEmpty = 0;
  const nLabOrd = writeSheet(
    XLSX,
    path.join(clinicOut, "24-lab-orders.xlsx"),
    HEADERS.labOrders,
    labMeta.map((r) => {
      const abs = labById.get(String(r.id));
      const panel = panelFromName(r.fileName || (abs ? path.basename(abs) : ""));
      let testCode = testCodeFromPanel(panel);
      if (panel === "OTHER" && r.labTestId) {
        testCode = eraCodeForWoAnalysis(r.labTestId) || testCode;
      }
      if (abs) {
        try {
          const parsed = parseLabDocxFile(abs);
          if (parsed.results && parsed.results.length) {
            parsedOk += 1;
            for (const line of parsed.results) {
              const refs = splitRef(line.refRange);
              labLineRows.push({
                orderRef: `wo:lab:${r.id}`,
                code: line.code,
                label: line.label,
                value: line.value,
                unit: line.unit || "",
                refMin: refs.refMin,
                refMax: refs.refMax,
              });
            }
          } else parsedEmpty += 1;
        } catch {
          parsedEmpty += 1;
        }
      } else parsedEmpty += 1;
      return {
        externalRef: `wo:lab:${r.id}`,
        patientRef: `wo:patient:${r.patientId}`,
        testCode,
        status: "COMPLETED",
        panel,
        takenAt: ymd(r.resultDate) || checkInByWoId.get(String(r.patientId)) || "",
      };
    }),
  );
  const nLabLines = writeSheet(
    XLSX,
    path.join(clinicOut, "39-lab-results.xlsx"),
    HEADERS.labResultLines,
    labLineRows,
  );

  const examForms = rowsOf(readDumpJson("bulk/examination-forms.json"));
  const usgRows = [];
  const dxRows = [];
  for (const form of examForms) {
    const takenAt = ymd(form.date) || checkInByWoId.get(String(form.patientId)) || "";
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
    path.join(clinicOut, "31-Diagnostics.xlsx"),
    HEADERS.diagnostics,
    usgRows,
  );
  const nDx = writeSheet(
    XLSX,
    path.join(clinicOut, "32-Diagnoses.xlsx"),
    HEADERS.diagnoses,
    dxRows,
  );

  const catDir = path.join(START, "clinic", "catalogs");
  for (const base of ["33-CheckUps", "34-CheckUp-Details", "35-Product-Groups", "36-Products"]) {
    for (const ext of [".xlsx", ".csv"]) {
      const src = path.join(catDir, base + ext);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(clinicOut, base + ext));
    }
  }

  const hrBuilt = buildHrRoster(XLSX, START, OUT);
  const nRoster = hrBuilt.n;

  const hotelSrc = path.join(START, "hotel");
  const hotelOut = path.join(OUT, "hotel");
  const archiveLeft = path.join(OUT, "hotel-archive");
  if (fs.existsSync(archiveLeft)) fs.rmSync(archiveLeft, { recursive: true, force: true });
  const slotsArchive = path.join(clinicOut, "06-slots-archive.xlsx");
  if (fs.existsSync(slotsArchive)) fs.unlinkSync(slotsArchive);
  fs.mkdirSync(hotelOut, { recursive: true });
  for (const name of fs.readdirSync(hotelOut)) {
    fs.unlinkSync(path.join(hotelOut, name));
  }
  if (fs.existsSync(hotelSrc)) {
    for (const name of fs.readdirSync(hotelSrc)) {
      if (/\.source\./i.test(name) || /\.md$/i.test(name)) continue;
      if (!/\.(xlsx|csv)$/i.test(name)) continue;
      fs.copyFileSync(path.join(hotelSrc, name), path.join(hotelOut, name));
    }
  }

  const c1Src = path.join(START, "1c");
  const c1Out = path.join(OUT, "1c");
  fs.mkdirSync(c1Out, { recursive: true });
  if (fs.existsSync(c1Src)) {
    for (const name of fs.readdirSync(c1Src)) {
      if (!/\.xlsx$/i.test(name)) continue;
      fs.copyFileSync(path.join(c1Src, name), path.join(c1Out, name));
    }
  }

  const summary = {
    cutover: CUTOVER,
    out: OUT,
    clinic: {
      procedures: nProc,
      rooms: nRooms,
      practitioners: nPract,
      patients: nPat,
      quotas: nQuota,
      slotsOps: nSlots,
      labCatalog: nLabCat,
      labOrders: nLabOrd,
      labResultLines: nLabLines,
      labParsedOrders: parsedOk,
      labEmptyParse: parsedEmpty,
      labAnalyteCodes: [...new Set(labLineRows.map((r) => r.code))].sort(),
      diagnostics: nDxImg,
      diagnoses: nDx,
    },
    roster: nRoster,
  };
  const readme = path.join(OUT, "README.txt");
  if (fs.existsSync(readme)) fs.unlinkSync(readme);
  fs.writeFileSync(path.join(OUT, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));

  const bridge = path.join(__dirname, "../../../era-hotel-pms/scripts/apply-wo-fo-guest-bridge.cjs");
  if (fs.existsSync(bridge)) {
    const r = require("child_process").spawnSync(process.execPath, [bridge], { stdio: "inherit" });
    if (r.status) process.exit(r.status);
  }
}

main();
