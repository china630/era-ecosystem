"use strict";

/**
 * Build clinic #24 package stamps from FO-with-Notes extract + long Notes (#12).
 *
 * ERA-PKG: Extra Req only.
 * Old free-text packages: Extra, Res, CIn, Operator, Payment.
 * Həmkarlar FO slice (Jun 1+) is merged so September Reservation rows are not dropped.
 *
 *   node era-clinic/scripts/nafta-cutover/enrich-package-stamps.cjs
 */

const fs = require("fs");
const path = require("path");

const REPORTS = path.join(__dirname, "../../../reports/nafta-ew-notes-2026");
const { FILES, fileAt } = require("./pack-layout.cjs");

function isLeisureAgency(a) {
  if (!a) return false;
  return /^walkin\s+leisure/i.test(a) || /walk[\s-]?in\s+leisure/i.test(a);
}

function agencySku(agency) {
  if (!agency?.trim()) return null;
  const raw = agency.trim();
  if (isLeisureAgency(raw)) return null;
  if (/^walkin\s+medical$/i.test(raw) || /^walk[\s-]?in\s+medical$/i.test(raw)) return null;
  if (/\bleisure\b/i.test(raw) && !/\b(premium|dermo|detoks|detox)\b/i.test(raw)) return null;
  if (/h[əe]mkarlar|hemkarlar|həmkərlar/i.test(raw)) return "PKG-STANDART";
  if (/\bpremium\b/i.test(raw)) return "PKG-PREMIUM";
  if (/\bdermo\b/i.test(raw) || /fecebook\s+dermo|facebook\s+dermo/i.test(raw)) {
    return "PKG-DERMO";
  }
  if (/\bdetoks\b|\bdetox\b/i.test(raw)) return "PKG-DETOKS";
  if (/\bstandart\b/i.test(raw) && /paket|walkin|walk[\s-]?in|medical/i.test(raw)) {
    return "PKG-STANDART";
  }
  return null;
}

function phraseSku(text) {
  if (!text) return null;
  if (/dermo\s*paket|пакет\s*dermo|dermo\s*package/i.test(text)) return "PKG-DERMO";
  if (/detoks\s*paket|detox\s*paket|пакет\s*detoks/i.test(text)) return "PKG-DETOKS";
  if (/premium\s*paket|пакет\s*premium|premium\s*package/i.test(text)) return "PKG-PREMIUM";
  if (/standart\s*paket|стандарт\s*пакет|standard\s*package/i.test(text)) {
    return "PKG-STANDART";
  }
  if (/\bdermo\b/i.test(text) && /\+|paket|пакет|96|180/i.test(text)) return "PKG-DERMO";
  if (/\bpremium\b/i.test(text) && /\+|paket|пакет|96|193|349/i.test(text)) return "PKG-PREMIUM";
  return null;
}

/** ERA-PKG is Extra Req only (FO template). */
function parseEraPkg(extraReq) {
  if (!extraReq || !/ERA-PKG/i.test(extraReq)) return null;
  const m = extraReq.match(/ERA-PKG\s*[:\-]?\s*(\S+)/i);
  if (!m) return null;
  const map = {
    STANDART: "PKG-STANDART",
    STANDARD: "PKG-STANDART",
    PREMIUM: "PKG-PREMIUM",
    DERMO: "PKG-DERMO",
    DETOKS: "PKG-DETOKS",
    DETOX: "PKG-DETOKS",
    "PKG-STANDART": "PKG-STANDART",
    "PKG-PREMIUM": "PKG-PREMIUM",
    "PKG-DERMO": "PKG-DERMO",
    "PKG-DETOKS": "PKG-DETOKS",
  };
  const key = m[1].toUpperCase();
  return map[key] || map[key.replace(/^PKG-?/, "")] || null;
}

