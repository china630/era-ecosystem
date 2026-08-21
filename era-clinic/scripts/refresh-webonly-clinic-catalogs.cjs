/**
 * Refresh NAFTA-START/clinic/catalogs from live WebOnly clinic API.
 *
 *   node era-clinic/scripts/refresh-webonly-clinic-catalogs.cjs
 *
 * Writes Excel/CSV into D:\ERA-BACKUP\NAFTA-START\clinic\catalogs
 * and JSON snapshots into clinic/dump/catalogs (products / groups / shifts).
 * PII (staff names) stays on disk only — do not commit the pack.
 */
"use strict";

const fs = require("fs");
const https = require("https");
const path = require("path");
const { URL } = require("url");
const X = require(path.join(__dirname, "../../era-hotel-pms/node_modules/xlsx"));

const CLINIC_BASE = process.env.WO_CLINIC_API || "https://nafta-clinic.webonly.io";
const PACK = path.join("D:", "ERA-BACKUP", "NAFTA-START", "clinic");
const CAT_DIR = path.join(PACK, "catalogs");
const DUMP_DIR = path.join(PACK, "dump", "catalogs");

const agent = new https.Agent({ keepAlive: true, maxSockets: 6 });

function request(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: "GET",
        agent,
        headers: {
          "User-Agent": "era-clinic-webonly-catalog-refresh/1.0",
          Accept: "application/json",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks) });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(90_000, () => req.destroy(new Error(`timeout ${url}`)));
    req.end();
  });
}

function unwrap(body) {
  if (!body || !body.length) return [];
  const j = JSON.parse(body.toString("utf8"));
  if (Array.isArray(j)) return j;
  if (j && Array.isArray(j.data)) return j.data;
  if (j && Array.isArray(j.items)) return j.items;
  return j == null ? [] : [j];
}

