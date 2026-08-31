/**
 * Build clinic wizard import books from curated 01-procedures.xlsx (SSOT).
 *
 * Input:  D:\ERA-BACKUP\NAFTA-START\clinic\reports\01-procedures.xlsx
 * Output: D:\ERA-BACKUP\NAFTA-ERA-READY\clinic\19-Treatments.xlsx
 *         D:\ERA-BACKUP\NAFTA-ERA-READY\clinic\20-Clinic-Rooms.xlsx
 *         D:\ERA-BACKUP\NAFTA-ERA-READY\clinic\21-Procedure-Requirements.xlsx
 *         D:\ERA-BACKUP\NAFTA-START\clinic\reports\era-import\ (mirror + manifest)
 *
 * Electro #40 LOCATION rows stay 7–13 for Amplipuls/Elektroforez (FIFO 2-pad
 * pool, including 12/13). Four-pad is a capability filter when 12/13 are free
 * (canon §9), not a second treatment SKU and not a hold.
 *
 *   node era-clinic/scripts/nafta-cutover/build-procedures-import.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { HEADERS, procedureCode, roomCode } = require("./map.cjs");
const { FILES } = require("./pack-layout.cjs");

const START = process.env.NAFTA_START || path.join("D:", "ERA-BACKUP", "NAFTA-START");
const READY = process.env.NAFTA_READY || path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY");
const SOURCE_XLSX = path.join(START, "clinic", "reports", "01-procedures.xlsx");
const MIRROR = path.join(START, "clinic", "reports", "era-import");
const WO_TREATMENTS = path.join(START, "clinic", "dump", "catalogs", "treatments.json");
const WO_ROOMS = path.join(START, "clinic", "dump", "catalogs", "rooms.json");
const WO_CALENDAR = path.join(START, "clinic", "dump", "calendar", "reservations-all.json");

const RESOURCE_HEADERS = HEADERS.procedureRequirements;

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

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeSheet(XLSX, outFile, headers, rows, sheetName = "import") {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const aoa = [headers, ...rows.map((r) => headers.map((h) => (r[h] == null ? "" : r[h])))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, outFile);
  return rows.length;
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function baseName(s) {
  return String(s || "")
    .replace(/\s*\((жен\.|муж\.)\)\s*$/i, "")
    .trim();
}

function slugCode(name) {
  return String(name || "PROC")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function parseCabinets(raw) {
  return String(raw || "")
    .split(/;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickWoTreatment(candidates) {
  if (!candidates?.length) return null;
  return (
    candidates.find((x) => Number(x.procedureType) === 1 && Number(x.price) > 0) ||
    candidates.find((x) => Number(x.procedureType) === 1) ||
    candidates.find((x) => Number(x.price) > 0) ||
    candidates[0]
  );
}

function buildWoIndex(treatments) {
  const byBase = new Map();
  for (const t of treatments) {
    const b = baseName(t.procedureName);
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b).push(t);
  }
  return byBase;
}

function resolveWoMatch(row, byBase) {
  const nameAz = String(row.nameAz || "").trim();
  const candidates = [
    nameAz,
    baseName(nameAz),
    nameAz.replace(/\s*\/\s*/g, " / "),
  ];
  if (/amplipuls\s*\/\s*elektrofarez/i.test(nameAz)) {
    candidates.push("Elektroforez", "Amplipuls");
  }
  for (const key of candidates) {
    const list = byBase.get(key);
    if (list?.length) return pickWoTreatment(list);
  }
  return null;
}

function dedupeRows(rows) {
  const seen = new Map();
  const out = [];
  const skipped = [];
  for (const row of rows) {
    const key = [
      norm(baseName(row.nameAz)),
      Number(row.durationMin),
      Number(row.gap),
      norm(String(row.cabinets || "")),
    ].join("|");
    if (seen.has(key)) {
      skipped.push({ kept: seen.get(key), dropped: row.n, nameAz: row.nameAz });
      continue;
    }
    seen.set(key, row.n);
    out.push(row);
  }
  return { rows: out, skipped };
}

