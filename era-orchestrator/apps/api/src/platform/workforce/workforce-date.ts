/**
 * Excel / AZ workbook dates → YYYY-MM-DD.
 * Keep in sync with era-clinic/scripts/nafta-cutover/excel-date.cjs.
 */
export function normalizeDateOnly(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const dt =
      raw.getUTCHours() === 0 && raw.getUTCMinutes() === 0 && raw.getUTCSeconds() === 0
        ? utcYmd(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate())
        : utcYmd(raw.getFullYear(), raw.getMonth(), raw.getDate());
    return dt ? dt.toISOString().slice(0, 10) : "";
  }
  const s = String(raw).trim();
  if (!s || /^nan$/i.test(s) || s === "0") return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const dt = utcYmd(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
    return dt ? dt.toISOString().slice(0, 10) : "";
  }
  const dmyDot = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (dmyDot) {
    const dt = utcYmd(
      twoDigitYear(Number(dmyDot[3])),
      Number(dmyDot[2]) - 1,
      Number(dmyDot[1]),
    );
    return dt ? dt.toISOString().slice(0, 10) : "";
  }
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = twoDigitYear(Number(slash[3]));
    const dt =
      a > 12 && b <= 12
        ? utcYmd(y, b - 1, a)
        : utcYmd(y, a - 1, b);
    return dt ? dt.toISOString().slice(0, 10) : "";
  }
  const n = Number(String(s).replace(",", "."));
  if (!Number.isFinite(n) || n === 0 || n < 1000 || n > 80000) return "";
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000)
    .toISOString()
    .slice(0, 10);
}

function utcYmd(year: number, month0: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month0) || !Number.isInteger(day)) {
    return null;
  }
  if (month0 < 0 || month0 > 11 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month0, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month0 || dt.getUTCDate() !== day) {
    return null;
  }
  return dt;
}

function twoDigitYear(y: number): number {
  if (y >= 100) return y;
  return y >= 50 ? 1900 + y : 2000 + y;
}
