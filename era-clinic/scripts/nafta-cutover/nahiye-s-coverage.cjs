/**
 * Map WO nahiye → S catalog. Also empty-nahiye × treatment name.
 * Matcher lives in nahiye-s-match.cjs (W4 cutover adapter).
 *
 *   node era-clinic/scripts/nafta-cutover/nahiye-s-coverage.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { norm, fold, buildMatcher, bucketOf } = require("./nahiye-s-match.cjs");
const { loadMergedPhysioZonesCatalog } = require("../../src/domain/physio/physio-catalog-layers.cjs");

const CARDS = "D:/ERA-BACKUP/NAFTA-START/clinic/dump/cards";
const OUT = "D:/ERA-BACKUP/NAFTA-START/clinic/reports";
const CAT_DOC = "physio-zones base + nafta overlay (merged)";
const CSV_IN = path.join(OUT, "nahiye-freq-normalized.csv");
const DOC = path.join(__dirname, "../../doc/physio-zone-s-coverage.md");
const cat = loadMergedPhysioZonesCatalog(path.join(__dirname, "../.."));

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function csvEscape(s) {
  const t = String(s ?? "");
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function writeCsv(file, rows, cols) {
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => csvEscape(r[c])).join(","));
  fs.writeFileSync(file, lines.join("\n"), "utf8");
}

function classifyTreatment(name) {
  const n = norm(name || "")
    .replace(/\u043e/g, "o")
    .replace(/\u0435/g, "e")
    .replace(/\u0430/g, "a");
  if (!n) return { kind: "unknown", defaults: [] };
  if (/inqalyasiya|hidrokolon|uroloji|ozonterapiya|fito terapiya|ginekoloji tampon|proloter/.test(n)) {
    return { kind: "no-surface-site", defaults: [] };
  }
  if (/turunda qulaq|trunda qulaq/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-EAR"] };
  if (/(trunda|turunda)/.test(n) && /burun/.test(n)) {
    return { kind: "site-in-name-missing-nose", defaults: [] };
  }
  if (/turunda|trunda/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-EAR"] };
  if (/4 kamera/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-FOUR-CHAMBER"] };
  if (/parafin.*butun|parafin.*bütün|butun beden|bütün bədən/.test(n)) {
    return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  }
  if (/parafin.*asagi|parafin.*aşağı|asagi etraf/.test(n) && /parafin/.test(n)) {
    return { kind: "site-in-name", defaults: ["ZONE-LOWER-LIMB"] };
  }
  if (/parafin.*yuxari|parafin.*yuxarı|yuxari etraf|yuxarı ətraf/.test(n)) {
    return { kind: "site-in-name", defaults: ["ZONE-UPPER-LIMB"] };
  }
  if (/parafin.*kurek|parafin.*kürək|boyun kurek|boyun kürək/.test(n)) {
    return { kind: "site-in-name", defaults: ["ZONE-COLLAR"] };
  }
  if (/tam beden naftalan|tam bədən naftalan/.test(n)) {
    return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  }
  if (/yod brom|yod-brom/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  if (/hidromasaj/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  if (/isiq vann|işıq vann/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  if (/massaj 30|massaj 15/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  if (/^ufb\b|ufb terapiya/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  if (/bukme|bükmə/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  if (/limfodrenaj/.test(n)) return { kind: "site-in-name", defaults: ["ZONE-LOWER-LIMB"] };
  // Empty fill on ♀/♂ naftalan → FULL (canon 2026-09); oturaq only when text says so.
  if (/naftalan vannasi|naftalan vannası|isiq vann|işıq vann/.test(n)) {
    return { kind: "site-in-name", defaults: ["ZONE-FULL-BODY"] };
  }
  return { kind: "needs-nahiye", defaults: [] };
}

function cardDoctor(json) {
  const n =
    (json && json.listRow && json.listRow.doctorName) ||
    (json && json.slices && json.slices.patient && json.slices.patient.doctorName) ||
    "";
  const t = String(n).trim();
  if (!t || /^yoxdur$/i.test(t)) return "";
  return t;
}

function collectProcedures(json) {
  const slices = json && json.slices && Array.isArray(json.slices.procedures) ? json.slices.procedures : [];
  const seen = new Set();
  const acc = [];
  const doctor = cardDoctor(json);
  for (const node of slices) {
    if (!node || typeof node !== "object") continue;
    if (!Object.prototype.hasOwnProperty.call(node, "nahiye")) continue;
    const id = node.id != null ? String(node.id) : `anon:${acc.length}`;
    if (seen.has(id)) continue;
    seen.add(id);
    acc.push({
      nahiye: node.nahiye,
      patientId: node.patientId ?? json.patientId ?? null,
      treatmentName: node.treatmentName ?? null,
      doctor,
    });
  }
  return acc;
}

function formatDoctors(counter) {
  if (!counter || !counter.size) return { primary: "", all: "" };
  const rows = [...counter.entries()].sort(
    (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "az"),
  );
  return {
    primary: rows[0] ? `${rows[0][0]} (${rows[0][1]})` : "",
    all: rows.map(([name, n]) => `${name} (${n})`).join(" | "),
  };
}

function scanCards() {
  const files = fs.readdirSync(CARDS).filter((f) => f.endsWith(".json"));
  const emptyByT = new Map();
  const filledByT = new Map();
  const ayaqByT = new Map();
  const substByT = new Map();
  const doctorsByNorm = new Map();
  let empty = 0;
  let filled = 0;

  function bump(map, key, extra) {
    let row = map.get(key);
    if (!row) row = { count: 0, patients: new Set() };
    row.count += 1;
    if (extra.patientId != null) row.patients.add(String(extra.patientId));
    map.set(key, row);
  }

  function bumpDoctor(normText, doctor) {
    if (!normText || !doctor) return;
    let row = doctorsByNorm.get(normText);
    if (!row) {
      row = new Map();
      doctorsByNorm.set(normText, row);
    }
    row.set(doctor, (row.get(doctor) || 0) + 1);
  }

  for (const f of files) {
    const json = JSON.parse(fs.readFileSync(path.join(CARDS, f), "utf8"));
    for (const row of collectProcedures(json)) {
      const raw = row.nahiye == null ? "" : String(row.nahiye).trim();
      const t = String(row.treatmentName || "?");
      const cls = classifyTreatment(t);
      if (!raw) {
        empty += 1;
        bump(emptyByT, t, row);
        const er = emptyByT.get(t);
        er.kind = cls.kind;
        er.defaults = cls.defaults;
        continue;
      }
      filled += 1;
      bump(filledByT, t, row);
      const n = norm(raw);
      bumpDoctor(n, row.doctor);
      if (/\b(ayaqlar|ayaqlara|eyaqlar|asagi etraflara|asagi etraflar)\b/.test(n)) {
        bump(ayaqByT, t, row);
      }
      if (/^(bitkilerle|nikatinle)$/.test(n) || n === "bitkilərlə") {
        bump(substByT, t, row);
      }
    }
  }

  function toArr(map) {
    return [...map.entries()]
      .map(([treatment, v]) => ({
        treatment,
        count: v.count,
        patients: v.patients.size,
        kind: v.kind || "",
        defaults: (v.defaults || []).join("|"),
      }))
      .sort((a, b) => b.count - a.count);
  }

  return {
    empty,
    filled,
    emptyByT: toArr(emptyByT),
    ayaqByT: toArr(ayaqByT),
    substByT: toArr(substByT),
    doctorsByNorm,
  };
}

function main() {
  const { match } = buildMatcher(cat);

  const csvRows = parseCsv(fs.readFileSync(CSV_IN, "utf8"));
  const header = csvRows.shift();
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const buckets = { mapped: [], "flags-only": [], partial: [], unknown: [], "empty-text": [] };
  const sums = {
    mapped: { rows: 0, patients: 0, n: 0 },
    "flags-only": { rows: 0, patients: 0, n: 0 },
    partial: { rows: 0, patients: 0, n: 0 },
    unknown: { rows: 0, patients: 0, n: 0 },
  };

  for (const r of csvRows) {
    const text = r[idx.text] || "";
    const count = Number(r[idx.count] || 0);
    const patients = Number(r[idx.patients] || 0);
    const treatments = r[idx.sampleTreatments] || "";
    const m = match(text, { procedureName: treatments });
    const b = bucketOf(m);
    const rec = {
      count,
      patients,
      text,
      chips: m.chips.join("|"),
      flags: m.flags.join("|"),
      residue: m.residue,
      via: m.via,
      treatments,
      bucket: b,
      doctor: "",
      doctors: "",
    };
    buckets[b].push(rec);
    if (sums[b]) {
      sums[b].rows += count;
      sums[b].patients += patients;
      sums[b].n += 1;
    }
  }

  const filledRows = Object.values(sums).reduce((s, x) => s + x.rows, 0);

  console.log("Scanning cards for empty nahiye × treatment and doctors…");
  const scan = scanCards();
  for (const rec of [...buckets.unknown, ...buckets.partial, ...buckets.mapped, ...buckets["flags-only"]]) {
    const d = formatDoctors(
      scan.doctorsByNorm.get(rec.text) ||
        scan.doctorsByNorm.get(norm(rec.text)) ||
        scan.doctorsByNorm.get(fold(rec.text)),
    );
    rec.doctor = d.primary;
    rec.doctors = d.all;
  }

  const emptyKind = {};
  for (const r of scan.emptyByT) {
    emptyKind[r.kind] = emptyKind[r.kind] || { rows: 0, n: 0 };
    emptyKind[r.kind].rows += r.count;
    emptyKind[r.kind].n += 1;
  }

  writeCsv(path.join(OUT, "nahiye-s-unknown.csv"), buckets.unknown, [
    "count",
    "patients",
    "text",
    "residue",
    "flags",
    "treatments",
    "doctor",
    "doctors",
  ]);
  writeCsv(path.join(OUT, "nahiye-s-partial.csv"), buckets.partial, [
    "count",
    "patients",
    "text",
    "chips",
    "residue",
    "flags",
    "treatments",
    "doctor",
    "doctors",
  ]);
  writeCsv(path.join(OUT, "nahiye-empty-by-treatment.csv"), scan.emptyByT, [
    "count",
    "patients",
    "kind",
    "defaults",
    "treatment",
  ]);
  writeCsv(path.join(OUT, "nahiye-ayaqlar-by-treatment.csv"), scan.ayaqByT, [
    "count",
    "patients",
    "treatment",
  ]);
  writeCsv(path.join(OUT, "nahiye-substance-only-by-treatment.csv"), scan.substByT, [
    "count",
    "patients",
    "treatment",
  ]);

  const pct = (n) => (filledRows ? Math.round((1000 * n) / filledRows) / 10 : 0);

  const md = [];
  md.push("# WO nahiye → S coverage");
  md.push("");
  md.push("**Canon:** [physio-site-canon.md](./physio-site-canon.md) §6 unmatched.");
  md.push(`Matcher adapter: \`scripts/nafta-cutover/nahiye-s-match.cjs\` (driven by ${CAT_DOC}). Report: \`nahiye-s-coverage.cjs\`.`);
  md.push("");
  md.push("Unmatched is **in scope**. Excel (A→Z): `D:/ERA-BACKUP/NAFTA-START/clinic/reports/nahiye-s-unknown.xlsx`, `nahiye-s-partial.xlsx`, `nahiye-s-empty.xlsx` (Needs site vs N/A). Re-export: `scripts/nafta-cutover/export-nahiye-s-xlsx.cjs`.");
  md.push("");
  md.push("Closed: quadriseps → thigh (HIP-GLUTEAL), not a new S; laser `* pr`/`* rej` = DEVICE_PROGRAM not PRP; turunda/tampon = procedure; furun = nose; raloji rej on electrophoresis = nevraloji not radiology; neloma/meloma = beloma (keyboard), not melanoma; çoban yastığı = chamomile; qoltuqaltı → upper limb; dumbek/sakrum = sacrum → LUMBOSACRAL; sagri = haunch HIP not bandage; sargi/sagir/venalara unmatched; qıllar = qollar (keyboard i/o) → UPPER-LIMB; göbək → ABDOMEN; çapıq rej = scar program; fonofarez = Ultrafonoforez bleed. leftover butun: bütün if another site or Massaj/UFB SKU; burun (FACE) on Trunda/İnqalyasiya. oma → LUMBOSACRAL; topuqlarina / malleol = ankle. dizdən aşağı → FOOT-LEG; dizaltı → KNEE; baldır ≠ bud. erector spina → SPINE-FULL; supraspinatus → SHOULDER; thorakal → CHEST; ekstremite = limbs. kürəkalti → BACK; leftover ayaq → LOWER-LIMB; doş → CHEST; bazu → UPPER-LIMB; qollardan aşağı → HAND-FOREARM on upper paraffin; 4 lü / 4 lü rejim = 4 pads not work-kind IV.");
  md.push("");
  md.push("## Answers (empty / substance / ayaqlar / face / növbəli)");
  md.push("");
  md.push("- **Empty + procedure name (reception 2026-08-25):** yod-brom / hidromasaj / Massaj 30 / UFB / Bükmə → `ZONE-FULL-BODY`. Limfodrenaj empty → legs; `qarın` adds abdomen. `4 kamera*` → four-chamber. Massaj 15 still needs a region. Naftalan fill stays doctor (tam|oturaq|qurşaq). Ozone / inhalation / colon empty is honest (no surface site).");
  md.push("- **Substance-only (`bitkilərlə` / `nikatinle`):** almost all sit on İnqalyasiya and 4-kamera — site is the procedure, nahiye is the additive. Not a missing zone.");
  md.push("- **`ayaqlar`:** on Parafin Aşağı / limfodrenaj / maqnit this is `ZONE-LOWER-LIMB`, not heels. Heels are `daban`; ankle is `topuq` (`ZONE-FOOT-LEG` / `ZONE-ANKLE`).");
  md.push("- **Face and heels:** codes exist (`ZONE-FACE`, `ZONE-FOOT-LEG` daban, `ZONE-ANKLE` topuq). Long-tail was missing **aliases**, not codes.");
  md.push("- **boyun:** reception = collar (trapezius / scalenus) → `ZONE-COLLAR`. `ZONE-NECK` remains 817 §3 without a WO alias.");
  md.push("- **növbəli:** one `ProcedureOrder`, `sites[]` in order, `siteApplyMode=TURN` (same slot). `sequenceIndex` stays program FIFO. `1 ci oturaq son tam` is `BATH_SEQUENCE` (different days). `eyni vaxtda` = TOGETHER.");
  md.push("");
  const uniqueAll = Object.values(sums).reduce((s, x) => s + x.n, 0);
  md.push(`Dump cards: filled nahiye ${scan.filled}; blank cell ${scan.empty} (N/A vs needs-site split below). Freq CSV: **${filledRows}** rows / **${uniqueAll}** unique.`);
  md.push("");
  md.push(`## Filled strings (${filledRows} rows / ${uniqueAll} unique)`);
  md.push("");
  md.push("| Bucket | Unique | Rows | % rows | Σ patients (over-count) |");
  md.push("|--------|-------:|-----:|-------:|------------------------:|");
  for (const k of ["mapped", "flags-only", "partial", "unknown"]) {
    const s = sums[k];
    md.push(`| ${k} | ${s.n} | ${s.rows} | ${pct(s.rows)}% | ${s.patients} |`);
  }
  md.push("");
  md.push("Patient column is **sum of per-string unique patients** (a patient in two strings is counted twice). Use for ranking, not headcount.");
  md.push("");
  md.push("### Top unknown");
  md.push("");
  md.push("| rows | patients | text | residue | doctor |");
  md.push("|-----:|---------:|------|---------|--------|");
  for (const r of buckets.unknown.slice(0, 25)) {
    md.push(`| ${r.count} | ${r.patients} | ${r.text} | ${r.residue} | ${r.doctor} |`);
  }
  md.push("");
  md.push("### Top partial");
  md.push("");
  md.push("| rows | patients | text | chips | residue | doctor |");
  md.push("|-----:|---------:|------|-------|---------|--------|");
  for (const r of buckets.partial.slice(0, 20)) {
    md.push(`| ${r.count} | ${r.patients} | ${r.text} | ${r.chips} | ${r.residue} | ${r.doctor} |`);
  }
  md.push("");
  function emptyRole(kind) {
    if (kind === "needs-nahiye" || kind === "fill-ambiguous") return "needs-site";
    return "na";
  }

  const emptyNa = scan.emptyByT.filter((r) => emptyRole(r.kind) === "na");
  const emptyNeed = scan.emptyByT.filter((r) => emptyRole(r.kind) === "needs-site");
  const sum = (rows) => rows.reduce((s, r) => s + r.count, 0);

  md.push("## Blank WO nahiye field");
  md.push("");
  md.push(
    `WO always has the cell. **${scan.empty}** blanks, of which **${sum(emptyNa)}** do not need a body site (N/A) and **${sum(emptyNeed)}** still do.`,
  );
  md.push("");
  md.push("N/A is **not** unmatched S. Ozone / inhalation / colon / IV have no surface site. Massaj 30 / UFB / 4-kamera / yod-brom already name the site in the SKU — import defaults from the procedure, doctors do not fill nahiye.");
  md.push("");
  md.push("| role | rows | treatments | kinds |");
  md.push("|------|-----:|-----------:|-------|");
  md.push(
    `| N/A (field not used) | ${sum(emptyNa)} | ${emptyNa.length} | no-surface-site, site-in-name, site-in-name-missing-nose |`,
  );
  md.push(
    `| still needs a site | ${sum(emptyNeed)} | ${emptyNeed.length} | needs-nahiye, fill-ambiguous (naftalan tam/oturaq) |`,
  );
  md.push("");
  md.push("### N/A — not a catalog gap");
  md.push("");
  md.push("| rows | patients | kind | default S | treatment |");
  md.push("|-----:|---------:|------|-----------|-----------|");
  for (const r of emptyNa.slice(0, 20)) {
    md.push(`| ${r.count} | ${r.patients} | ${r.kind} | ${r.defaults || "—"} | ${r.treatment} |`);
  }
  md.push("");
  md.push("### Still needs a site");
  md.push("");
  md.push("| rows | patients | kind | default S | treatment |");
  md.push("|-----:|---------:|------|-----------|-----------|");
  for (const r of emptyNeed.slice(0, 25)) {
    md.push(`| ${r.count} | ${r.patients} | ${r.kind} | ${r.defaults || "—"} | ${r.treatment} |`);
  }
  md.push("");
  md.push("## Substance-only nahiye (`bitkilərlə` / `nikatinle`)");
  md.push("");
  md.push("| rows | patients | treatment |");
  md.push("|-----:|---------:|-----------|");
  for (const r of scan.substByT) {
    md.push(`| ${r.count} | ${r.patients} | ${r.treatment} |`);
  }
  md.push("");
  md.push("## `ayaqlar` / `asagi etraflara` × treatment (coarse vs foot)");
  md.push("");
  md.push("| rows | patients | treatment |");
  md.push("|-----:|---------:|-----------|");
  for (const r of scan.ayaqByT.slice(0, 20)) {
    md.push(`| ${r.count} | ${r.patients} | ${r.treatment} |`);
  }
  md.push("");
  md.push("Paraffin **Aşağı** + `ayaqlar` → keep `ZONE-LOWER-LIMB` (name already says lower limb). Darsonval/Solux + `ayaqlar` → same, not heels (`daban` / `topuq` are separate S).");
  md.push("");

  fs.writeFileSync(path.join(OUT, "nahiye-s-coverage.md"), md.join("\n"), "utf8");
  fs.writeFileSync(DOC, md.join("\n"), "utf8");
  console.log(
    JSON.stringify(
      {
        filledCsvRows: filledRows,
        sums,
        empty: scan.empty,
        emptyKind,
        unknownTop: buckets.unknown.slice(0, 8).map((r) => r.text),
        doc: DOC,
      },
      null,
      2,
    ),
  );
}

main();
