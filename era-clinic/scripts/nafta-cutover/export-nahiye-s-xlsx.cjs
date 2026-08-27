/**
 * Export unmatched nahiye queues to Excel, A→Z by text.
 *
 *   node era-clinic/scripts/nafta-cutover/export-nahiye-s-xlsx.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const OUT = "D:/ERA-BACKUP/NAFTA-START/clinic/reports";

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

function fold(s) {
  return String(s)
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/[ıIİi]/g, (ch) => {
      if (ch === "I" || ch === "İ") return "i";
      if (ch === "ı") return "i";
      return ch;
    })
    .toLocaleLowerCase("az")
    .replace(/ə/g, "e")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ş/g, "s")
    .replace(/-/g, " ")
    .replace(/[.,;:()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Closed reception notes (2026-08-25). */
function closedNote(text) {
  const f = fold(text);
  const packed = f.replace(/\s+/g, "");
  const notes = [];
  if (packed === "4kamerali" || packed === "4kameri" || packed === "4kameralivanna") {
    notes.push("закрыто: 4 kameralı naftalan → ZONE-FOUR-CHAMBER (другая процедура, не наполнение tam/oturaq)");
  }
  if (f === "tan beden" || f.startsWith("tan beden ")) {
    notes.push("закрыто: tan beden = tam → ZONE-FULL-BODY");
  }
  if (/\bayaq/.test(f) && /\bqarina\b/.test(f)) {
    notes.push("закрыто: ayaqlara qarina = ноги + живот (ZONE-LOWER-LIMB + ZONE-ABDOMEN)");
  }
  if (/\bboyrekustu\b/.test(f) || /\bboyrek ustu\b/.test(f)) {
    notes.push("закрыто: böyrəküstü = поясница / над почками → ZONE-LUMBOSACRAL");
  }
  if (/\bbizler\b/.test(f)) {
    notes.push("закрыто: bizler = diz → ZONE-KNEE");
  }
  if (f === "sade" || f.startsWith("sade ")) {
    notes.push("закрыто: sadə на ингаляции = без добавки, не зона");
  }
  if (/\brus akimi\b/.test(f)) {
    notes.push("закрыто: rus akimi = Kotz; seo/deo = DEVICE_PARAMS, не SMT I–V");
  }
  if (/\b0 24 basla/.test(f) || /\b0 24 baslamaq/.test(f)) {
    notes.push("закрыто: UFB 0 24 başla = старт сессии (DEVICE_PARAMS), не зона");
  }
  if (/\bdizden asagi\b/.test(f) || /\bdizlerden asagi\b/.test(f) || /\basagi eyaqlar\b/.test(f)) {
    notes.push("закрыто: ниже колена → ZONE-FOOT-LEG (не вся нижняя конечность)");
  }
  if (/\bbaldir\b/.test(f) && !/\bbud\b/.test(f)) {
    notes.push("закрыто: baldır = голень (ZONE-FOOT-LEG), не ляжка");
  }
  if (/\bbud\b/.test(f) && !/\bbaldir\b/.test(f)) {
    notes.push("закрыто: bud = бедро → ZONE-HIP-GLUTEAL, не baldır");
  }
  if (/\bartroz pr\b/.test(f) || /\bartrit rej\b/.test(f) || /\bartroz b rej\b/.test(f)) {
    notes.push("закрыто: artroz/artrit pr = программа стимуляции/лазера, не PRP");
  }
  if (/\bquadriseps\b/.test(f)) {
    notes.push("закрыто: quadriseps = бедро → ZONE-HIP-GLUTEAL, не новая S; biceps рядом = femoris, не рука");
  }
  if (/\bdumbek\b/.test(f)) {
    notes.push("закрыто: dumbek = крестец → ZONE-LUMBOSACRAL (не копчик)");
  }
  if (/\bcoban yastigi\b/.test(f)) {
    notes.push("закрыто: çoban yastığı = ромашка, добавка, не зона");
  }
  if (/\bqoltuqalti\b/.test(f)) {
    notes.push("закрыто: подмышки → ZONE-UPPER-LIMB (отдельной S нет)");
  }
  if (/\bturu/.test(f)) {
    notes.push("закрыто: turunda = процедура-тампон, не зона");
  }
  if (/\bdiz oynagi\b/.test(f) || /\bdiz etrafi\b/.test(f)) {
    notes.push("закрыто: diz oynagi / dizətrafi = коленный сустав → ZONE-KNEE");
  }
  if (/\bdizeqeder\b/.test(f)) {
    notes.push("закрыто: dizəqədər = до колена → ZONE-FOOT-LEG");
  }
  if (/\bkurekalti\b/.test(f)) {
    notes.push("закрыто: kürəkalti = под лопатками → ZONE-BACK");
  }
  if (/\bsargi\b/.test(f)) {
    notes.push("очередь: sargi = область перевязки, не S");
  }
  if (/\bvenalara\b/.test(f) || f === "venalara") {
    notes.push("очередь: venalara = вены, не S");
  }
  if (/\bisti olmasin\b/.test(f)) {
    notes.push("закрыто: isti olmasin = не горячо (INTENSITY), не зона");
  }
  if (/\bomaya olmaz\b/.test(f) || /\bombaya olmaz\b/.test(f)) {
    notes.push("закрыто: ombaya olmaz = HOLD поясницы; dos/döş = грудь (Parafin Yuxarı)");
  }
  return notes.join("; ");
}

