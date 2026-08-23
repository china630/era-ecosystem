"use strict";

/**
 * Build era-ready/*.xlsx from D:\ERA-BACKUP\NAFTA-START dump.
 *
 *   node era-clinic/scripts/nafta-cutover/build-era-ready.cjs
 *   NAFTA_START=D:\ERA-BACKUP\NAFTA-START node era-clinic/scripts/nafta-cutover/build-era-ready.cjs
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
  mapPractitionerRole,
  mapRosterRow,
  isUsgExam,
  labFileRel,
} = require("./map.cjs");

const START = process.env.NAFTA_START || path.join("D:", "ERA-BACKUP", "NAFTA-START");
const OUT = path.join(START, "era-ready");
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
  fs.mkdirSync(path.join(OUT, "hr"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "hotel"), { recursive: true });

  const treatments = rowsOf(readDumpJson("catalogs/treatments.json"));
  const rooms = rowsOf(readDumpJson("catalogs/rooms.json"));
  const doctors = rowsOf(readDumpJson("catalogs/doctors.json"));
  const patients = rowsOf(readDumpJson("bulk/patients.json"));
  const analyses = rowsOf(readDumpJson("catalogs/analyses.json"));
  const calendarAll = readDumpJson("calendar/reservations-all.json");
  const slotsRaw = rowsOf(calendarAll);

  const nProc = writeSheet(
    XLSX,
    path.join(clinicOut, "01-procedures.xlsx"),
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

  const nRooms = writeSheet(
    XLSX,
    path.join(clinicOut, "02-rooms.xlsx"),
    HEADERS.rooms,
    rooms.map((r) => ({
      externalRef: `wo:room:${r.id}`,
      code: roomCode(r.id),
      name: r.name || "",
    })),
  );

  const nPract = writeSheet(
    XLSX,
    path.join(clinicOut, "03-practitioners.xlsx"),
    HEADERS.practitioners,
    doctors.map((d) => ({
      externalRef: `wo:doctor:${d.id}`,
      fin: "",
      fullName: d.fullName || "",
      role: mapPractitionerRole(d.position),
    })),
  );

  const liveIds = new Set();
  for (const p of patients) {
    if (inHousePatient(p)) liveIds.add(p.id);
  }
  for (const s of slotsRaw) {
    const date = ymd(s.date);
    if (isOpsSlotDate(date) && slotStatus(date) === "SCHEDULED") liveIds.add(s.patientId);
  }
  const livePatients = patients.filter((p) => liveIds.has(p.id));
  const nPat = writeSheet(
    XLSX,
    path.join(clinicOut, "04-patients.xlsx"),
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

  const nQuota = writeSheet(XLSX, path.join(clinicOut, "05-quotas.xlsx"), HEADERS.quotas, quotaRows);
  const nSlots = writeSheet(XLSX, path.join(clinicOut, "06-slots.xlsx"), HEADERS.slots, opsSlots);
  writeSheet(XLSX, path.join(clinicOut, "06-slots-archive.xlsx"), HEADERS.slots, archiveSlots);

  const nLabCat = writeSheet(
    XLSX,
    path.join(clinicOut, "07-lab-catalog.xlsx"),
    HEADERS.labCatalog,
    [
      ...analyses.map((a) => ({
        externalRef: `wo:analysis:${a.id}`,
        code: `WO-LAB-${a.id}`,
        name: a.name || "",
        group: "lab",
      })),
      {
        externalRef: "wo:analysis:file",
        code: "WO-LAB-FILE",
        name: "Attached lab file (WebOnly)",
        group: "lab",
      },
    ],
  );

  const labResults = rowsOf(readDumpJson("bulk/lab-results.json"));
  const nLabOrd = writeSheet(
    XLSX,
    path.join(clinicOut, "08-lab-orders.xlsx"),
    HEADERS.labOrders,
    labResults.map((r) => ({
      externalRef: `wo:lab:${r.id}`,
      patientRef: `wo:patient:${r.patientId}`,
      testCode: r.labTestId ? `WO-LAB-${r.labTestId}` : "WO-LAB-FILE",
      status: "COMPLETED",
      resultText: r.note || r.fileName || "",
      takenAt: ymd(r.resultDate),
      fileRel: labFileRel(r),
    })),
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
    if (note && !isUsgExam(form)) {
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
    path.join(clinicOut, "09-diagnostics.xlsx"),
    HEADERS.diagnostics,
    usgRows,
  );
  const nDx = writeSheet(
    XLSX,
    path.join(clinicOut, "10-diagnoses.xlsx"),
    HEADERS.diagnoses,
    dxRows,
  );

  const hrPath = path.join(START, "hr", "37-Employees.xlsx");
  let nRoster = 0;
  if (fs.existsSync(hrPath)) {
    const wb = XLSX.readFile(hrPath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const hrRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    nRoster = writeSheet(
      XLSX,
      path.join(OUT, "hr", "37-roster.xlsx"),
      HEADERS.roster,
      hrRows.map(mapRosterRow).filter((r) => r.fin),
    );
  }

  const hotelSrc = path.join(START, "hotel");
  const hotelOut = path.join(OUT, "hotel");
  const hotelArchive = path.join(OUT, "hotel-archive");
  if (fs.existsSync(hotelSrc)) {
    fs.mkdirSync(hotelArchive, { recursive: true });
    for (const name of fs.readdirSync(hotelSrc)) {
      const src = path.join(hotelSrc, name);
      if (!fs.statSync(src).isFile()) continue;
      fs.copyFileSync(src, path.join(hotelArchive, name));
      const isTx = /^(10|11|12)[-_]/.test(name);
      if (isTx) {
        // Ops extract: in-house / future 2026 / open folio when columns exist; else copy as-is for Hour X filter in PMS wizard.
        fs.copyFileSync(src, path.join(hotelOut, name.replace(/(\.\w+)$/, "-ops$1")));
      } else {
        fs.copyFileSync(src, path.join(hotelOut, name));
      }
    }
  }

  const summary = {
    cutover: CUTOVER,
    out: OUT,
    clinic: {
      procedures: nProc,
      rooms: nRooms,
      practitioners: nPract,
      patientsInHouse: nPat,
      quotas: nQuota,
      slotsOps: nSlots,
      slotsArchive: archiveSlots.length,
      labCatalog: nLabCat,
      labOrders: nLabOrd,
      diagnostics: nDxImg,
      diagnoses: nDx,
    },
    roster: nRoster,
  };
  fs.writeFileSync(path.join(OUT, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main();
