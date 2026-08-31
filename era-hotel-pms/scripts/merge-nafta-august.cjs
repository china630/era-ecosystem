/**
 * Overlay NAFTA-START/hotel/_source/ew-august-2026-08-30 EW dumps onto START+READY books.
 * Does not touch hotel dictionaries #03–#08, #15, or clinic curated #19–#22.
 *
 *   node era-hotel-pms/scripts/merge-nafta-august.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const X = require(path.join(__dirname, "..", "node_modules", "xlsx"));
const { FILES, START_ARCHIVE, fileAt } = require(path.join(
  __dirname,
  "..",
  "..",
  "era-clinic",
  "scripts",
  "nafta-cutover",
  "pack-layout.cjs",
));

const START = process.env.NAFTA_START || "D:/ERA-BACKUP/NAFTA-START";
const READY = process.env.NAFTA_READY || "D:/ERA-BACKUP/NAFTA-ERA-READY";
const AUGUST =
  [
    path.join(START, "hotel", "_source", "ew-august-2026-08-30"),
    path.join(START, "August"),
  ].find((p) => fs.existsSync(p)) || path.join(START, "August");
const REPORT = path.join(START, "hotel", "merge-august-report.json");

const SKIP_NOTE_TYPES = new Set(["", "CHANNEL"]);

const NOTE_TYPE_TO_ERA = {
  "RES NOTE": "Res Note",
  "EXTRA REQUEST": "Extra Request",
  "CHECKIN NOTE": "Checkin Note",
  "CHECKOUT NOTE": "Checkout Note",
  "ROOM NOTE": "Room Note",
  "PAYMENT INFO": "Payment Info",
  "CANCEL REASON": "Cancel Reason",
  "CANCEL NOTE": "Cancel Note",
  CONFIRMATION: "Confirmation",
  INVOICE: "Invoice",
  "OPERATOR NOTE": "Operator Note",
  "GENERAL NOTES": "General Notes",
  "ARRIVAL POSTPONED": "Arrival Postponed",
};

const RES_PREFER_IN = new Set([
  "Arrival",
  "Departure",
  "Room No",
  "Guest Name",
  "Agency",
  "Room Type",
  "Given Room Type",
  "Adult",
  "TChd",
  "Board",
  "Accom Type",
  "Payment Type",
  "Detailed Notes",
  "Daily Price",
  "Total (Curr)",
  "Currency",
  "Voucher No",
  "Nationality",
  "Vip",
  "Room State",
]);

function filled(value) {
  if (value == null) return false;
  const s = String(value).trim();
  return s !== "" && s !== "null" && !/^nan$/i.test(s);
}

function listAugust(prefix) {
  return fs
    .readdirSync(AUGUST)
    .filter((f) => f.startsWith(prefix) && f.toLowerCase().endsWith(".xlsx"))
    .sort()
    .map((f) => path.join(AUGUST, f));
}

function readBook(filePath) {
  const wb = X.readFile(filePath, { cellDates: false });
  const sheetName = wb.SheetNames[0];
  const rows = X.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, raw: true });
  const headers = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  return { sheetName, rows, headers };
}

function unionHeaders(base, extras) {
  const seen = new Set(base);
  const out = [...base];
  for (const h of extras) {
    if (h === "Id") continue;
    if (!seen.has(h)) {
      seen.add(h);
      out.push(h);
    }
  }
  return out;
}

function writeBook(filePath, rows, headers, sheetName) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const ws = X.utils.json_to_sheet(rows, { header: headers });
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, String(sheetName || "import").slice(0, 31));
  X.writeFile(wb, filePath, { compression: true });
}

function copyToReady(rel) {
  const src = fileAt(START, rel);
  const dst = fileAt(READY, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function runNode(script, argv) {
  console.log(">>", path.basename(script), argv.join(" "));
  const r = spawnSync(process.execPath, [script, ...argv], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    windowsHide: true,
  });
  if (r.status) throw new Error(`${path.basename(script)} exited ${r.status}`);
}

function foldName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function serialYmd(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && value >= 1000 && value < 80000) {
    const d = X.SSF.parse_date_code(value);
    if (!d || d.y < 1901 || d.y > 2100) return "";
    return `${d.y}-${pad2(d.m)}-${pad2(d.d)}`;
  }
  const s = String(value);
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : "";
}

function roomKey(value) {
  const s = String(value ?? "").trim();
  if (/^\d{3,4}$/.test(s)) return String(Number(s));
  return s;
}

function parseReservationInfo(info) {
  const s = String(info || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return null;
  const dateRe = /(\d{1,2})\.(\d{1,2})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/;
  const dm = s.match(dateRe);
  if (!dm) return null;
  const endY = dm[5].length === 2 ? 2000 + Number(dm[5]) : Number(dm[5]);
  const startM = Number(dm[2]);
  const startD = Number(dm[1]);
  const endM = Number(dm[4]);
  const endD = Number(dm[3]);
  const startY = startM > endM || (startM === endM && startD > endD) ? endY - 1 : endY;
  const head = s.slice(0, dm.index).trim();
  const roomM = head.match(/^(\d{3,4})\b\s*(.*)$/);
  const room = roomM ? String(Number(roomM[1])) : "";
  const namesPart = (roomM ? roomM[2] : head).trim();
  const names = namesPart.split("/").map(foldName).filter(Boolean);
  return {
    room,
    names,
    arrival: `${startY}-${pad2(startM)}-${pad2(startD)}`,
    departure: `${endY}-${pad2(endM)}-${pad2(endD)}`,
  };
}

function namesMatch(noteNames, guestName) {
  const g = foldName(guestName);
  if (!g || !noteNames.length) return false;
  return noteNames.every((n) => g.includes(n));
}

function isFnbBookRow(row) {
  if (isFnbHouseLedger(row)) return true;
  const guest = String(row["Guest Name"] ?? "")
    .trim()
    .toUpperCase();
  if (guest.includes("999") && guest.includes("FB")) return true;
  if (guest === "CASH FOLIO") return true;
  return false;
}

/** House / walk-in FnB ledger — keep in #32, not hotel guest folio. */
function isFnbHouseLedger(row) {
  const guest = String(row["Guest Name"] ?? "")
    .trim()
    .toUpperCase();
  const agency = String(row["Agency"] ?? "")
    .trim()
    .toUpperCase();
  const dept = String(row["Department"] ?? "")
    .trim()
    .toUpperCase();

  if (guest.includes("999") && guest.includes("FB")) return true;
  if (["999 FB", "FB999", "999FB"].includes(guest)) return true;

  const fnbDept =
    dept === "XUDMANİ KAFE" ||
    dept === "XUDMANI KAFE" ||
    dept === "NAFTANI RESTAURANT" ||
    dept === "DİSCO BAR" ||
    dept === "DISCO BAR" ||
    dept.startsWith("F&B");

  if (guest === "CASH FOLIO" && (fnbDept || agency.includes("RESTORAN") || agency.includes("RESTAURANT"))) {
    return true;
  }
  if ((agency.includes("RESTORAN") || agency.includes("RESTAURANT")) && (!row["Res Id"] || Number(row["Res Id"]) === 0)) {
    return true;
  }
  return false;
}