function loadCsv(file) {
  const raw = fs.readFileSync(file, "utf8");
  const rows = parseCsv(raw);
  const header = rows.shift();
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  return rows.map((r) => {
    const rec = {};
    for (const h of header) rec[h] = r[idx[h]] ?? "";
    rec.note = closedNote(rec.text);
    return rec;
  });
}

function sortAz(rows) {
  return rows.slice().sort((a, b) =>
    String(a.text).localeCompare(String(b.text), "az", { sensitivity: "base", numeric: true }),
  );
}

function sheet(rows, cols) {
  const header = cols.map((c) => c.header);
  const body = rows.map((r) => cols.map((c) => r[c.key] ?? ""));
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  ws["!cols"] = cols.map((c) => ({ wch: c.wch }));
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: cols.length - 1 } }) };
  return ws;
}

function writeBook(file, sheets) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, s.ws, s.name);
  try {
    XLSX.writeFile(wb, file);
    console.log("wrote", file);
  } catch (e) {
    if (e && e.code === "EBUSY") {
      const alt = file.replace(/\.xlsx$/i, "-new.xlsx");
      XLSX.writeFile(wb, alt);
      console.log("wrote", alt, "(canonical file locked)");
      return;
    }
    throw e;
  }
}

function main() {
  const unknown = sortAz(loadCsv(path.join(OUT, "nahiye-s-unknown.csv")));
  const partial = sortAz(loadCsv(path.join(OUT, "nahiye-s-partial.csv")));

  const unknownCols = [
    { key: "text", header: "текст nahiye", wch: 70 },
    { key: "count", header: "строк", wch: 10 },
    { key: "patients", header: "пациентов", wch: 12 },
    { key: "doctor", header: "врач (чаще всего)", wch: 28 },
    { key: "doctors", header: "врачи (все, с числом строк)", wch: 55 },
    { key: "residue", header: "residue", wch: 50 },
    { key: "flags", header: "флаги заказа", wch: 28 },
    { key: "treatments", header: "процедуры", wch: 50 },
    { key: "note", header: "заметка", wch: 70 },
  ];
  const partialCols = [
    { key: "text", header: "текст nahiye", wch: 70 },
    { key: "count", header: "строк", wch: 10 },
    { key: "patients", header: "пациентов", wch: 12 },
    { key: "doctor", header: "врач (чаще всего)", wch: 28 },
    { key: "doctors", header: "врачи (все, с числом строк)", wch: 55 },
    { key: "chips", header: "S (уже есть)", wch: 45 },
    { key: "residue", header: "хвост = очередь", wch: 45 },
    { key: "flags", header: "флаги заказа", wch: 28 },
    { key: "treatments", header: "процедуры", wch: 50 },
    { key: "note", header: "заметка", wch: 70 },
  ];

  writeBook(path.join(OUT, "nahiye-s-unknown.xlsx"), [
    { name: "Unknown A-Z", ws: sheet(unknown, unknownCols) },
  ]);
  writeBook(path.join(OUT, "nahiye-s-partial.xlsx"), [
    { name: "Partial A-Z", ws: sheet(partial, partialCols) },
  ]);

  const emptyRows = loadCsv(path.join(OUT, "nahiye-empty-by-treatment.csv"));
  const emptyNeed = emptyRows.filter((r) => r.kind === "needs-nahiye" || r.kind === "fill-ambiguous");
  const emptyNa = emptyRows.filter((r) => r.kind !== "needs-nahiye" && r.kind !== "fill-ambiguous");
  const emptyCols = [
    { key: "treatment", header: "процедура", wch: 55 },
    { key: "count", header: "пустых строк", wch: 14 },
    { key: "patients", header: "пациентов", wch: 12 },
    { key: "kind", header: "kind", wch: 28 },
    { key: "defaults", header: "default S", wch: 28 },
  ];
  writeBook(path.join(OUT, "nahiye-s-empty.xlsx"), [
    { name: "Needs site", ws: sheet(emptyNeed, emptyCols) },
    { name: "N-A not a gap", ws: sheet(emptyNa, emptyCols) },
  ]);

  console.log("unknown unique", unknown.length, "with closed notes", unknown.filter((r) => r.note).length);
  console.log("partial unique", partial.length, "with closed notes", partial.filter((r) => r.note).length);
  console.log("empty needs-site treatments", emptyNeed.length, "N/A treatments", emptyNa.length);
}

main();