function packageNameHits(text) {
  const names = [];
  if (!text) return names;
  if (/dermo/i.test(text) && /paket|пакет|package|\+/i.test(text)) names.push("dermo");
  if (/(detoks|detox)/i.test(text) && /paket|пакет|package|\+/i.test(text)) names.push("detoks");
  if (/premium/i.test(text) && /paket|пакет|package|\+/i.test(text)) names.push("premium");
  if (/(standart|стандарт|standard)/i.test(text) && /paket|пакет|package|\+/i.test(text)) {
    names.push("standart");
  }
  return [...new Set(names)];
}

/**
 * Mix = two commercial SKUs on one card (180+96, DERMO+STANDART, catalog 289/276).
 * Upgrade «Standart paketdən Premium paketə» is not mix.
 * Bare «349+174» with a single package word is not mix.
 */
function detectMix(text, nightly) {
  if (nightly === 289 || nightly === 276 || nightly === 340 || nightly === 285) {
    return `compose-total ${nightly}`;
  }
  if (!text) return null;
  if (/paketd[əe]n.+(premium|dermo|detoks|standart)\s*paket/i.test(text)) return null;
  const names = packageNameHits(text);
  if (names.length >= 2 && (/\d+\s*\+\s*\d+/.test(text) || /\+|gızı|companion/i.test(text))) {
    return text.slice(0, 80);
  }
  if (/dermo\s*\+\s*standart|premium\s*\+\s*standart|detoks\s*\+\s*standart/i.test(text)) {
    return text.slice(0, 80);
  }
  return null;
}

function inferFromNightly(nightly, adults) {
  if (nightly == null || Number.isNaN(Number(nightly))) return null;
  const n = Number(nightly);
  const a = Number(adults) || 1;
  const exact = {
    139: { code: "PKG-STANDART", conf: "high", note: "occ1 catalog" },
    239: { code: "PKG-STANDART", conf: "high", note: "occ2 catalog" },
    193: { code: "PKG-PREMIUM", conf: "high", note: "occ1 catalog" },
    349: { code: "PKG-PREMIUM", conf: "high", note: "occ2 catalog" },
    180: { code: "PKG-DERMO", conf: "high", note: "occ1 catalog" },
    321: { code: "PKG-DERMO", conf: "high", note: "occ2 catalog" },
    178: { code: "PKG-DETOKS", conf: "high", note: "occ1 catalog" },
    319: { code: "PKG-DETOKS", conf: "med", note: "occ2-ish detoks" },
    289: { code: "MIX", conf: "high", note: "193+96 Premium+Standart" },
    276: { code: "MIX", conf: "high", note: "180+96 Dermo+Standart companion" },
    340: { code: "MIX", conf: "high", note: "180+160 Dermo+Detoks half" },
  };
  if (exact[n]) return exact[n];
  if (n === 129 || n === 119 || n === 110) {
    return { code: "PKG-STANDART", conf: "med", note: "standart-like discounted occ1" };
  }
  if (n === 192 || n === 189 || n === 199) {
    return { code: "PKG-PREMIUM", conf: "med", note: "premium-like occ1" };
  }
  if (n === 179) {
    return { code: "PKG-DERMO", conf: "med", note: "dermo-like occ1" };
  }
  if (n === 285 || n === 273 || n === 279) {
    return { code: "MIX", conf: "med", note: "compose-like mix total" };
  }
  if (a >= 2 && (n === 249 || n === 226 || n === 219 || n === 230)) {
    return { code: "PKG-STANDART", conf: "low", note: "double medical-ish (agency net)" };
  }
  return null;
}

function medicalAgencyDefault(agency) {
  if (!agency) return null;
  if (isLeisureAgency(agency)) return null;
  if (/\bleisure\b/i.test(agency)) return null;
  if (!/\bmedical\b/i.test(agency)) return null;
  return "PKG-STANDART";
}

function phraseBlob(row) {
  return [
    row.EXTRA_REQ,
    row.RES_NOTE,
    row.CIN_NOTE,
    row.OPERATOR_NOTE,
    row.PAYMENT_NOTE,
  ]
    .filter(Boolean)
    .join("\n");
}

