"use strict";

/** W4: procedure-order nahiye → S is nahiye-s-match.cjs + physio-zones-s.json, not this Excel column mapper.
 *  #40 LOCATION codes are room ids (WO-ROOM-*). Electro 2-pad vs 4-pad (canon §9) is not a column here. */

const { excelDateYmd } = require("./excel-date.cjs");

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
    "passport",
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
  diagnostics: ["externalRef", "patientRef", "code", "name", "resultText", "resultJson", "takenAt"],
  diagnoses: ["patientRef", "rawText", "icd10", "recordedAt"],
  roster: [
    "fin",
    "fullName",
    "sex",
    "birthDate",
    "orgUnit",
    "position",
    "hireDate",
    "workplace",
    "satellites",
  ],
  orgStructure: ["orgUnit", "position", "totalSlots"],
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
  const token = s.split(/[\s\-–—(/]+/)[0] || s;
  // Female before male: "female" contains "male". Nafta HR: Q = qadın, K = kişi.
  if (
    token === "f" ||
    token === "q" ||
    s === "2" ||
    s.startsWith("fem") ||
    s === "woman" ||
    s.includes("qadin") ||
    s.includes("qadın") ||
    s === "xanim" ||
    s === "xanım"
  ) {
    return "FEMALE";
  }
  if (
    token === "m" ||
    token === "k" ||
    s === "1" ||
    s === "male" ||
    s === "man" ||
    s.includes("kisi") ||
    s.includes("kişi") ||
    s === "bay"
  ) {
    return "MALE";
  }
  return "UNKNOWN";
}

function mapWorkplace(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/i̇/g, "i");
  if (!s) return "";
  if (s.includes("əlavə") || s.includes("elave") || s.includes("additional") || s === "2") {
    return "ADDITIONAL";
  }
  if (s.includes("əsas") || s.includes("esas") || s.includes("primary") || s === "1") {
    return "PRIMARY";
  }
  return "";
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
    passport: cell(c.passport || list.passport),
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

function cellByHeader(row, ...needles) {
  if (!row || typeof row !== "object") return "";
  const keys = Object.keys(row);
  for (const needle of needles) {
    if (Object.prototype.hasOwnProperty.call(row, needle) && row[needle] != null && row[needle] !== "") {
      return row[needle];
    }
  }
  const norms = needles.map((n) => n.toLowerCase().replace(/\s+/g, " ").trim());
  for (const k of keys) {
    const kn = k.toLowerCase().replace(/\s+/g, " ").trim();
    if (norms.includes(kn) && row[k] != null && row[k] !== "") return row[k];
  }
  for (const k of keys) {
    const kn = k.toLowerCase().replace(/\s+/g, " ");
    for (const n of norms) {
      if (n.length >= 5 && kn.includes(n) && row[k] != null && row[k] !== "") return row[k];
    }
  }
  return "";
}

function mapRosterRow(row) {
  const title = String(cellByHeader(row, "Vəzifə", "position") || "");
  const dept = String(cellByHeader(row, "Şöbə", "orgUnit") || "");
  const workplace = mapWorkplace(
    cellByHeader(row, "workplace", "İş yeri: əsas və ya əlavə", "iş yeri"),
  );
  const low = `${title} ${dept}`.toLowerCase();
  let satellites = "";
  if (workplace !== "ADDITIONAL") {
    if (
      /həkim|hekim|tibb|bacısı|bacisi|vanna|reabilit|ginek|laborant|terapevt|nurse|doctor/.test(
        low,
      )
    ) {
      satellites = "industry_clinic";
    } else if (/qeydiyyat|qəbul|qeBul|reception|reseps/.test(low)) {
      satellites = "industry_hotel_pms";
    }
  }
  return {
    fin: String(cellByHeader(row, "FİN", "FIN", "fin") || "").trim(),
    fullName: String(cellByHeader(row, "Tam adı", "fullName") || "").trim(),
    sex: mapSex(cellByHeader(row, "sex", "gender", "Cins", "Cinsi", "Cinsiyyət", "cinsi")),
    orgUnit: dept.trim(),
    position: title.trim(),
    hireDate: excelDateYmd(
      cellByHeader(row, "hireDate", "İşə qəbul  tarixi", "İşə qəbul tarixi", "işə qəbul"),
    ),
    birthDate: excelDateYmd(cellByHeader(row, "birthDate", "Doğum tarixi", "doğum")),
    workplace,
    satellites,
  };
}

function mapOrgStructureRow(row) {
  const slotsRaw = cellByHeader(row, "totalSlots", "slots", "Ştat vahidi", "ştat vahidi");
  const n = Number(String(slotsRaw ?? "").replace(",", "."));
  const totalSlots = Number.isFinite(n) && n > 0 ? Math.max(1, Math.round(n)) : 1;
  return {
    orgUnit: String(cellByHeader(row, "orgUnit", "Şöbə") || "").trim(),
    position: String(cellByHeader(row, "position", "Vəzifə") || "").trim(),
    totalSlots,
  };
}

const { mapWoUsgServiceCode } = require("./wo-era-usg-map.cjs");

function isUsgExam(form) {
  return mapWoUsgServiceCode(form) != null;
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
  mapWorkplace,
  mapPatientImportRow,
  loadPatientCardIndex,
  mapPractitionerRole,
  mapRosterRow,
  mapOrgStructureRow,
  cellByHeader,
  isUsgExam,
  labFileRel,
  loadNahiyeByProcedureId,
  slotNahiye,
};
