"use strict";

const CUTOVER = "2026-08-25";
const OPS_SLOT_FROM = "2026-08-24";
const OPS_SLOT_TO = "2026-08-31";

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
    "fullName",
    "sex",
    "birthDate",
    "hotelResNo",
    "roomNumber",
    "checkIn",
    "checkOut",
    "programCode",
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
  ],
  labCatalog: ["externalRef", "code", "name", "group"],
  labOrders: ["externalRef", "patientRef", "testCode", "status", "resultText", "takenAt", "fileRel"],
  diagnostics: ["externalRef", "patientRef", "code", "name", "resultText", "takenAt"],
  diagnoses: ["patientRef", "rawText", "icd10", "recordedAt"],
  roster: ["fin", "fullName", "orgUnit", "position", "hireDate", "satellites"],
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
  const s = String(raw || "").toLowerCase();
  if (s.startsWith("m") || s.includes("male") || s === "kişi") return "MALE";
  if (s.startsWith("f") || s.includes("female") || s === "qadın") return "FEMALE";
  return "UNKNOWN";
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
  mapPractitionerRole,
  mapRosterRow,
  isUsgExam,
  labFileRel,
  procedureCode: procedureCode,
  roomCode: roomCode,
  slotStatus: slotStatus,
  isOpsSlotDate: isOpsSlotDate,
};
