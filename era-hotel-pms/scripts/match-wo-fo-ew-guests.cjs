"use strict";

/**
 * Match WebOnly FO guest cards to Elektraweb 10-Guest-Cards.xlsx.
 *
 *   node era-hotel-pms/scripts/match-wo-fo-ew-guests.cjs
 *
 * Writes D:\ERA-BACKUP\NAFTA-START\hotel\dump\guest-cards.ew-match.json (PII — not git).
 */

const fs = require("fs");
const path = require("path");
const XLSX = require(path.join(__dirname, "..", "node_modules", "xlsx"));

const DUMP_DIR = process.env.WO_FO_DUMP_DIR || path.join("D:", "ERA-BACKUP", "NAFTA-START", "hotel", "dump");
const EW_XLSX =
  process.env.EW_GUESTS_XLSX ||
  path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY", "hotel", "10-Guest-Cards.xlsx");
const CLINIC_PATIENTS =
  process.env.CLINIC_PATIENTS_XLSX ||
  path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY", "clinic", "24-Patients.xlsx");

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

function ymd(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return "";
}

function classifyEw(row) {
  const national = String(row["National Id No"] || row["National ID No"] || "").trim();
  const passCol = String(row["Passport No"] || row.Passport || "").trim();
  let fin = "";
  let passport = "";
  if (national) {
    if (isValidAzFin(national)) fin = national.toUpperCase();
    else passport = national;
  }
  if (passCol) {
    if (isValidAzFin(passCol)) {
      if (!fin) fin = passCol.toUpperCase();
    } else {
      passport = passCol;
    }
  }
  const given = String(row.Name || row["Given Name"] || "").trim();
  const sur = String(row["Last Name"] || row.Surname || "").trim();
  return {
    guestId: String(row["Guest Id"] || row.GuestId || "").trim(),
    given,
    sur,
    fold: foldName(`${given} ${sur}`),
    dob: ymd(row["Birth Date"] || row.BirthDate),
    fin: normDoc(fin),
    passport: normDoc(passport),
    phone: String(row.Phone || row["Phone Number"] || "").replace(/\D/g, "").slice(-9),
  };
}

function classifyFo(row) {
  const rawPass = String(row.passport || "").trim();
  const fin = isValidAzFin(rawPass) ? rawPass.toUpperCase() : "";
  const passport = fin ? "" : normDoc(rawPass);
  const given = String(row.name || "").trim();
  const sur = String(row.surname || "").trim();
  return {
    id: row.id,
    given,
    sur,
    fold: foldName(`${given} ${sur}`),
    dob: ymd(row.birthDate),
    fin: normDoc(fin),
    passport,
    phone: String(row.phone || "").replace(/\D/g, "").slice(-9),
    nationality: row.nationality && row.nationality.value ? String(row.nationality.value) : "",
  };
}