function mergeFolioById(files) {
  const byId = new Map();
  const headers = [];
  const headerSet = new Set();
  let sheetName = "Folio merged";
  let totalRows = 0;
  const perFile = [];

  for (const filePath of files) {
    const book = readBook(filePath);
    if (book.sheetName) sheetName = book.sheetName;
    totalRows += book.rows.length;
    let added = 0;
    let updated = 0;
    let skipped = 0;
    for (const row of book.rows) {
      for (const key of Object.keys(row)) {
        if (!headerSet.has(key)) {
          headerSet.add(key);
          headers.push(key);
        }
      }
      const id = String(row.Id ?? "").trim();
      if (!id || id === "NaN" || id === "null" || id === "undefined") {
        skipped += 1;
        continue;
      }
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, row);
        added += 1;
      } else if (Object.values(row).filter(filled).length >= Object.values(prev).filter(filled).length) {
        byId.set(id, row);
        updated += 1;
      } else {
        skipped += 1;
      }
    }
    perFile.push({ file: path.basename(filePath), rows: book.rows.length, added, updated, skipped });
  }

  const merged = [...byId.values()].sort((a, b) => {
    const da = serialYmd(a.Date);
    const db = serialYmd(b.Date);
    if (da && db && da !== db) return da.localeCompare(db);
    return Number(a.Id) - Number(b.Id);
  });
  return { merged, headers, sheetName, totalRows, perFile };
}

