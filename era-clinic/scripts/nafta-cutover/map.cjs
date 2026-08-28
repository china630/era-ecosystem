"use strict";

/** W4: procedure-order nahiye → S is nahiye-s-match.cjs + physio-zones-s.json, not this Excel column mapper.
 *  #40 LOCATION codes are room ids (WO-ROOM-*). Electro 2-pad vs 4-pad (canon §9) is not a column here. */

const CUTOVER = "2026-08-25";
/** Ops import window: today through Saturday (Asia/Baku week). */
const OPS_SLOT_FROM = "2026-08-25";
const OPS_SLOT_TO = "2026-08-30";

const HEADERS = {
  procedures: [
    "externalRef",
    "code",
    "nameAz",
    "durationMin",
    "resourceGapMinutes",
    "patientRestMinutes",
    "price",
  ],
  rooms: ["externalRef", "code", "name"],
  practitioners: ["externalRef", "fin", "fullName", "role"],
  patients: [
    "externalRef",
    "woId",
    "fullName",
    "givenName",
    "surname",
    "sex",
    "birthDate",
    "nationality",
    "phone",
    "hotelResNo",
    "roomNumber",
    "folioPerson",
    "uniqueId",
    "checkIn",
    "checkOut",
    "treatmentDaysCount",
    "nightCount",
    "isReservationPatient",
    "doctorId",
    "doctorName",
    "doctorFormCreatedAt",
    "checkUpId",
    "checkUpName",
    "programCode",
    "latestPainDegree",
    "latestPainDegreeCreatedAt",
  ],
  quotas: ["patientRef", "procedureCode", "quotaTotal", "quotaUsed", "quotaLeft"],
  slots: [
    "externalRef",
    "date",
    "startTime",
    "patientRef",
    "procedureCode",
    "roomCode",
    "status",
    "nahiye",
  ],
  labCatalog: ["externalRef", "code", "name", "group"],
  labOrders: ["externalRef", "patientRef", "testCode", "status", "panel", "takenAt"],
  labResultLines: ["orderRef", "code", "label", "value", "unit", "refMin", "refMax"],
  diagnostics: ["externalRef", "patientRef", "code", "name", "resultText", "takenAt"],
  diagnoses: ["patientRef", "rawText", "icd10", "recordedAt"],
  roster: ["fin", "fullName", "orgUnit", "position", "hireDate", "satellites"],
  procedureRequirements: ["procedureCode", "resourceCode", "role", "quantity"],
};

function ymd(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function procedureCode(id) {
  return `WO-TR-${id}`;
}

function roomCode(id) {
  return `WO-ROOM-${id}`;
}

function slotStatus(dateYmd, cutover = CUTOVER) {
  return dateYmd < cutover ? "COMPLETED" : "SCHEDULED";
}

function isOpsSlotDate(dateYmd) {
  return dateYmd >= OPS_SLOT_FROM && dateYmd <= OPS_SLOT_TO;
}

function mapSex(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/i̇/g, "i");
  if (!s) return "UNKNOWN";
  // Female before male: "female" contains "male".
  if (
    s === "f" ||
    s === "2" ||
    s.startsWith("fem") ||
    s === "woman" ||
    s === "qadin" ||
    s === "qadın" ||
    s === "xanim" ||
    s === "xanım"
  ) {
    return "FEMALE";
  }
  if (s === "m" || s === "1" || s === "male" || s === "man" || s === "kisi" || s === "kişi" || s === "bay") {
    return "MALE";
  }
  return "UNKNOWN";
}

function cell(value) {
  if (value == null || value === "") return "";
  return String(value).trim();
}

function isoStamp(value) {
  if (!value) return "";
  return String(value).replace("T", " ").slice(0, 19);
}

/** Card GET /api/Patient/{id} + list row + treatment-info fallback. */
function loadPatientCardIndex(cardsDir) {
  const fs = require("fs");
  const path = require("path");
  const map = new Map();
  if (!fs.existsSync(cardsDir)) return map;
  for (const file of fs.readdirSync(cardsDir)) {
    if (!file.endsWith(".json")) continue;
    let json;
    try {
      json = JSON.parse(fs.readFileSync(path.join(cardsDir, file), "utf8"));
    } catch {
      continue;
    }
    const id = json.patientId != null ? Number(json.patientId) : Number(String(file).replace(/\.json$/, ""));
    if (!Number.isFinite(id)) continue;
    map.set(id, {
      patient: json.slices && json.slices.patient && typeof json.slices.patient === "object" ? json.slices.patient : null,
      listRow: json.listRow && typeof json.listRow === "object" ? json.listRow : null,
      treatmentInfo: Array.isArray(json.treatmentInfoBulk) ? json.treatmentInfoBulk : [],
    });
  }
  return map;
}

function pickCheckUpName(treatmentInfo) {
  if (!Array.isArray(treatmentInfo)) return "";
  for (let i = treatmentInfo.length - 1; i >= 0; i -= 1) {
    const name = cell(treatmentInfo[i] && treatmentInfo[i].checkUpName);
    if (name) return name;
  }
  return "";
}