async function fetchList(endpoint) {
  const url = `${CLINIC_BASE}${endpoint}`;
  const r = await request(url);
  if (r.status !== 200) {
    throw new Error(`HTTP ${r.status} ${endpoint} ${r.body.toString("utf8").slice(0, 200)}`);
  }
  const data = unwrap(r.body);
  return { endpoint, fetchedAt: new Date().toISOString(), httpStatus: r.status, count: data.length, data };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeXlsx(file, sheetName, rows) {
  const wb = X.utils.book_new();
  const ws = X.utils.json_to_sheet(rows);
  X.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  X.writeFile(wb, file);
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(file, rows) {
  if (!rows.length) {
    fs.writeFileSync(file, "\uFEFF\n", "utf8");
    return;
  }
  const keys = Object.keys(rows[0]);
  const lines = [keys.join(",")];
  for (const row of rows) {
    lines.push(keys.map((k) => csvEscape(row[k])).join(","));
  }
  fs.writeFileSync(file, `\uFEFF${lines.join("\n")}\n`, "utf8");
}

function joinNames(arr, key) {
  if (!Array.isArray(arr) || !arr.length) return "";
  return arr
    .map((x) => (typeof x === "string" ? x : x?.[key] ?? x?.name ?? x?.roomName ?? ""))
    .filter(Boolean)
    .join("; ");
}

function isoDate(v) {
  if (!v) return "";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

async function main() {
  fs.mkdirSync(CAT_DIR, { recursive: true });
  fs.mkdirSync(DUMP_DIR, { recursive: true });

  const treatments = await fetchList("/api/Treatment/get-all");
  const rooms = await fetchList("/api/Rooms");
  const doctors = await fetchList("/api/Doctors");
  const shifts = await fetchList("/api/Shift/get-all");
  const analyses = await fetchList("/api/Analyses");
  const lab = await fetchList("/api/LaboratoryExamination/get-all");
  const diag = await fetchList("/api/DiagnosticProcedure/get-all");
  const diagnoses = await fetchList("/api/Diagnoses");
  const checkups = await fetchList("/api/CheckUp/get-all");
  const productGroups = await fetchList("/api/ProductGroups?status=all");
  const products = await fetchList("/api/Products?status=all");

  writeJson(path.join(DUMP_DIR, "treatments.json"), treatments);
  writeJson(path.join(DUMP_DIR, "rooms.json"), rooms);
  writeJson(path.join(DUMP_DIR, "doctors.json"), doctors);
  writeJson(path.join(DUMP_DIR, "analyses.json"), analyses);
  writeJson(path.join(DUMP_DIR, "laboratory-examinations.json"), lab);
  writeJson(path.join(DUMP_DIR, "diagnostic-procedures.json"), diag);
  writeJson(path.join(DUMP_DIR, "diagnoses.json"), diagnoses);
  writeJson(path.join(DUMP_DIR, "checkups.json"), checkups);
  writeJson(path.join(DUMP_DIR, "product-groups.json"), productGroups);
  writeJson(path.join(DUMP_DIR, "products.json"), products);
  writeJson(path.join(PACK, "dump", "calendar", "shifts.json"), shifts);

  writeXlsx(
    path.join(CAT_DIR, "25-Treatments.xlsx"),
    "Treatments",
    treatments.data.map((t) => ({
      ID: t.id,
      Name: t.procedureName ?? "",
      NameAz: t.procedureNameAz ?? "",
      NameEn: t.procedureNameEn ?? "",
      NameRu: t.procedureNameRu ?? "",
      Type: t.procedureType ?? "",
      DurationMin: t.duration ?? "",
      PatientGapMin: t.breakForPatient ?? "",
      DepartmentId: t.departmentId ?? "",
      RoomIds: Array.isArray(t.rooms) ? t.rooms.map((r) => r.roomId).filter(Boolean).join("; ") : "",
      Rooms: joinNames(t.rooms, "roomName"),
      PriceAZN: t.price ?? "",
      Note: t.note ?? "",
      IsActive: t.isActive ?? "",
    })),
  );

  writeXlsx(
    path.join(CAT_DIR, "26-Rooms.xlsx"),
    "Rooms",
    rooms.data.map((r) => ({
      ID: r.id,
      Name: r.name ?? "",
      ShiftId: r.shiftId ?? "",
      PatientGapMin: r.patientGapMin ?? "",
      DailyCapacity: r.dailyCapacity ?? "",
      AssignedTreatmentCount: r.assignedTreatmentCount ?? "",
      IsActive: r.isActive ?? "",
    })),
  );

  writeCsv(
    path.join(CAT_DIR, "27-Doctors.csv"),
    doctors.data.map((d) => ({
      Id: d.id,
      Date: isoDate(d.date),
      FullName: d.fullName ?? "",
      Position: d.position ?? "",
      Shift: d.shift ?? "",
      ShiftId: d.shiftId ?? "",
      Phone: d.phone ?? "",
      Email: d.email ?? "",
      Username: d.username ?? "",
      IsActive: d.isActive ?? "",
    })),
  );

  writeCsv(
    path.join(CAT_DIR, "28-Shifts.csv"),
    shifts.data.map((s) => ({
      Id: s.id,
      Name: s.name ?? "",
      ValidFrom: isoDate(s.validFrom),
      ValidTo: isoDate(s.validTo),
      WorkHoursMonFri: s.workHoursMonFri ?? "",
      LunchMonFri: s.lunchMonFri ?? "",
      WorkHoursSat: s.workHoursSat ?? "",
      LunchSat: s.lunchSat ?? "",
    })),
  );

  writeCsv(
    path.join(CAT_DIR, "29-Analyses.csv"),
    analyses.data.map((a) => ({
      Id: a.id,
      Name: a.name ?? "",
      MeasureUnitId: a.measureUnitId ?? "",
      DepartmentId: a.departmentId ?? "",
      Min: a.minValue ?? "",
      Max: a.maxValue ?? "",
      PriceAZN: a.price ?? "",
      IsActive: a.isActive ?? "",
    })),
  );

  writeXlsx(
    path.join(CAT_DIR, "30-Laboratory.xlsx"),
    "Laboratory",
    lab.data.map((x) => ({
      ID: x.id,
      Name: x.name ?? "",
      Date: isoDate(x.date),
      AnalysisCount: x.totalExaminationCount ?? (Array.isArray(x.analysisIds) ? x.analysisIds.length : ""),
      AnalysisIds: Array.isArray(x.analysisIds) ? x.analysisIds.join("; ") : "",
      AnalysisNames: Array.isArray(x.analysisNames) ? x.analysisNames.join("; ") : "",
    })),
  );

  writeXlsx(
    path.join(CAT_DIR, "31-Diagnostics.xlsx"),
    "Diagnostics",
    diag.data.map((x) => ({
      ID: x.id,
      Name: x.name ?? "",
      Date: isoDate(x.date),
      ProcedureCount: x.totalProcedureCount ?? (Array.isArray(x.treatmentIds) ? x.treatmentIds.length : ""),
      TreatmentIds: Array.isArray(x.treatmentIds) ? x.treatmentIds.join("; ") : "",
      ProcedureNames: Array.isArray(x.procedureNames) ? x.procedureNames.join("; ") : "",
    })),
  );

  writeXlsx(
    path.join(CAT_DIR, "32-Diagnoses.xlsx"),
    "Diagnoses",
    diagnoses.data.map((x) => ({
      ID: x.id,
      Name: x.name ?? "",
      Date: isoDate(x.date),
    })),
  );

  writeXlsx(
    path.join(CAT_DIR, "33-CheckUps.xlsx"),
    "CheckUps",
    checkups.data.map((x) => ({
      ID: x.id,
      Name: x.name ?? "",
      Date: isoDate(x.date),
      ProcedureCount: x.totalProcedureCount ?? (Array.isArray(x.treatmentIds) ? x.treatmentIds.length : ""),
      TreatmentIds: Array.isArray(x.treatmentIds) ? x.treatmentIds.join("; ") : "",
      ProcedureNames: Array.isArray(x.procedureNames) ? x.procedureNames.join("; ") : "",
    })),
  );

  const checkupDetails = [];
  for (const cu of checkups.data) {
    const names = Array.isArray(cu.procedureNames) ? cu.procedureNames : [];
    const ids = Array.isArray(cu.treatmentIds) ? cu.treatmentIds : [];
    const n = Math.max(names.length, ids.length, 1);
    for (let i = 0; i < n; i += 1) {
      checkupDetails.push({
        CheckUpId: cu.id,
        CheckUpName: cu.name ?? "",
        Line: i + 1,
        TreatmentId: ids[i] ?? "",
        ProcedureName: names[i] ?? "",
      });
    }
  }
  writeXlsx(path.join(CAT_DIR, "34-CheckUp-Details.xlsx"), "CheckUpDetails", checkupDetails);

  writeXlsx(
    path.join(CAT_DIR, "35-Product-Groups.xlsx"),
    "ProductGroups",
    productGroups.data.map((g) => ({
      ID: g.id ?? "",
      Name: g.name ?? "",
      IsPassive: g.isPassive ?? false,
      ImagePath: g.imagePath ?? "",
    })),
  );

  writeCsv(
    path.join(CAT_DIR, "36-Products.csv"),
    products.data.map((p) => ({
      Id: p.id ?? "",
      GroupId: p.productGroupId ?? "",
      Group: p.productGroupName ?? "",
      Name: p.name ?? "",
      Department: p.departmentName ?? "",
      Price: p.price ?? "",
      Currency: p.currencyCode ?? "",
      IsAllergic: p.isAllergic ?? "",
      IsOutOfStock: p.isOutOfStock ?? "",
      IsPassive: p.isPassive ?? false,
    })),
  );

  const summary = {
    fetchedAt: new Date().toISOString(),
    source: CLINIC_BASE,
    counts: {
      treatments: treatments.count,
      rooms: rooms.count,
      doctors: doctors.count,
      shifts: shifts.count,
      analyses: analyses.count,
      laboratory: lab.count,
      diagnostics: diag.count,
      diagnoses: diagnoses.count,
      checkups: checkups.count,
      checkupDetails: checkupDetails.length,
      productGroups: productGroups.count,
      products: products.count,
    },
  };
  writeJson(path.join(CAT_DIR, "_refresh-summary.json"), summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
