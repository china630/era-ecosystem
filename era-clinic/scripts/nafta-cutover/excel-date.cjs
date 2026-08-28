"use strict";

/**
 * Excel / AZ workbook dates → UTC calendar day.
 * Keep in sync with era-orchestrator/.../workforce-xlsx.ts `normalizeDateOnly`.
 *
 * Truth order: Date object → ISO YYYY-MM-DD → dotted DMY (07.06.2024) →
 * slash (unambiguous D/M or M/D; ambiguous → M/D Excel display) → Excel serial.
 * Empty only: blank, NAN, 0.
 */

function emptyDate(raw) {
  if (raw == null || raw === "") return true;
  const s = String(raw).trim();
  return !s || /^nan$/i.test(s) || s === "0";
}

function utcYmd(year, month0, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month0) || !Number.isInteger(day)) return null;
  if (month0 < 0 || month0 > 11 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month0, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month0 || dt.getUTCDate() !== day) {
    return null;
  }
  return dt;
}

function twoDigitYear(y) {
  if (y >= 100) return y;
  return y >= 50 ? 1900 + y : 2000 + y;
}

function fromExcelSerial(raw) {
  if (emptyDate(raw)) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    if (raw.getUTCHours() === 0 && raw.getUTCMinutes() === 0 && raw.getUTCSeconds() === 0) {
      return utcYmd(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate());
    }
    return utcYmd(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return utcYmd(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  }
  const dmyDot = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (dmyDot) {
    return utcYmd(twoDigitYear(Number(dmyDot[3])), Number(dmyDot[2]) - 1, Number(dmyDot[1]));
  }
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = twoDigitYear(Number(slash[3]));
    if (a > 12 && b <= 12) return utcYmd(y, b - 1, a);
    if (b > 12 && a <= 12) return utcYmd(y, a - 1, b);
    return utcYmd(y, a - 1, b);
  }
  const n = Number(String(s).replace(",", "."));
  if (!Number.isFinite(n) || n === 0) return null;
  // Staff DOB can be 1950s (serial ~18000). Reject tiny/huge leftovers, not 0 (already empty).
  if (n < 1000 || n > 80000) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
}

function excelDateYmd(raw) {
  const d = fromExcelSerial(raw);
  return d ? d.toISOString().slice(0, 10) : "";
}

function stampDateCells(XLSX, ws, headers, dateCols) {
  const dateIdx = dateCols.map((c) => headers.indexOf(c)).filter((i) => i >= 0);
  if (!ws["!ref"] || !dateIdx.length) return;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let R = range.s.r + 1; R <= range.e.r; R += 1) {
    for (const C of dateIdx) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell || cell.v == null || cell.v === "") continue;
      const d = fromExcelSerial(cell.v);
      if (!d) continue;
      cell.t = "d";
      cell.v = d;
      cell.z = "YYYY-MM-DD";
    }
  }
}

module.exports = { emptyDate, fromExcelSerial, excelDateYmd, stampDateCells };