function mapPatientImportRow(listRow, card) {
  const list = listRow && typeof listRow === "object" ? listRow : {};
  const c = card && card.patient && typeof card.patient === "object" ? card.patient : {};
  const ti0 = Array.isArray(card && card.treatmentInfo) && card.treatmentInfo.length ? card.treatmentInfo[0] : {};
  const id = list.id != null ? list.id : c.id;
  const givenName = cell(c.name);
  const surname = cell(c.surname);
  const fullName =
    cell(list.fullName) ||
    [givenName, surname].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const reservationId = c.reservationId != null && c.reservationId !== "" ? c.reservationId : list.reservationId;
  const checkUpName = pickCheckUpName(card && card.treatmentInfo);
  const gender = c.gender || ti0.gender || list.gender || list.sex;
  const isRes = c.isReservationPatient != null ? c.isReservationPatient : list.isReservationPatient;
  return {
    externalRef: `wo:patient:${id}`,
    woId: id != null ? id : "",
    fullName,
    givenName,
    surname,
    sex: mapSex(gender),
    birthDate: ymd(c.birthDate || list.birthDate),
    nationality: cell(c.nationality || list.nationality),
    phone: cell(c.phoneNumber || list.phoneNumber),
    hotelResNo: reservationId != null && reservationId !== "" ? String(reservationId) : "",
    roomNumber: cell(c.reservationRoomNumber || list.reservationRoomNumber),
    folioPerson: c.folioPerson != null ? c.folioPerson : "",
    uniqueId: cell(c.uniqueId || list.uniqueId),
    checkIn: ymd(c.checkInDate || list.checkInDate),
    checkOut: ymd(c.checkOutDate || list.checkOutDate),
    treatmentDaysCount: c.treatmentDaysCount != null ? c.treatmentDaysCount : list.treatmentDaysCount ?? "",
    nightCount: c.nightCount != null ? c.nightCount : list.nightCount ?? "",
    isReservationPatient: isRes === true || isRes === "true" ? "true" : isRes === false || isRes === "false" ? "false" : "",
    doctorId: c.doctorId != null ? c.doctorId : list.doctorId ?? "",
    doctorName: cell(list.doctorName || ti0.mainDoctorName),
    doctorFormCreatedAt: isoStamp(list.doctorFormCreatedAt || c.doctorFormCreatedAt),
    checkUpId: c.checkUpId != null ? c.checkUpId : list.checkUpId ?? "",
    checkUpName,
    programCode: checkUpName,
    latestPainDegree:
      c.latestPainDegree != null ? c.latestPainDegree : list.latestPainDegree != null ? list.latestPainDegree : "",
    latestPainDegreeCreatedAt: isoStamp(c.latestPainDegreeCreatedAt || list.latestPainDegreeCreatedAt),
  };
}

function mapPractitionerRole(position) {
  const p = String(position || "").toLowerCase();
  if (p.includes("nurse") || p.includes("bac") || p.includes("кичик")) return "NURSE";
  if (p.includes("lab")) return "LAB";
  return "DOCTOR";
}

function mapRosterRow(row) {
  const title = String(row["Vəzifə"] || row.position || "");
  const dept = String(row["Şöbə"] || row.orgUnit || "");
  const low = `${title} ${dept}`.toLowerCase();
  let satellites = "";
  if (
    /həkim|hekim|tibb|bacısı|bacisi|vanna|reabilit|ginek|laborant|terapevt|nurse|doctor/.test(
      low,
    )
  ) {
    satellites = "industry_clinic";
  } else if (/qeydiyyat|qəbul|qeBul|reception|reseps/.test(low)) {
    satellites = "industry_hotel_pms";
  }
  return {
    fin: String(row["FİN"] || row.FIN || row.fin || "").trim(),
    fullName: String(row["Tam adı"] || row.fullName || "").trim(),
    orgUnit: dept.trim(),
    position: title.trim(),
    hireDate: "2020-01-01",
    satellites,
  };
}

function isUsgExam(form) {
  const diagnoses = Array.isArray(form?.diagnoses) ? form.diagnoses : [];
  const names = diagnoses.map((d) => String(d.diagnosisName || d.name || "")).join(" ");
  const blob = `${names} ${form?.notes || form?.note || ""}`;
  return /USM|USG|USİ|USI|ultrason/i.test(blob);
}

function labFileRel(row) {
  const name = String(row.fileName || "result").replace(/[<>:"/\\|?*]/g, "_").slice(0, 80);
  return `dump/files/lab/${row.id}_${name}`;
}

/** Card procedure.id → nahiye. Calendar rows join via patientProcedureId. */
function loadNahiyeByProcedureId(cardsDir) {
  const fs = require("fs");
  const path = require("path");
  const map = new Map();
  if (!fs.existsSync(cardsDir)) return map;
  for (const file of fs.readdirSync(cardsDir)) {
    if (!file.endsWith(".json")) continue;
    let json;
    try {
      json = JSON.parse(fs.readFileSync(path.join(cardsDir, file), "utf8"));
    } catch {
      continue;
    }
    const slices = json && json.slices && Array.isArray(json.slices.procedures) ? json.slices.procedures : [];
    for (const node of slices) {
      if (!node || typeof node !== "object") continue;
      if (!Object.prototype.hasOwnProperty.call(node, "nahiye")) continue;
      if (node.id == null) continue;
      map.set(Number(node.id), node.nahiye == null ? "" : String(node.nahiye));
    }
  }
  return map;
}

function slotNahiye(row, nahiyeByProc) {
  const pid = row.patientProcedureId != null ? Number(row.patientProcedureId) : NaN;
  if (Number.isFinite(pid) && nahiyeByProc.has(pid)) return nahiyeByProc.get(pid);
  return "";
}

module.exports = {
  CUTOVER,
  OPS_SLOT_FROM,
  OPS_SLOT_TO,
  HEADERS,
  ymd,
  procedureCode,
  roomCode,
  slotStatus,
  isOpsSlotDate,
  mapSex,
  mapPatientImportRow,
  loadPatientCardIndex,
  mapPractitionerRole,
  mapRosterRow,
  isUsgExam,
  labFileRel,
  loadNahiyeByProcedureId,
  slotNahiye,
};