function enrichRow(r) {
  const blob = phraseBlob(r);
  const mixHint = detectMix(blob, r.nightlySell);

  let migrationSku = null;
  let migrationSource = null;
  let migrationConf = null;

  const era = parseEraPkg(r.EXTRA_REQ);
  if (era) {
    migrationSku = era;
    migrationSource = "ERA-PKG";
    migrationConf = "high";
  }

  const ph = !era ? phraseSku(blob) : null;
  if (!migrationSku && ph && !mixHint) {
    migrationSku = ph;
    migrationSource = "phrase";
    migrationConf = "high";
  }

  const ag = agencySku(r.agency);
  if (!migrationSku && ag && !mixHint) {
    migrationSku = ag;
    migrationSource = "agency-prefix";
    migrationConf = "high";
  }

  if (!migrationSku && !mixHint) {
    const priceInf = inferFromNightly(r.nightlySell, r.adult);
    if (priceInf) {
      if (priceInf.code === "MIX") {
        migrationSource = "price-mix";
        migrationConf = priceInf.conf;
      } else {
        migrationSku = priceInf.code;
        migrationSource = "price-note";
        migrationConf = priceInf.conf;
      }
    }
  }

  if (!migrationSku && !mixHint) {
    const soft = medicalAgencyDefault(r.agency);
    if (soft) {
      migrationSku = soft;
      migrationSource = "agency-medical-default";
      migrationConf = "low";
    }
  }

  if (mixHint && !migrationSku) {
    migrationSource = migrationSource || "mix-hint";
    migrationConf = migrationConf || "med";
  }

  const leisure = r.stayKind === "leisure" || (isLeisureAgency(r.agency) && !r.EXTRA_REQ);

  return {
    ...r,
    migrationSku: leisure ? null : migrationSku,
    migrationSource: leisure ? "leisure-skip" : migrationSource,
    migrationConf: leisure ? null : migrationConf,
    mixHint: leisure ? null : mixHint,
    agencyPrefixHit: Boolean(ag),
    needsFoReview:
      !leisure &&
      (!migrationSku ||
        migrationConf === "low" ||
        Boolean(mixHint) ||
        migrationSource === "agency-medical-default"),
  };
}

function parsePriceNote(pn) {
  const m = (pn || "").match(/(\d+)\s*\*\s*([\d.,]+)/);
  if (!m) return null;
  return { nights: Number(m[1]), nightly: Number(m[2].replace(",", ".")) };
}

function cell(r, k) {
  const v = r[k];
  if (v == null) return "";
  return String(v).trim();
}

function foWideToMigrationRow(r) {
  const extra = cell(r, "Extra Req");
  const price = parsePriceNote(cell(r, "Price Note"));
  const agency = cell(r, "Agency");
  return {
    externalRef: cell(r, "Res Id"),
    agency,
    guests: cell(r, "Guest Names"),
    adult: cell(r, "Adult"),
    arrival: cell(r, "Arrival"),
    departure: cell(r, "Departure"),
    days: cell(r, "Day"),
    room: cell(r, "Room"),
    roomType: cell(r, "Room Type"),
    givenRoomType: cell(r, "Given Room Type"),
    total: cell(r, "Total (Curr)"),
    resState: cell(r, "Res State"),
    accomType: cell(r, "Accom Type"),
    stayKind: isLeisureAgency(agency) ? "leisure" : "medical",
    resolvedSku: null,
    resolveSource: null,
    nightlySell: price?.nightly ?? null,
    priceNights: price?.nights ?? null,
    EXTRA_REQ: extra,
    RES_NOTE: cell(r, "Res Note"),
    PRICE_NOTE: cell(r, "Price Note"),
    CIN_NOTE: cell(r, "CIn Note"),
    COUT_NOTE: cell(r, "#COut Note#"),
    ROOM_NOTE: cell(r, "Room Note"),
    CANCEL_NOTE: cell(r, "Cancel Note"),
    PAYMENT_NOTE: cell(r, "Payment Note"),
    INVOICE_NOTE: cell(r, "Invoice Note"),
    OPERATOR_NOTE: "",
  };
}