function overlayAgencies() {
  const src = listAugust("Travel Agencies")[0];
  if (!src) throw new Error("August Travel Agencies missing");
  const startOut = fileAt(START, FILES.hotelAgencies);
  const readyOut = fileAt(READY, FILES.hotelAgencies);
  fs.copyFileSync(src, startOut);
  fs.copyFileSync(src, readyOut);
  const n = readBook(src).rows.length;
  return { file: path.basename(src), rows: n, startOut, readyOut };
}

function overlayGuests() {
  const augFile = listAugust("Guest Cards")[0];
  if (!augFile) throw new Error("August Guest Cards missing");
  const startPath = fileAt(START, FILES.hotelGuests);
  const base = readBook(startPath);
  const aug = readBook(augFile);
  const byId = new Map();
  for (const row of base.rows) {
    const id = String(row["Guest Id"] ?? "").trim();
    if (id) byId.set(id, { ...row });
  }
  let overlayed = 0;
  let added = 0;
  for (const row of aug.rows) {
    const id = String(row["Guest Id"] ?? row.Id ?? "").trim();
    if (!id || id === "NaN") continue;
    const incoming = { ...row };
    if (incoming.Id != null && incoming["Guest Id"] == null) incoming["Guest Id"] = incoming.Id;
    delete incoming.Id;
    const prev = byId.get(id);
    if (!prev) {
      const fresh = { "Guest Id": id };
      for (const [k, v] of Object.entries(incoming)) {
        if (k !== "Id" && filled(v)) fresh[k] = v;
      }
      byId.set(id, fresh);
      added += 1;
      continue;
    }
    let changed = false;
    for (const [k, v] of Object.entries(incoming)) {
      if (!filled(v)) continue;
      if (!filled(prev[k])) {
        prev[k] = v;
        changed = true;
      }
    }
    if (changed) overlayed += 1;
  }
  const headers = unionHeaders(base.headers, ["Guest Id", ...aug.headers]);
  const rows = [...byId.values()];
  writeBook(startPath, rows, headers, base.sheetName);
  copyToReady(FILES.hotelGuests);
  return {
    base: base.rows.length,
    august: aug.rows.length,
    overlayed,
    added,
    out: rows.length,
  };
}

function overlayReservations() {
  const startPath = fileAt(START, FILES.hotelReservations);
  const base = readBook(startPath);
  const byId = new Map();
  for (const row of base.rows) {
    const id = String(row["Res Id"] ?? "").trim();
    if (id && id !== "NaN") byId.set(id, { ...row });
  }
  let overlayed = 0;
  let added = 0;
  const extraHeaders = [];
  for (const filePath of listAugust("Front Office Control Panel")) {
    const book = readBook(filePath);
    for (const h of book.headers) extraHeaders.push(h);
    for (const row of book.rows) {
      const id = String(row["Res Id"] ?? "").trim();
      if (!id || id === "NaN") continue;
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, { ...row });
        added += 1;
        continue;
      }
      for (const [k, v] of Object.entries(row)) {
        if (!filled(v)) continue;
        if (k === "State" && filled(prev.State)) continue;
        if (RES_PREFER_IN.has(k) || !filled(prev[k])) prev[k] = v;
      }
      overlayed += 1;
    }
  }
  const headers = unionHeaders(base.headers, extraHeaders);
  const rows = [...byId.values()];
  writeBook(startPath, rows, headers, base.sheetName || "Reservations");
  copyToReady(FILES.hotelReservations);
  return { base: base.rows.length, overlayed, added, out: rows.length };
}