/** Room ids referenced in WO calendar (historical slot import must resolve resource). */
function collectCalendarRoomIds(woIdToCode) {
  if (!fs.existsSync(WO_CALENDAR) || woIdToCode.size === 0) return new Set();
  const pack = loadJson(WO_CALENDAR);
  const rows = pack.data || [];
  const ids = new Set();
  for (const row of rows) {
    const tid = Number(row.treatmentId);
    if (!woIdToCode.has(tid)) continue;
    const rid = Number(row.roomId);
    if (Number.isFinite(rid) && rid > 0) ids.add(rid);
  }
  return ids;
}

function buildWoIdToCodeFromPack(procedureRows, woTreatments) {
  const woIdToCode = new Map();
  for (const row of procedureRows) {
    const m = String(row.externalRef || "").match(/^wo:treatment:(\d+)$/);
    if (m && row.code) woIdToCode.set(Number(m[1]), row.code);
  }
  for (const row of procedureRows) {
    const code = String(row.code || "").trim();
    if (!code) continue;
    const names = new Set([norm(row.nameAz), norm(baseName(row.nameAz))]);
    for (const t of woTreatments) {
      const tn = norm(t.procedureName || t.procedureNameAz);
      const tb = norm(baseName(t.procedureName || t.procedureNameAz));
      if (names.has(tn) || names.has(tb)) woIdToCode.set(Number(t.id), code);
    }
  }
  applyAplikasiyaAliases(woIdToCode, woTreatments, procedureRows);
  return woIdToCode;
}

function applyAplikasiyaAliases(woIdToCode, woTreatments, curatedRows) {
  const qRow = curatedRows.find((r) => /naftalan.*qad/i.test(String(r.nameAz || "")));
  const mRow = curatedRows.find((r) => /naftalan.*kişi/i.test(String(r.nameAz || "")));
  const qCode = qRow ? String(qRow.code || "").trim() : "";
  const mCode = mRow ? String(mRow.code || "").trim() : "";
  if (!qCode && !mCode) return;
  for (const t of woTreatments) {
    if (norm(t.procedureName || t.procedureNameAz) !== "aplikasiya") continue;
    const roomNames = (t.rooms || []).map((r) => String(r.roomName || "")).join(" ");
    if (/qadın|жен/i.test(roomNames) && qCode) woIdToCode.set(Number(t.id), qCode);
    else if (/kişi|муж/i.test(roomNames) && mCode) woIdToCode.set(Number(t.id), mCode);
  }
}