const LONG_NOTE_TO_FIELD = {
  "OPERATOR NOTE": "OPERATOR_NOTE",
  "GENERAL NOTES": "OPERATOR_NOTE",
  "GENERAL NOTE": "OPERATOR_NOTE",
  "PAYMENT INFO": "PAYMENT_NOTE",
  "PAYMENT NOTE": "PAYMENT_NOTE",
  "CHECKIN NOTE": "CIN_NOTE",
  "RES NOTE": "RES_NOTE",
};

function joinLongNotes(rows, longNoteRows) {
  const bags = new Map();
  for (const n of longNoteRows) {
    const id = cell(n, "Res Id");
    const typeKey = cell(n, "Note Type").toUpperCase();
    const field = LONG_NOTE_TO_FIELD[typeKey];
    const text = cell(n, "Notes");
    if (!id || !field || !text) continue;
    const cur = bags.get(id) || {};
    cur[field] = cur[field] ? `${cur[field]}\n${text}` : text;
    bags.set(id, cur);
  }
  return rows.map((r) => {
    const next = { ...r, OPERATOR_NOTE: r.OPERATOR_NOTE || "" };
    const extra = bags.get(String(r.externalRef));
    if (!extra) return next;
    for (const [field, text] of Object.entries(extra)) {
      const prev = String(next[field] || "").trim();
      if (!prev) next[field] = text;
      else if (!prev.includes(text)) next[field] = `${prev}\n${text}`;
    }
    return next;
  });
}

function appendMissingFoRows(rows, foRows) {
  const have = new Set(rows.map((r) => String(r.externalRef)));
  const added = [];
  for (const raw of foRows) {
    const mapped = foWideToMigrationRow(raw);
    if (!mapped.externalRef || have.has(mapped.externalRef)) continue;
    have.add(mapped.externalRef);
    added.push(mapped);
    rows.push(mapped);
  }
  return added;
}

