"use strict";

/**
 * Build NAFTA-ERA-READY/*.xlsx from D:\ERA-BACKUP\NAFTA-START dump.
 *
 *   node era-clinic/scripts/nafta-cutover/build-era-ready.cjs --domain=clinic
 *   node era-clinic/scripts/nafta-cutover/build-era-ready.cjs --domain=hr
 *   node era-clinic/scripts/nafta-cutover/build-era-ready.cjs --domain=hotel
 *
 * Default --domain=clinic (does not wipe hotel/hr). Never run --domain=all
 * unless you intend to recopy every domain from START.
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
  loadNahiyeByProcedureId,
  slotNahiye,
} = require("./map.cjs");
const { parseLabDocxFile, testCodeFromPanel, panelFromName } = require("./parse-lab-docx.cjs");
const { eraCodeForWoAnalysis } = require("./wo-era-lab-map.cjs");
const { buildHrRoster, loadMappedRoster } = require("./build-hr-roster.cjs");
const {
  FILES,
  CLINIC_KEEP_CURATED,
  HOTEL_COPY_KEYS,
  FNB_COPY_KEYS,
  RETAIL_COPY_KEYS,
  C1_COPY_KEYS,
} = require("./pack-layout.cjs");
const { writeSheet, writeSheetChunks } = require("./xlsx-write.cjs");
const { overlayPatientProgramCodes, loadEnrichedStamps } = require("./stamp-clinic-program.cjs");

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

function slugName(name) {
  return String(name || "x")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function parseDomains() {
  const argv = process.argv.slice(2);
  let raw = "";
  const eq = argv.find((a) => a.startsWith("--domain="));
  if (eq) raw = eq.slice("--domain=".length);
  else {
    const i = argv.indexOf("--domain");
    if (i >= 0) raw = String(argv[i + 1] || "");
  }
  raw = raw.trim().toLowerCase();
  if (!raw) return new Set(["clinic"]);
  if (raw === "all") {
    console.warn("WARN: --domain=all recopies hotel/fnb/retail/1c from START and rebuilds clinic+hr");
    return new Set(["hr", "hotel", "clinic", "fnb", "retail", "1c"]);
  }
  const allowed = new Set(["hr", "hotel", "clinic", "fnb", "retail", "1c"]);
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (!allowed.has(p)) {
      console.error("Unknown --domain", p, "(use hr|hotel|clinic|fnb|retail|1c|all)");
      process.exit(1);
    }
  }
  return new Set(parts);
}

function copyRel(srcRoot, destRoot, rel) {
  const src = path.join(srcRoot, rel);
  if (!fs.existsSync(src)) return false;
  const dest = path.join(destRoot, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function copyKeys(srcRoot, destRoot, keys) {
  let n = 0;
  for (const key of keys) {
    if (copyRel(srcRoot, destRoot, FILES[key])) n += 1;
  }
  return n;
}

function inHousePatient(p, today = CUTOVER) {
  const cin = ymd(p.checkInDate);
  const cout = ymd(p.checkOutDate);
  if (!cin) return false;
  return cin <= today && (!cout || cout >= today);
}

function main() {
  const domains = parseDomains();
  const XLSX = loadXlsx();
  const clinicOut = path.join(OUT, "clinic");
  let nProc = 0;
  let nRooms = 0;
  let nPract = 0;
  let nPat = 0;
  let nQuota = 0;
  let nSlots = 0;
  let nLabCat = 0;
  let nLabOrd = 0;
  let nLabLines = 0;
  let parsedOk = 0;
  let parsedEmpty = 0;
  let nDxImg = 0;
  let nDx = 0;
  let labLineRows = [];

  if (domains.has("clinic")) {
  fs.mkdirSync(clinicOut, { recursive: true });
  const KEEP_CURATED = new Set([
    ...CLINIC_KEEP_CURATED,
    path.basename(FILES.clinicPhysio),
    path.basename(FILES.clinicTemplates),
    "README.md",
    "IMPORT-CHECKLIST.md",
    "rebuild-derived-report.json",
    "rebuild-usg-report.json",
  ]);
  if (fs.existsSync(clinicOut)) {
    for (const name of fs.readdirSync(clinicOut)) {
      if (KEEP_CURATED.has(name)) continue;
      const fp = path.join(clinicOut, name);
      if (!fs.statSync(fp).isFile()) continue;
      if (/\.(xlsx|csv)$/i.test(name)) fs.unlinkSync(fp);
    }
  }

  const treatments = rowsOf(readDumpJson("catalogs/treatments.json"));
  const rooms = rowsOf(readDumpJson("catalogs/rooms.json"));
  const doctors = rowsOf(readDumpJson("catalogs/doctors.json"));
  const patients = rowsOf(readDumpJson("bulk/patients.json"));
  const analyses = rowsOf(readDumpJson("catalogs/analyses.json"));
  const calendarAll = readDumpJson("calendar/reservations-all.json");
  const slotsRaw = rowsOf(calendarAll);
  const nahiyeByProc = loadNahiyeByProcedureId(path.join(DUMP, "cards"));
  const cardIndex = loadPatientCardIndex(path.join(DUMP, "cards"));

  const curatedProcPath = path.join(OUT, FILES.clinicTreatments);
  const useCuratedProcedures = fs.existsSync(curatedProcPath);
  if (!useCuratedProcedures) {
    nProc = writeSheet(
      XLSX,
      path.join(OUT, FILES.clinicTreatments),
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
      path.join(OUT, FILES.clinicRooms),
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
  const curatedDoctors = path.join(OUT, FILES.clinicDoctors);
  if (!fs.existsSync(curatedDoctors)) {
    nPract = writeSheet(
      XLSX,
      curatedDoctors,
      HEADERS.practitioners,
      practRows,
    );
  }

  const liveIds = new Set();
  const patientsAll = process.env.NAFTA_PATIENTS_ALL !== "0";
  if (!patientsAll) {
    for (const p of patients) {
      if (inHousePatient(p)) liveIds.add(p.id);
    }
    for (const s of slotsRaw) {
      const date = ymd(s.date);
      if (isOpsSlotDate(date) && slotStatus(date, String(s.startTime || "").slice(0, 8)) === "SCHEDULED") {
        liveIds.add(s.patientId);
      }
    }
    for (const r of rowsOf(readDumpJson("bulk/lab-results.json"))) {
      if (r.patientId) liveIds.add(r.patientId);
    }
  }
  const livePatients = patientsAll ? patients : patients.filter((p) => liveIds.has(p.id));
  const patientRows = livePatients.map((p) => mapPatientImportRow(p, cardIndex.get(p.id)));
  const pkgStamps = loadEnrichedStamps();
  if (pkgStamps.length) overlayPatientProgramCodes(patientRows, pkgStamps);
  const checkInByWoId = new Map(
    livePatients.map((p, i) => [String(p.id), patientRows[i].checkIn || ""]),
  );
  nPat = writeSheet(
    XLSX,
    path.join(OUT, FILES.clinicPatients),
    HEADERS.patients,
    patientRows,
  );

  const quotaMap = new Map();
  const allSlots = [];
  for (const s of slotsRaw) {
    const date = ymd(s.date);
    const startTime = String(s.startTime || "").slice(0, 8);
    const status = slotStatus(date, startTime);
    const procedureCd = procedureCode(s.treatmentId);
    const patientRef = `wo:patient:${s.patientId}`;
    const row = {
      externalRef: `wo:res:${s.id}`,
      date,
      startTime,
      patientRef,
      procedureCode: procedureCd,
      roomCode: roomCode(s.roomId),
      status,
      nahiye: slotNahiye(s, nahiyeByProc),
    };
    allSlots.push(row);

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

  nQuota = writeSheet(XLSX, path.join(OUT, FILES.clinicQuotas), HEADERS.quotas, quotaRows);
  const historicalSlots = allSlots.filter((r) => r.status === "COMPLETED");
  nSlots = writeSheetChunks(XLSX, path.join(OUT, FILES.clinicSlots), HEADERS.slots, historicalSlots);

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
  nLabCat = writeSheet(
    XLSX,
    path.join(OUT, FILES.clinicCatalog),
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
  labLineRows = [];
  parsedOk = 0;
  parsedEmpty = 0;
  nLabOrd = writeSheet(
    XLSX,
    path.join(OUT, FILES.clinicLabOrders),
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
  nLabLines = writeSheet(
    XLSX,
    path.join(OUT, FILES.clinicLabResults),
    HEADERS.labResultLines,
    labLineRows,
  );

  const usgRun = require("child_process").spawnSync(process.execPath, [path.join(__dirname, "rebuild-usg.cjs")], {
    stdio: "inherit",
  });
  if (usgRun.status) process.exit(usgRun.status);
  const usgReport = JSON.parse(fs.readFileSync(path.join(clinicOut, "rebuild-usg-report.json"), "utf8"));
  nDxImg = usgReport.diagnostics;
  nDx = usgReport.diagnoses;
  } // domain clinic

  let nRoster = 0;
  if (domains.has("hr")) {
    const hrBuilt = buildHrRoster(XLSX, START, OUT);
    nRoster = hrBuilt.n;
  }

  if (domains.has("hotel")) {
    copyKeys(START, OUT, HOTEL_COPY_KEYS);
  }
  if (domains.has("fnb")) {
    copyKeys(START, OUT, FNB_COPY_KEYS);
  }
  if (domains.has("retail")) {
    copyKeys(START, OUT, RETAIL_COPY_KEYS);
  }
  if (domains.has("1c")) {
    copyKeys(START, OUT, C1_COPY_KEYS);
  }

  const summary = {
    cutover: CUTOVER,
    out: OUT,
    domains: [...domains],
    clinic: domains.has("clinic")
      ? {
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
        }
      : undefined,
    roster: nRoster,
  };
  const readme = path.join(OUT, "README.txt");
  if (fs.existsSync(readme)) fs.unlinkSync(readme);
  fs.writeFileSync(path.join(OUT, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));

  if (domains.has("clinic") || domains.has("hotel")) {
    const bridge = path.join(__dirname, "../../../era-hotel-pms/scripts/apply-wo-fo-guest-bridge.cjs");
    if (fs.existsSync(bridge)) {
      const r = require("child_process").spawnSync(process.execPath, [bridge], { stdio: "inherit" });
      if (r.status) process.exit(r.status);
    }
  }
}

main();
