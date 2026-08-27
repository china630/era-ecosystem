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
  mapPractitionerRole,
  mapRosterRow,
  isUsgExam,
  labFileRel,
  loadNahiyeByProcedureId,
  slotNahiye,
};