function loadEw() {
  const wb = XLSX.read(fs.readFileSync(EW_XLSX), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
  return rows.map(classifyEw).filter((r) => r.guestId);
}

function loadClinic() {
  if (!fs.existsSync(CLINIC_PATIENTS)) return [];
  const wb = XLSX.read(fs.readFileSync(CLINIC_PATIENTS), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
  return rows.map((row) => {
    const given = String(row.givenName || "").trim();
    const sur = String(row.surname || "").trim();
    return {
      woId: String(row.woId || row.externalRef || "").trim(),
      given,
      sur,
      fold: foldName(`${given} ${sur}` || row.fullName || ""),
      dob: ymd(row.birthDate),
      hotelResNo: String(row.hotelResNo || "").trim(),
      folioPerson: String(row.folioPerson || "").trim(),
      uniqueId: String(row.uniqueId || "").trim(),
      phone: String(row.phone || "").replace(/\D/g, "").slice(-9),
    };
  });
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

function main() {
  const foPath = path.join(DUMP_DIR, "guest-cards.json");
  if (!fs.existsSync(foPath)) {
    process.stderr.write(`Missing ${foPath} — run dump-webonly-fo-guest-cards.cjs first.\n`);
    process.exit(2);
  }
  const foRaw = JSON.parse(fs.readFileSync(foPath, "utf8"));
  const fo = (Array.isArray(foRaw) ? foRaw : []).map(classifyFo);
  const ew = loadEw();
  const clinic = loadClinic();

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

  const matches = [];
  let byPassport = 0;
  let byFin = 0;
  let byNameDob = 0;
  let unmatched = 0;
  let ambiguous = 0;

  for (const g of fo) {
    let hit = null;
    let how = "";
    if (g.passport) {
      hit = pickUnique(ewByPass.get(g.passport));
      if (hit) how = "passport";
    }
    if (!hit && g.fin) {
      hit = pickUnique(ewByFin.get(g.fin));
      if (hit) how = "fin";
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
        ambiguous += 1;
        matches.push({
          foId: g.id,
          how: "ambiguous-name-dob",
          ewGuestIds: list.map((x) => x.guestId),
          fold: g.fold,
          dob: g.dob,
        });
        continue;
      }
    }
    if (!hit) {
      unmatched += 1;
      matches.push({ foId: g.id, how: "unmatched", fold: g.fold, dob: g.dob, hasDoc: Boolean(g.passport || g.fin) });
      continue;
    }
    if (how === "passport") byPassport += 1;
    else if (how === "fin") byFin += 1;
    else byNameDob += 1;
    matches.push({
      foId: g.id,
      how,
      ewGuestId: hit.guestId,
      fold: g.fold,
      dob: g.dob,
    });
  }

  const foByNameDob = indexMulti(
    fo.filter((r) => r.fold && r.dob),
    (r) => `${r.fold}|${r.dob}`,
  );
  let clinicToFo = 0;
  let clinicToEw = 0;
  const clinicJoin = [];
  for (const p of clinic) {
    if (!p.fold || !p.dob) {
      clinicJoin.push({ woId: p.woId, how: "no-name-dob" });
      continue;
    }
    const swapped = p.given && p.sur ? foldName(`${p.sur} ${p.given}`) : "";
    const fos =
      foByNameDob.get(`${p.fold}|${p.dob}`) ||
      (swapped && swapped !== p.fold ? foByNameDob.get(`${swapped}|${p.dob}`) : null) ||
      [];
    const foHit = pickUnique(fos);
    if (!foHit) {
      clinicJoin.push({
        woId: p.woId,
        how: fos.length > 1 ? "ambiguous-fo" : "no-fo",
        hotelResNo: p.hotelResNo,
      });
      continue;
    }
    clinicToFo += 1;
    const ewHit =
      (foHit.passport && pickUnique(ewByPass.get(foHit.passport))) ||
      (foHit.fin && pickUnique(ewByFin.get(foHit.fin))) ||
      pickUnique(ewByNameDob.get(`${foHit.fold}|${foHit.dob}`));
    if (ewHit) clinicToEw += 1;
    clinicJoin.push({
      woId: p.woId,
      how: ewHit ? "fo+ew" : "fo-only",
      foId: foHit.id,
      ewGuestId: ewHit ? ewHit.guestId : "",
      passport: foHit.passport || foHit.fin || "",
      hotelResNo: p.hotelResNo,
    });
  }

  const report = {
    fetchedAt: new Date().toISOString(),
    foCount: fo.length,
    ewCount: ew.length,
    clinicCount: clinic.length,
    foToEw: {
      byPassport,
      byFin,
      byNameDob,
      ambiguous,
      unmatched,
      matched: byPassport + byFin + byNameDob,
    },
    clinicToFo,
    clinicToEw,
  };

  fs.writeFileSync(path.join(DUMP_DIR, "guest-cards.ew-match.summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(DUMP_DIR, "guest-cards.ew-match.json"),
    `${JSON.stringify({ report, foToEw: matches, clinicJoin }, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(
    `FO ${fo.length} → EW matched ${report.foToEw.matched} (passport ${byPassport} / FIN ${byFin} / name+dob ${byNameDob}) unmatched ${unmatched} ambiguous ${ambiguous}\n` +
      `clinic ${clinic.length} → FO ${clinicToFo} → EW ${clinicToEw}\n`,
  );
}

main();
