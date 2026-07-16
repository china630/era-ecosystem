/** РљР»СЋС‡ РїРµСЂРёРѕРґР° YYYY-MM РїРѕ UTC-РєР°Р»РµРЅРґР°СЂСЋ РґР°С‚С‹ РїСЂРѕРІРѕРґРєРё. */
export function monthKeyUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function parseIsoDateOnly(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) {
    throw new Error(`Invalid date (expected YYYY-MM-DD): ${s}`);
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
}

/** РљРѕРЅРµС† РєР°Р»РµРЅРґР°СЂРЅРѕРіРѕ РґРЅСЏ UTC РґР»СЏ СЃСЂР°РІРЅРµРЅРёСЏ СЃ DateTime. */
export function endOfUtcDay(dateFromParse: Date): Date {
  return new Date(
    Date.UTC(
      dateFromParse.getUTCFullYear(),
      dateFromParse.getUTCMonth(),
      dateFromParse.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

/** РџРµСЂРІС‹Р№ Рё РїРѕСЃР»РµРґРЅРёР№ РєР°Р»РµРЅРґР°СЂРЅС‹Р№ РґРµРЅСЊ РјРµСЃСЏС†Р° (UTC 00:00, РґР»СЏ СЃСЂР°РІРЅРµРЅРёСЏ СЃ @db.Date). */
export function monthRangeUtc(year: number, month1to12: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0, 0));
  const lastDay = new Date(Date.UTC(year, month1to12, 0, 0, 0, 0, 0)).getUTCDate();
  const end = new Date(Date.UTC(year, month1to12 - 1, lastDay, 0, 0, 0, 0));
  return { start, end };
}

/** РџРµСЂРІС‹Р№ Рё РїРѕСЃР»РµРґРЅРёР№ РєР°Р»РµРЅРґР°СЂРЅС‹Р№ РґРµРЅСЊ РіРѕРґР° (UTC). */
export function yearRangeUtc(year: number): { start: Date; end: Date; fromStr: string; toStr: string } {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, 11, 31, 0, 0, 0, 0));
  return {
    start,
    end,
    fromStr: dateToIsoYmdUtc(start),
    toStr: dateToIsoYmdUtc(end),
  };
}

/** All 12 month keys YYYY-MM for a calendar year. */
export function yearMonthKeys(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

/** True when all 12 months of the year are in closedPeriods. */
export function areAllMonthsClosed(settingsJson: unknown, year: number): boolean {
  const closed = new Set(getClosedPeriodKeys(settingsJson));
  return yearMonthKeys(year).every((k) => closed.has(k));
}

export function getClosedYearKeys(settingsJson: unknown): number[] {
  if (!settingsJson || typeof settingsJson !== "object") return [];
  const r = (settingsJson as Record<string, unknown>).reporting;
  if (!r || typeof r !== "object") return [];
  const cy = (r as Record<string, unknown>).closedYears;
  if (!Array.isArray(cy)) return [];
  return cy
    .map((x) => (typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN))
    .filter((n) => Number.isFinite(n));
}

export function mergeClosedYear(
  settingsJson: unknown,
  year: number,
): Record<string, unknown> {
  const base =
    settingsJson && typeof settingsJson === "object"
      ? { ...(settingsJson as Record<string, unknown>) }
      : {};
  const rep =
    base.reporting && typeof base.reporting === "object"
      ? { ...(base.reporting as Record<string, unknown>) }
      : {};
  const prev = Array.isArray(rep.closedYears)
    ? [...(rep.closedYears as unknown[])]
    : [];
  if (!prev.includes(year) && !prev.includes(String(year))) {
    prev.push(year);
  }
  rep.closedYears = prev
    .map((x) => (typeof x === "number" ? x : Number(x)))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  base.reporting = rep;
  return base;
}

/** Inverse of mergeClosedYear вЂ” remove a year from settings.reporting.closedYears. */
export function unmergeClosedYear(
  settingsJson: unknown,
  year: number,
): Record<string, unknown> {
  const base =
    settingsJson && typeof settingsJson === "object"
      ? { ...(settingsJson as Record<string, unknown>) }
      : {};
  const rep =
    base.reporting && typeof base.reporting === "object"
      ? { ...(base.reporting as Record<string, unknown>) }
      : {};
  const prev = Array.isArray(rep.closedYears)
    ? [...(rep.closedYears as unknown[])]
    : [];
  rep.closedYears = prev
    .map((x) => (typeof x === "number" ? x : Number(x)))
    .filter((n) => Number.isFinite(n) && n !== year)
    .sort((a, b) => a - b);
  base.reporting = rep;
  return base;
}

export function getClosedPeriodKeys(settingsJson: unknown): string[] {
  if (!settingsJson || typeof settingsJson !== "object") return [];
  const r = (settingsJson as Record<string, unknown>).reporting;
  if (!r || typeof r !== "object") return [];
  const cp = (r as Record<string, unknown>).closedPeriods;
  if (!Array.isArray(cp)) return [];
  return cp.filter((x): x is string => typeof x === "string");
}

export function getLockedPeriodUntil(settingsJson: unknown): Date | null {
  if (!settingsJson || typeof settingsJson !== "object") return null;
  const ledger = (settingsJson as Record<string, unknown>).ledger;
  if (!ledger || typeof ledger !== "object") return null;
  const value = (ledger as Record<string, unknown>).lockedPeriodUntil;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return parseIsoDateOnly(value);
  } catch {
    return null;
  }
}