function main() {
  const XLSX = loadXlsx();
  if (!fs.existsSync(SOURCE_XLSX)) {
    throw new Error(`Missing SSOT workbook: ${SOURCE_XLSX}`);
  }

  const wb = XLSX.readFile(SOURCE_XLSX);
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets.procedures, { defval: "" });
  const { rows, skipped } = dedupeRows(rawRows);

  const woTreatments = loadJson(WO_TREATMENTS).data || [];
  const woRooms = loadJson(WO_ROOMS).data || [];
  const byBase = buildWoIndex(woTreatments);

  const roomByName = new Map(woRooms.map((r) => [String(r.name).trim(), r]));
  const usedRoomIds = new Set();
  const procedureRows = [];
  const resourceRows = [];
  const warnings = [];

  for (const row of rows) {
    const nameAz = String(row.nameAz || "").trim();
    const durationMin = Number(row.durationMin ?? 10);
    const resourceGapMinutes = Number(row.gap ?? 5);
    const cabinets = parseCabinets(row.cabinets);

    const wo = resolveWoMatch(row, byBase);

    let externalRef;
    let code;
    let patientRestMinutes = 15;
    let price = 0;

    if (wo) {
      externalRef = `wo:treatment:${wo.id}`;
      code = procedureCode(wo.id);
      patientRestMinutes = Number(wo.breakForPatient ?? 15);
      price = Number(wo.price ?? 0);
    } else {
      const slug = slugCode(baseName(nameAz));
      externalRef = `nafta:procedure:${slug}`;
      code = `NAFTA-PROC-${slug}`;
      warnings.push({ n: row.n, nameAz, reason: "no WO match" });
    }

    procedureRows.push({
      externalRef,
      code,
      nameAz,
      durationMin,
      resourceGapMinutes,
      patientRestMinutes,
      price,
    });

    for (const cabName of cabinets) {
      const room = roomByName.get(cabName);
      if (!room) {
        warnings.push({ n: row.n, nameAz, reason: `unknown cabinet: ${cabName}` });
        continue;
      }
      usedRoomIds.add(room.id);
      resourceRows.push({
        procedureCode: code,
        resourceCode: roomCode(room.id),
        role: "LOCATION",
        quantity: 1,
      });
    }
  }

  const woIdPreview = buildWoIdToCodeFromPack(procedureRows, woTreatments);
  for (const id of collectCalendarRoomIds(woIdPreview)) {
    usedRoomIds.add(id);
  }

  const roomRows = woRooms
    .filter((r) => usedRoomIds.has(r.id))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "az", { numeric: true }))
    .map((r) => ({
      externalRef: `wo:room:${r.id}`,
      code: roomCode(r.id),
      name: r.name || "",
    }));

  const out25Ready = path.join(READY, FILES.clinicTreatments);
  const out26Ready = path.join(READY, FILES.clinicRooms);
  const outResReady = path.join(READY, FILES.clinicRequirements);
  const out25Mirror = path.join(MIRROR, path.basename(FILES.clinicTreatments));
  const out26Mirror = path.join(MIRROR, path.basename(FILES.clinicRooms));
  const outResMirror = path.join(MIRROR, path.basename(FILES.clinicRequirements));

  const nProc = writeSheet(XLSX, out25Ready, HEADERS.procedures, procedureRows);
  writeSheet(XLSX, out26Ready, HEADERS.rooms, roomRows);
  writeSheet(XLSX, outResReady, RESOURCE_HEADERS, resourceRows, "resources");

  writeSheet(XLSX, out25Mirror, HEADERS.procedures, procedureRows);
  writeSheet(XLSX, out26Mirror, HEADERS.rooms, roomRows);
  writeSheet(XLSX, outResMirror, RESOURCE_HEADERS, resourceRows, "resources");

  const readme = [
    "# Procedures import pack",
    "",
    `Source SSOT: ${SOURCE_XLSX}`,
    `Built: ${new Date().toISOString()}`,
    "",
    "## Wizard upload (phase 1 — dictionaries)",
    "- 19-Treatments.xlsx → entity `procedures`",
    "- 20-Clinic-Rooms.xlsx → entity `rooms`",
    "- 21-Procedure-Requirements.xlsx → entity `procedure-requirements` (after 19+20)",
    "",
    "## Rules applied",
    "- durationMin + gap from 01-procedures.xlsx (gap = resourceGapMinutes)",
    "- patientRestMinutes from WO when matched, else 15",
    "- price from WO only; package inclusions stay 0 (not tariffed). EW Hizmet Tanımları is not a clinic catalog.",
    `- deduped rows: ${skipped.length}`,
    "",
  ].join("\n");

  fs.mkdirSync(MIRROR, { recursive: true });
  fs.writeFileSync(path.join(MIRROR, "README.md"), `${readme}\n`, "utf8");

  const manifest = {
    builtAt: new Date().toISOString(),
    source: SOURCE_XLSX,
    counts: {
      procedures: nProc,
      rooms: roomRows.length,
      procedureResources: resourceRows.length,
      deduped: skipped.length,
    },
    outputs: {
      ready: [out25Ready, out26Ready, outResReady],
      mirror: [out25Mirror, out26Mirror, outResMirror],
    },
    skippedDuplicates: skipped,
    warnings,
  };
  fs.writeFileSync(path.join(MIRROR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(manifest, null, 2));
}

main();