function loadXlsx() {
  const candidates = [
    path.join(__dirname, "../../node_modules/xlsx"),
    path.join(__dirname, "../../../era-hotel-pms/node_modules/xlsx"),
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

function readSheet(XLSX, fp) {
  if (!fp || !fs.existsSync(fp)) return [];
  const wb = XLSX.readFile(fp, { cellDates: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false });
}

function hemkarlarFoPath() {
  const env = process.env.NAFTA_HEMKARLAR_FO;
  if (env && fs.existsSync(env)) return env;
  const inReports = path.join(REPORTS, "hemkarlar-fo-from-jun.xlsx");
  if (fs.existsSync(inReports)) return inReports;
  const downloads = path.join(
    process.env.USERPROFILE || "",
    "Downloads",
    "Front Office With Notes.2026-08-31.15-55-05.Nafta Sanatorium Hotel.xlsx",
  );
  return fs.existsSync(downloads) ? downloads : "";
}

function longNotesPath() {
  const env = process.env.NAFTA_HOTEL_NOTES;
  if (env && fs.existsSync(env)) return env;
  const ready = process.env.NAFTA_READY || path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY");
  return fileAt(ready, FILES.hotelNotes);
}

function summarize(enriched) {
  const stats = {
    total: enriched.length,
    withMigrationSku: enriched.filter((r) => r.migrationSku).length,
    agencyPrefixHits: enriched.filter((r) => r.agencyPrefixHit).length,
    mixHints: enriched.filter((r) => r.mixHint).length,
    leisureSkip: enriched.filter((r) => r.migrationSource === "leisure-skip").length,
    needsFoReview: enriched.filter((r) => r.needsFoReview).length,
    bySku: {},
    bySource: {},
    hemkarlar: enriched.filter((r) => /h[əe]mkarlar/i.test(r.agency || "")).length,
    phraseFromOperator: enriched.filter(
      (r) => r.migrationSource === "phrase" && r.OPERATOR_NOTE && phraseSku(r.OPERATOR_NOTE),
    ).length,
    phraseFromPayment: enriched.filter(
      (r) => r.migrationSource === "phrase" && r.PAYMENT_NOTE && phraseSku(r.PAYMENT_NOTE),
    ).length,
  };
  for (const r of enriched) {
    if (r.migrationSku) stats.bySku[r.migrationSku] = (stats.bySku[r.migrationSku] || 0) + 1;
    if (r.migrationSource) stats.bySource[r.migrationSource] = (stats.bySource[r.migrationSource] || 0) + 1;
  }
  stats.coveragePct = Math.round((1000 * stats.withMigrationSku) / Math.max(1, stats.total)) / 10;
  return stats;
}

function writeOutputs(enriched, extraMeta) {
  const stats = { ...summarize(enriched), ...extraMeta };
  fs.writeFileSync(path.join(REPORTS, "migration-rows-enriched.json"), JSON.stringify(enriched, null, 2));
  fs.writeFileSync(path.join(REPORTS, "enrichment-stats.json"), JSON.stringify(stats, null, 2));

  const stampCsvCols = [
    "externalRef",
    "agency",
    "guests",
    "adult",
    "arrival",
    "departure",
    "days",
    "nightlySell",
    "stayKind",
    "agencyPrefixHit",
    "migrationSku",
    "migrationSource",
    "migrationConf",
    "mixHint",
    "needsFoReview",
    "EXTRA_REQ",
    "RES_NOTE",
    "CIN_NOTE",
    "OPERATOR_NOTE",
    "PAYMENT_NOTE",
    "PRICE_NOTE",
  ];
  function esc(s) {
    const t = s == null ? "" : String(s);
    if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
    return t;
  }
  const csv = [stampCsvCols.join(",")]
    .concat(enriched.map((r) => stampCsvCols.map((c) => esc(r[c])).join(",")))
    .join("\n");
  fs.writeFileSync(path.join(REPORTS, "package-stamp-candidates.csv"), `\uFEFF${csv}`, "utf8");

  const ruleMap = new Map();
  for (const r of enriched) {
    if (!r.agencyPrefixHit || !r.migrationSku) continue;
    const pref = r.agency;
    if (!ruleMap.has(pref)) {
      ruleMap.set(pref, { agencyNamePrefix: pref, packageCode: r.migrationSku, reservationCount: 0 });
    }
    ruleMap.get(pref).reservationCount += 1;
  }
  fs.writeFileSync(
    path.join(REPORTS, "agency-sku-rule-candidates.json"),
    JSON.stringify([...ruleMap.values()].sort((a, b) => b.reservationCount - a.reservationCount), null, 2),
  );
  return stats;
}

function runEnrich(opts = {}) {
  const rowsPath = opts.rowsPath || path.join(REPORTS, "migration-rows.json");
  let rows = JSON.parse(fs.readFileSync(rowsPath, "utf8"));
  if (!Array.isArray(rows)) rows = [];

  const XLSX = loadXlsx();
  const notesPath = opts.longNotesPath || longNotesPath();
  const longNotes = readSheet(XLSX, notesPath);
  rows = joinLongNotes(rows, longNotes);

  const hemPath = opts.hemkarlarFoPath || hemkarlarFoPath();
  const hemRows = readSheet(XLSX, hemPath);
  const added = appendMissingFoRows(rows, hemRows);
  const destHem = path.join(REPORTS, "hemkarlar-fo-from-jun.xlsx");
  if (hemPath && hemPath !== destHem && fs.existsSync(hemPath) && !fs.existsSync(destHem)) {
    fs.copyFileSync(hemPath, destHem);
  }

  const enriched = rows.map(enrichRow);
  const stats = writeOutputs(enriched, {
    addedFromHemkarlarFo: added.length,
    longNotesPath: notesPath,
    hemkarlarFoPath: hemPath || "",
    longNoteRows: longNotes.length,
  });
  return { enriched, stats, added };
}

function main() {
  const { stats } = runEnrich();
  console.log(JSON.stringify(stats, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  agencySku,
  phraseSku,
  parseEraPkg,
  detectMix,
  phraseBlob,
  enrichRow,
  joinLongNotes,
  appendMissingFoRows,
  foWideToMigrationRow,
  runEnrich,
};