/** YYYY-MM-DD РїРѕ UTC-РєР°Р»РµРЅРґР°СЂСЋ (РґР»СЏ API РѕС‚С‡С‘С‚РѕРІ). */
export function dateToIsoYmdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * РќР°СЂРµР·РєР° РїРµСЂРёРѕРґР° [dateFrom, dateTo] РїРѕ РєР°Р»РµРЅРґР°СЂРЅС‹Рј РјРµСЃСЏС†Р°Рј (UTC).
 * Р”Р»СЏ РєР°Р¶РґРѕРіРѕ РєСѓСЃРєР° вЂ” РіСЂР°РЅРёС†С‹ РІРєР»СЋС‡РёС‚РµР»СЊРЅРѕ Рё РґР°С‚Р° РєСѓСЂСЃР° (РєРѕРЅРµС† РєСѓСЃРєР°).
 */
export function accrualMonthSlices(
  dateFrom: Date,
  dateTo: Date,
): Array<{ fromStr: string; toStr: string; fxAsOf: Date }> {
  if (dateFrom.getTime() > dateTo.getTime()) {
    return [];
  }
  const out: Array<{ fromStr: string; toStr: string; fxAsOf: Date }> = [];
  let y = dateFrom.getUTCFullYear();
  let m = dateFrom.getUTCMonth();
  let cursor = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  while (cursor.getTime() <= dateTo.getTime()) {
    const y0 = cursor.getUTCFullYear();
    const m0 = cursor.getUTCMonth();
    const lastDay = new Date(Date.UTC(y0, m0 + 1, 0, 0, 0, 0, 0)).getUTCDate();
    const monthStart = new Date(Date.UTC(y0, m0, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(y0, m0, lastDay, 0, 0, 0, 0));
    const sliceFrom =
      dateFrom.getTime() > monthStart.getTime() ? dateFrom : monthStart;
    const sliceTo = dateTo.getTime() < monthEnd.getTime() ? dateTo : monthEnd;
    if (sliceFrom.getTime() <= sliceTo.getTime()) {
      out.push({
        fromStr: dateToIsoYmdUtc(sliceFrom),
        toStr: dateToIsoYmdUtc(sliceTo),
        fxAsOf: sliceTo,
      });
    }
    cursor = new Date(Date.UTC(y0, m0 + 1, 1, 0, 0, 0, 0));
  }
  return out;
}

export function mergeClosedPeriod(
  settingsJson: unknown,
  key: string,
): Record<string, unknown> {
  const base =
    settingsJson && typeof settingsJson === "object"
      ? { ...(settingsJson as Record<string, unknown>) }
      : {};
  const rep =
    base.reporting && typeof base.reporting === "object"
      ? { ...(base.reporting as Record<string, unknown>) }
      : {};
  const prev = Array.isArray(rep.closedPeriods)
    ? [...(rep.closedPeriods as string[])]
    : [];
  if (!prev.includes(key)) prev.push(key);
  rep.closedPeriods = prev.sort();
  base.reporting = rep;
  return base;
}

export function mergeLockedPeriodUntil(
  settingsJson: unknown,
  lockedPeriodUntil: string | null,
): Record<string, unknown> {
  const base =
    settingsJson && typeof settingsJson === "object"
      ? { ...(settingsJson as Record<string, unknown>) }
      : {};
  const ledger =
    base.ledger && typeof base.ledger === "object"
      ? { ...(base.ledger as Record<string, unknown>) }
      : {};
  if (lockedPeriodUntil) {
    ledger.lockedPeriodUntil = lockedPeriodUntil;
  } else {
    delete ledger.lockedPeriodUntil;
  }
  base.ledger = ledger;
  return base;
}
