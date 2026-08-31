"use strict";

/**
 * Apply WebOnly FO guest cards (passports) onto EW #10 and clinic #21.
 *
 *   node era-hotel-pms/scripts/apply-wo-fo-guest-bridge.cjs
 *
 * Needs dump-webonly-fo-guest-cards.cjs output. Optional:
 *   dump-webonly-fo-reservation-guests.cjs  (clinic stay → FO guestLookUpId)
 *
 * Writes PII under D:\ERA-BACKUP\… — never commit the books.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const XLSX = require(path.join(__dirname, "..", "node_modules", "xlsx"));

const DUMP_DIR = process.env.WO_FO_DUMP_DIR || path.join("D:", "ERA-BACKUP", "NAFTA-START", "hotel", "dump");
const EW_PATHS = [
  path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY", "hotel", "10-Guest-Cards.xlsx"),
  path.join("D:", "ERA-BACKUP", "NAFTA-START", "hotel", "10-Guest-Cards.xlsx"),
];
const CLINIC_PATHS = [
  path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY", "clinic", "24-Patients.xlsx"),
];
const FO_PATH = path.join(DUMP_DIR, "guest-cards.json");
const RES_PATH = path.join(DUMP_DIR, "reservation-guests.json");

const FIN_RE = /^[0-9A-HJ-NP-Za-hj-np-z]{7}$/;

function isValidAzFin(value) {
  return FIN_RE.test(String(value || "").trim());
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

function normDoc(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function filled(v) {
  return v != null && String(v).trim() !== "";
}

function ymd(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return "";
}

function classifyFoDoc(rawPass) {
  const t = String(rawPass || "").trim();
  if (!t) return { fin: "", passport: "" };
  if (isValidAzFin(t)) return { fin: t.toUpperCase(), passport: "" };
  return { fin: "", passport: t };
}

function indexMulti(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function pickUnique(list) {
  if (!list || list.length !== 1) return null;
  return list[0];
}

function mapFoGender(g) {
  if (g === 1) return "F";
  if (g === 2) return "M";
  return "";
}

function foDobDate(iso) {
  const d = ymd(iso);
  if (!d) return null;
  return new Date(`${d}T00:00:00.000Z`);
}

function loadEw(file) {
  const wb = XLSX.read(fs.readFileSync(file), { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, raw: true });
  const headers = Object.keys(rows[0] || {});
  return { sheetName, headers, rows };
}

function classifyEwRow(row) {
  const guestId = String(row["Guest Id"] ?? "").trim();
  const given = String(row.Name ?? "").trim();
  const sur = String(row["Last Name"] ?? "").trim();
  const docs = {
    national: String(row["National Id No"] ?? "").trim(),
    passCol: String(row["Passport No"] ?? "").trim(),
  };
  let fin = "";
  let passport = "";
  if (docs.national) {
    if (isValidAzFin(docs.national)) fin = docs.national.toUpperCase();
    else passport = docs.national;
  }
  if (docs.passCol) {
    if (isValidAzFin(docs.passCol)) {
      if (!fin) fin = docs.passCol.toUpperCase();
    } else {
      passport = docs.passCol;
    }
  }
  return {
    row,
    guestId,
    given,
    sur,
    fold: foldName(`${given} ${sur}`),
    dob: ymd(row["Birth Date"]),
    fin: normDoc(fin),
    passport: normDoc(passport),
    hasDoc: Boolean(fin || passport || docs.national || docs.passCol),
  };
}

function classifyFo(raw) {
  const docs = classifyFoDoc(raw.passport);
  const given = String(raw.name || "").trim();
  const sur = String(raw.surname || "").trim();
  return {
    raw,
    id: raw.id,
    given,
    sur,
    fold: foldName(`${given} ${sur}`),
    dob: ymd(raw.birthDate),
    fin: normDoc(docs.fin),
    passport: docs.passport,
    passportRaw: String(raw.passport || "").trim(),
    phone: String(raw.phone || "").trim(),
    email: String(raw.email || "").trim(),
    nationality: raw.nationality && raw.nationality.value ? String(raw.nationality.value) : "",
    gender: mapFoGender(raw.gender),
    plate: String(raw.vehiclePlate || "").trim(),
    visits: raw.totalVisits != null ? raw.totalVisits : "",
  };
}

function matchFoToEw(fo, ew) {
  const ewByPass = indexMulti(
    ew.filter((r) => r.passport),
    (r) => r.passport,
  );
  const ewByFin = indexMulti(
    ew.filter((r) => r.fin),
    (r) => r.fin,
  );
  const ewByNameDob = indexMulti(
    ew.filter((r) => r.fold && r.dob),
    (r) => `${r.fold}|${r.dob}`,
  );
  const links = [];
  for (const g of fo) {
    let hit = null;
    let how = "unmatched";
    if (g.passport) {
      hit = pickUnique(ewByPass.get(normDoc(g.passport)));
      if (hit) how = "passport";
    }
    if (!hit && g.fin) {
      hit = pickUnique(ewByFin.get(g.fin));
      if (hit) how = "fin";
    }
    if (!hit) {
      const byRef = ew.find((r) => r.guestId === `wo:fo:${g.id}`);
      if (byRef) {
        hit = byRef;
        how = "wo-fo-id";
      }
    }
    if (!hit && g.fold && g.dob) {
      const swapped = foldName(`${g.sur} ${g.given}`);
      const list =
        ewByNameDob.get(`${g.fold}|${g.dob}`) ||
        (swapped && swapped !== g.fold ? ewByNameDob.get(`${swapped}|${g.dob}`) : null) ||
        [];
      if (list.length === 1) {
        hit = list[0];
        how = "name+dob";
      } else if (list.length > 1) {
        how = "ambiguous-name-dob";
      }
    }
    links.push({ fo: g, ew: hit, how });
  }
  return links;
}

function guestsFromReservation(data) {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.guestsSections) || Array.isArray(data.departedGuestsSections)) {
    return [...(data.guestsSections || []), ...(data.departedGuestsSections || [])];
  }
  if (Array.isArray(data.guests)) return data.guests;
  if (Array.isArray(data)) {
    const nested = [];
    for (const row of data) {
      nested.push(...guestsFromReservation(row));
    }
    return nested;
  }
  if (data.reservationTotalSection && Array.isArray(data.reservationTotalSection.guestsSections)) {
    return data.reservationTotalSection.guestsSections;
  }
  return [];
}

function clinicFromRes(resDump, foById, patient) {
  const resId = String(patient.hotelResNo || "").trim();
  if (!resId || !resDump[resId]) return null;
  const guests = guestsFromReservation(resDump[resId]);
  if (!guests.length) return null;
  const folio = Number(patient.folioPerson);
  let section = null;
  if (Number.isFinite(folio) && folio > 0 && guests[folio - 1]) {
    section = guests[folio - 1];
  } else if (guests.length === 1) {
    section = guests[0];
  }
  if (!section) return null;
  const look = section.guestLookUpId ?? section.id;
  if (look == null) return null;
  return foById.get(Number(look)) || foById.get(look) || null;
}

function writeXlsx(file, sheetName, headers, rows) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers, skipHeader: false, cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (sheetName || "Sheet1").slice(0, 31));
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellDates: true });
  const tmp = file.replace(/\.xlsx$/i, ".bridge.tmp.xlsx");
  fs.writeFileSync(tmp, buf);
  fs.copyFileSync(tmp, file);
  fs.unlinkSync(tmp);
}

function emptyEwRow(headers) {
  const row = {};
  for (const h of headers) row[h] = null;
  return row;
}

function main() {
  if (!fs.existsSync(FO_PATH)) {
    process.stderr.write(`skip: missing ${FO_PATH} — run dump-webonly-fo-guest-cards.cjs first.\n`);
    process.exit(0);
  }
  const foRaw = JSON.parse(fs.readFileSync(FO_PATH, "utf8"));
  const fo = (Array.isArray(foRaw) ? foRaw : []).map(classifyFo);
  const foById = new Map(fo.map((g) => [g.id, g]));
  let resDump = {};
  if (fs.existsSync(RES_PATH)) {
    resDump = JSON.parse(fs.readFileSync(RES_PATH, "utf8"));
  }

  const ewFile = EW_PATHS.find((p) => fs.existsSync(p));
  if (!ewFile) {
    process.stderr.write("Missing EW 10-Guest-Cards.xlsx\n");
    process.exit(2);
  }
  const ewBook = loadEw(ewFile);
  const seenIds = new Set();
  ewBook.rows = ewBook.rows.filter((row) => {
    const id = String(row["Guest Id"] ?? "").trim();
    if (!id) return true;
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
  const ew = ewBook.rows.map(classifyEwRow);
  const links = matchFoToEw(fo, ew);

  let overlayPassport = 0;
  let overlayFin = 0;
  let skippedHasDoc = 0;
  const matchedIds = new Set();
  for (const link of links) {
    if (!link.ew) continue;
    matchedIds.add(link.fo.id);
    if (link.ew.hasDoc) {
      skippedHasDoc += 1;
      continue;
    }
    if (link.fo.fin) {
      link.ew.row["National Id No"] = link.fo.fin;
      overlayFin += 1;
    } else if (link.fo.passportRaw) {
      link.ew.row["Passport No"] = link.fo.passportRaw;
      overlayPassport += 1;
    }
  }

  let maxHash = 0;
  for (const row of ewBook.rows) {
    const n = Number(row["#"]);
    if (Number.isFinite(n) && n > maxHash) maxHash = n;
  }

  let appended = 0;
  for (const link of links) {
    if (link.ew || link.how === "ambiguous-name-dob") continue;
    const g = link.fo;
    const foRef = `wo:fo:${g.id}`;
    if (seenIds.has(foRef)) continue;
    seenIds.add(foRef);
    const row = emptyEwRow(ewBook.headers);
    maxHash += 1;
    if ("#" in row) row["#"] = maxHash;
    row["Guest Id"] = `wo:fo:${g.id}`;
    row.Name = g.given;
    row["Last Name"] = g.sur;
    if (g.fin) row["National Id No"] = g.fin;
    else row["Passport No"] = g.passportRaw || null;
    row["Birth Date"] = foDobDate(g.raw.birthDate);
    row.Nationality = g.nationality || null;
    row.Phone = g.phone || null;
    row.Email = g.email || null;
    row.Gender = g.gender || null;
    row["Vehicle Plate"] = g.plate || null;
    row["Repeat Count"] = g.visits || null;
    row["Has Email"] = filled(g.email) ? "True" : "False";
    row["Has Phone"] = filled(g.phone) ? "True" : "False";
    ewBook.rows.push(row);
    appended += 1;
  }

  for (const dest of EW_PATHS) {
    if (!fs.existsSync(path.dirname(dest))) continue;
    writeXlsx(dest, ewBook.sheetName, ewBook.headers, ewBook.rows);
  }

  const dates = spawnSync(process.execPath, [path.join(__dirname, "rebuild-guest-cards-dates.cjs")], {
    stdio: "inherit",
  });
  if (dates.status) {
    process.stderr.write("date rewrite failed (books still written)\n");
  }

  const foToEwId = new Map();
  for (const link of links) {
    if (link.ew) foToEwId.set(link.fo.id, link.ew.guestId);
  }

  const clinicFile = CLINIC_PATHS.find((p) => fs.existsSync(p));
  const clinicWb = XLSX.read(fs.readFileSync(clinicFile), { type: "buffer", cellDates: true });
  const clinicSheet = clinicWb.SheetNames[0];
  const clinicRows = XLSX.utils.sheet_to_json(clinicWb.Sheets[clinicSheet], { defval: "", raw: false });
  const clinicHeaders = Object.keys(clinicRows[0] || {});
  if (!clinicHeaders.includes("passport")) clinicHeaders.splice(clinicHeaders.indexOf("uniqueId") + 1, 0, "passport");

  const foByNameDob = indexMulti(
    fo.filter((g) => g.fold && g.dob),
    (g) => `${g.fold}|${g.dob}`,
  );

  let clinicFoName = 0;
  let clinicFoStay = 0;
  let clinicNone = 0;
  const bridge = [];
  for (const row of clinicRows) {
    const given = String(row.givenName || "").trim();
    const sur = String(row.surname || "").trim();
    const fold = foldName(`${given} ${sur}` || row.fullName || "");
    const dob = ymd(row.birthDate);
    const swapped = given && sur ? foldName(`${sur} ${given}`) : "";
    let g =
      pickUnique(foByNameDob.get(`${fold}|${dob}`)) ||
      (swapped && swapped !== fold ? pickUnique(foByNameDob.get(`${swapped}|${dob}`)) : null);
    let how = g ? "name+dob" : "";
    if (!g) {
      g = clinicFromRes(resDump, foById, row);
      if (g) how = "stay";
    }
    if (!g) {
      clinicNone += 1;
      row.uniqueId = row.uniqueId || "";
      row.passport = row.passport || "";
      bridge.push({ woId: row.woId, how: "none", hotelResNo: row.hotelResNo });
      continue;
    }
    if (how === "name+dob") clinicFoName += 1;
    else clinicFoStay += 1;
    row.uniqueId = String(g.id);
    row.passport = g.passportRaw;
    const ewGuestId = foToEwId.get(g.id) || `wo:fo:${g.id}`;
    bridge.push({
      woId: row.woId,
      how,
      foId: g.id,
      passport: g.passportRaw,
      ewGuestId,
      hotelResNo: row.hotelResNo,
    });
  }

  for (const dest of CLINIC_PATHS) {
    writeXlsx(dest, clinicSheet, clinicHeaders, clinicRows);
  }

  const summary = {
    fetchedAt: new Date().toISOString(),
    foCount: fo.length,
    ewRowsAfter: ewBook.rows.length,
    overlayPassport,
    overlayFin,
    skippedHasDoc,
    appendedFoOnly: appended,
    clinicCount: clinicRows.length,
    clinicFoName,
    clinicFoStay,
    clinicNone,
    reservationDump: Object.keys(resDump).length,
  };
  fs.mkdirSync(DUMP_DIR, { recursive: true });
  fs.writeFileSync(path.join(DUMP_DIR, "fo-guest-bridge.summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(DUMP_DIR, "fo-patient-bridge.json"), `${JSON.stringify(bridge, null, 2)}\n`, "utf8");
  process.stdout.write(
    `EW overlay passport=${overlayPassport} fin=${overlayFin} append=${appended} (skip existing doc ${skippedHasDoc})\n` +
      `clinic ${clinicRows.length} FO name+dob=${clinicFoName} stay=${clinicFoStay} none=${clinicNone}\n`,
  );
}

main();