function packNotes(resRows) {
  const byStay = new Map();
  const byDates = new Map();
  const push = (map, key, row) => {
    if (!key) return;
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  };
  for (const row of resRows) {
    const id = String(row["Res Id"] ?? "").trim();
    if (!id || id === "NaN") continue;
    const arr = serialYmd(row.Arrival);
    const dep = serialYmd(row.Departure);
    const room = roomKey(row["Room No"]);
    if (arr && dep) {
      if (room) push(byStay, `${room}|${arr}|${dep}`, row);
      push(byDates, `${arr}|${dep}`, row);
    }
  }

  function matchRes(parsed, guestHint) {
    const fromStay = parsed.room ? byStay.get(`${parsed.room}|${parsed.arrival}|${parsed.departure}`) || [] : [];
    let hits = fromStay.filter((r) => namesMatch(parsed.names, r["Guest Name"]));
    if (!hits.length) {
      const dated = byDates.get(`${parsed.arrival}|${parsed.departure}`) || [];
      hits = dated.filter((r) => namesMatch(parsed.names, r["Guest Name"]));
      if (parsed.room) {
        const roomHits = hits.filter((r) => roomKey(r["Room No"]) === parsed.room);
        if (roomHits.length) hits = roomHits;
      }
    }
    if (guestHint) {
      const gHits = hits.filter((r) => foldName(r["Guest Name"]).includes(foldName(guestHint)));
      if (gHits.length) hits = gHits;
    }
    const ids = [...new Set(hits.map((r) => String(r["Res Id"]).trim()))];
    if (ids.length === 1) return { resId: ids[0], how: parsed.room ? "room-dates-names" : "dates-names" };
    if (ids.length > 1) return { resId: null, how: "ambiguous", n: ids.length };
    return { resId: null, how: "unmatched" };
  }

  const bags = new Map();
  const stats = {
    source: 0,
    skippedEmptyType: 0,
    skippedChannel: 0,
    skippedEmptyText: 0,
    skippedDisabled: 0,
    unmatched: 0,
    ambiguous: 0,
    matched: 0,
    types: {},
  };
  const unmatchedSample = [];

  for (const filePath of listAugust("Notes")) {
    const book = readBook(filePath);
    for (const row of book.rows) {
      stats.source += 1;
      const typeRaw = String(row["Note Type"] ?? "").trim();
      const typeKey = typeRaw.toUpperCase().replace(/\s+/g, " ");
      const text = String(row.Notes ?? "").trim();
      if (String(row["Is Disabled"] ?? "").toLowerCase() === "true" || row["Is Disabled"] === true) {
        stats.skippedDisabled += 1;
        continue;
      }
      if (String(row["Is Deleted"] ?? "").toLowerCase() === "true" || row["Is Deleted"] === true) {
        stats.skippedDisabled += 1;
        continue;
      }
      if (!typeRaw) {
        stats.skippedEmptyType += 1;
        continue;
      }
      if (SKIP_NOTE_TYPES.has(typeKey.replace(/ /g, "")) || typeKey === "CHANNEL") {
        stats.skippedChannel += 1;
        continue;
      }
      if (!text) {
        stats.skippedEmptyText += 1;
        continue;
      }
      const parsed = parseReservationInfo(row["Reservation Info"]);
      if (!parsed) {
        stats.unmatched += 1;
        if (unmatchedSample.length < 12) unmatchedSample.push(String(row["Reservation Info"] ?? "").slice(0, 80));
        continue;
      }
      const hit = matchRes(parsed, row.Guest);
      if (!hit.resId) {
        if (hit.how === "ambiguous") stats.ambiguous += 1;
        else stats.unmatched += 1;
        if (unmatchedSample.length < 12) unmatchedSample.push(String(row["Reservation Info"] ?? "").slice(0, 80));
        continue;
      }
      stats.matched += 1;
      stats.types[typeRaw] = (stats.types[typeRaw] || 0) + 1;
      const noteType = NOTE_TYPE_TO_ERA[typeKey] || typeRaw;
      const key = `${hit.resId}\t${noteType}`;
      const cur = bags.get(key) || { resId: hit.resId, noteType, parts: [] };
      cur.parts.push({ t: Number(row["Taken Time"]) || 0, text });
      bags.set(key, cur);
    }
  }

  const outRows = [...bags.values()]
    .map((b) => {
      b.parts.sort((a, c) => a.t - c.t);
      return {
        "Res Id": b.resId,
        "Note Type": b.noteType,
        Notes: [...new Set(b.parts.map((p) => p.text))].join("\n"),
      };
    })
    .sort((a, b) => String(a["Res Id"]).localeCompare(String(b["Res Id"])));

  const startPath = fileAt(START, FILES.hotelNotes);
  writeBook(startPath, outRows, ["Res Id", "Note Type", "Notes"], "Notes");
  copyToReady(FILES.hotelNotes);
  stats.outRows = outRows.length;
  stats.unmatchedSample = unmatchedSample;
  return stats;
}

function overlayFolio() {
  const mergedPath = fileAt(START, START_ARCHIVE.folioMerged);
  const files = [mergedPath, ...listAugust("Folio Transactions")];
  const { merged, headers, sheetName, totalRows, perFile } = mergeFolioById(files);
  writeBook(mergedPath, merged, headers, sheetName);

  const fnbPath = fileAt(START, FILES.fnbTx);
  const fnbById = new Map();
  if (fs.existsSync(fnbPath)) {
    for (const row of readBook(fnbPath).rows) {
      const id = String(row.Id ?? "").trim();
      if (id && id !== "NaN") fnbById.set(id, row);
    }
  }
  let fnbAdded = 0;
  for (const row of merged.filter(isFnbBookRow)) {
    const id = String(row.Id ?? "").trim();
    if (!id || id === "NaN") continue;
    if (!fnbById.has(id)) fnbAdded += 1;
    fnbById.set(id, row);
  }
  const fnb = [...fnbById.values()];
  writeBook(fnbPath, fnb, headers, "FnB");
  fs.mkdirSync(path.dirname(fileAt(READY, FILES.fnbTx)), { recursive: true });
  fs.copyFileSync(fnbPath, fileAt(READY, FILES.fnbTx));

  runNode(path.join(__dirname, "filter-hotel-folio-only.cjs"), ["--start", START, "--ready", READY]);
  runNode(path.join(__dirname, "split-hotel-folio-upload.cjs"), [READY]);

  return {
    sources: perFile,
    rawRows: totalRows,
    uniqueIds: merged.length,
    fnbRows: fnb.length,
    fnbAdded,
    mergedPath,
  };
}

function main() {
  if (!fs.existsSync(AUGUST)) {
    console.error("Missing August drop", AUGUST);
    process.exit(1);
  }

  const agencies = overlayAgencies();
  console.log("agencies", agencies.rows);

  const guests = overlayGuests();
  console.log("guests", guests);

  const reservations = overlayReservations();
  console.log("reservations", reservations);

  const resBook = readBook(fileAt(START, FILES.hotelReservations));
  const notes = packNotes(resBook.rows);
  console.log("notes", {
    source: notes.source,
    matched: notes.matched,
    unmatched: notes.unmatched,
    ambiguous: notes.ambiguous,
    outRows: notes.outRows,
  });

  const folio = overlayFolio();
  console.log("folio unique", folio.uniqueIds, "fnb", folio.fnbRows);

  const report = {
    builtAt: new Date().toISOString(),
    augustDir: AUGUST,
    keptUntouched: ["hotel/03-08 dictionaries", "hotel/15", "clinic/19-22 curated"],
    agencies,
    guests,
    reservations,
    notes,
    folio,
  };
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("report", REPORT);
}

main();
