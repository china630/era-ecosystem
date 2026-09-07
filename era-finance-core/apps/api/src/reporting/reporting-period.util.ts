/** Ключ периода YYYY-MM по UTC-календарю даты проводки. */
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

/** Конец календарного дня UTC для сравнения с DateTime. */
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

/** Первый и последний календарный день месяца (UTC 00:00, для сравнения с @db.Date). */
export function monthRangeUtc(year: number, month1to12: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0, 0));
  const lastDay = new Date(Date.UTC(year, month1to12, 0, 0, 0, 0, 0)).getUTCDate();
  const end = new Date(Date.UTC(year, month1to12 - 1, lastDay, 0, 0, 0, 0));
  return { start, end };
}

/** Первый и последний календарный день года (UTC). */
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

export type ClosedPeriodLedgerKey = "NAS" | "IFRS" | "MANAGEMENT" | string;

/** True when all 12 months of the year are closed for the ledger/book scope. */
export function areAllMonthsClosed(
  settingsJson: unknown,
  year: number,
  ledgerType: ClosedPeriodLedgerKey = "NAS",
  bookId?: string | null,
): boolean {
  const closed = new Set(getClosedPeriodKeys(settingsJson, ledgerType, bookId));
  return yearMonthKeys(year).every((k) => closed.has(k));
}

/**
 * Closed fiscal years for a book (prefer closedYearsByBookId), with legacy
 * flat closedYears as NAS / unspecified-book fallback.
 */
export function getClosedYearKeys(
  settingsJson: unknown,
  bookId?: string | null,
): number[] {
  if (!settingsJson || typeof settingsJson !== "object") return [];
  const r = (settingsJson as Record<string, unknown>).reporting;
  if (!r || typeof r !== "object") return [];
  const rep = r as Record<string, unknown>;
  const byBook = rep.closedYearsByBookId;
  if (bookId && byBook && typeof byBook === "object") {
    const arr = (byBook as Record<string, unknown>)[bookId];
    if (Array.isArray(arr)) {
      return arr
        .map((x) => (typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN))
        .filter((n) => Number.isFinite(n));
    }
  }
  const cy = rep.closedYears;
  if (!Array.isArray(cy)) return [];
  return cy
    .map((x) => (typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN))
    .filter((n) => Number.isFinite(n));
}

export function mergeClosedYear(
  settingsJson: unknown,
  year: number,
  bookId?: string | null,
  dualWriteLegacyNas = true,
): Record<string, unknown> {
  const base =
    settingsJson && typeof settingsJson === "object"
      ? { ...(settingsJson as Record<string, unknown>) }
      : {};
  const rep =
    base.reporting && typeof base.reporting === "object"
      ? { ...(base.reporting as Record<string, unknown>) }
      : {};
  if (bookId) {
    const byBook =
      rep.closedYearsByBookId && typeof rep.closedYearsByBookId === "object"
        ? { ...(rep.closedYearsByBookId as Record<string, unknown>) }
        : {};
    const prev = Array.isArray(byBook[bookId])
      ? [...(byBook[bookId] as unknown[])]
      : [];
    if (!prev.includes(year) && !prev.includes(String(year))) {
      prev.push(year);
    }
    byBook[bookId] = prev
      .map((x) => (typeof x === "number" ? x : Number(x)))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    rep.closedYearsByBookId = byBook;
  }
  if (dualWriteLegacyNas) {
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
  }
  base.reporting = rep;
  return base;
}

/** Inverse of mergeClosedYear — remove a year from settings.reporting.closedYears. */
export function unmergeClosedYear(
  settingsJson: unknown,
  year: number,
  bookId?: string | null,
  dualWriteLegacyNas = true,
): Record<string, unknown> {
  const base =
    settingsJson && typeof settingsJson === "object"
      ? { ...(settingsJson as Record<string, unknown>) }
      : {};
  const rep =
    base.reporting && typeof base.reporting === "object"
      ? { ...(base.reporting as Record<string, unknown>) }
      : {};
  if (bookId) {
    const byBook =
      rep.closedYearsByBookId && typeof rep.closedYearsByBookId === "object"
        ? { ...(rep.closedYearsByBookId as Record<string, unknown>) }
      : {};
    const prev = Array.isArray(byBook[bookId])
      ? [...(byBook[bookId] as unknown[])]
      : [];
    const next = prev
      .map((x) => (typeof x === "number" ? x : Number(x)))
      .filter((n) => Number.isFinite(n) && n !== year)
      .sort((a, b) => a - b);
    if (next.length > 0) byBook[bookId] = next;
    else delete byBook[bookId];
    if (Object.keys(byBook).length > 0) rep.closedYearsByBookId = byBook;
    else delete rep.closedYearsByBookId;
  }
  if (dualWriteLegacyNas) {
    const prev = Array.isArray(rep.closedYears)
      ? [...(rep.closedYears as unknown[])]
      : [];
    rep.closedYears = prev
      .map((x) => (typeof x === "number" ? x : Number(x)))
      .filter((n) => Number.isFinite(n) && n !== year)
      .sort((a, b) => a - b);
  }
  base.reporting = rep;
  return base;
}

/**
 * Read closed YYYY-MM keys for a ledger alias and/or AccountingBook id.
 * Prefer closedPeriodsByBookId[bookId], then closedPeriodsByLedger[ledgerType].
 */
export function getClosedPeriodKeys(
  settingsJson: unknown,
  ledgerType: ClosedPeriodLedgerKey = "NAS",
  bookId?: string | null,
): string[] {
  if (!settingsJson || typeof settingsJson !== "object") return [];
  const r = (settingsJson as Record<string, unknown>).reporting;
  if (!r || typeof r !== "object") return [];
  const rep = r as Record<string, unknown>;
  const byBook = rep.closedPeriodsByBookId;
  if (bookId && byBook && typeof byBook === "object") {
    const arr = (byBook as Record<string, unknown>)[bookId];
    if (Array.isArray(arr)) {
      return arr.filter((x): x is string => typeof x === "string");
    }
  }
  const byLedger = rep.closedPeriodsByLedger;
  if (byLedger && typeof byLedger === "object") {
    const arr = (byLedger as Record<string, unknown>)[ledgerType];
    if (Array.isArray(arr)) {
      return arr.filter((x): x is string => typeof x === "string");
    }
  }
  // Legacy flat closedPeriods applies to NAS only (back-compat).
  if (ledgerType === "NAS") {
    const cp = rep.closedPeriods;
    if (!Array.isArray(cp)) return [];
    return cp.filter((x): x is string => typeof x === "string");
  }
  return [];
}

export function getLockedPeriodUntil(
  settingsJson: unknown,
  ledgerType: ClosedPeriodLedgerKey = "NAS",
  bookId?: string | null,
): Date | null {
  if (!settingsJson || typeof settingsJson !== "object") return null;
  const ledger = (settingsJson as Record<string, unknown>).ledger;
  if (!ledger || typeof ledger !== "object") return null;
  const L = ledger as Record<string, unknown>;
  const byBook = L.lockedPeriodUntilByBookId;
  if (bookId && byBook && typeof byBook === "object") {
    const value = (byBook as Record<string, unknown>)[bookId];
    if (typeof value === "string" && value.trim()) {
      try {
        return parseIsoDateOnly(value);
      } catch {
        return null;
      }
    }
  }
  const byLedger = L.lockedPeriodUntilByLedger;
  if (byLedger && typeof byLedger === "object") {
    const value = (byLedger as Record<string, unknown>)[ledgerType];
    if (typeof value === "string" && value.trim()) {
      try {
        return parseIsoDateOnly(value);
      } catch {
        return null;
      }
    }
  }
  if (ledgerType !== "NAS") return null;
  const value = L.lockedPeriodUntil;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return parseIsoDateOnly(value);
  } catch {
    return null;
  }
}

/** YYYY-MM-DD по UTC-календарю (для API отчётов). */
export function dateToIsoYmdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Нарезка периода [dateFrom, dateTo] по календарным месяцам (UTC).
 * Для каждого куска — границы включительно и дата курса (конец куска).
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
  ledgerType: ClosedPeriodLedgerKey = "NAS",
  bookId?: string | null,
): Record<string, unknown> {
  const base =
    settingsJson && typeof settingsJson === "object"
      ? { ...(settingsJson as Record<string, unknown>) }
      : {};
  const rep =
    base.reporting && typeof base.reporting === "object"
      ? { ...(base.reporting as Record<string, unknown>) }
      : {};
  const byLedger =
    rep.closedPeriodsByLedger && typeof rep.closedPeriodsByLedger === "object"
      ? { ...(rep.closedPeriodsByLedger as Record<string, unknown>) }
      : {};
  const prev = Array.isArray(byLedger[ledgerType])
    ? [...(byLedger[ledgerType] as string[])]
    : ledgerType === "NAS" && Array.isArray(rep.closedPeriods)
      ? [...(rep.closedPeriods as string[])]
      : [];
  if (!prev.includes(key)) prev.push(key);
  byLedger[ledgerType] = prev.sort();
  rep.closedPeriodsByLedger = byLedger;
  if (bookId) {
    const byBook =
      rep.closedPeriodsByBookId && typeof rep.closedPeriodsByBookId === "object"
        ? { ...(rep.closedPeriodsByBookId as Record<string, unknown>) }
        : {};
    const bookPrev = Array.isArray(byBook[bookId])
      ? [...(byBook[bookId] as string[])]
      : [];
    if (!bookPrev.includes(key)) bookPrev.push(key);
    byBook[bookId] = bookPrev.sort();
    rep.closedPeriodsByBookId = byBook;
  }
  // Keep legacy NAS flat list in sync for older clients.
  if (ledgerType === "NAS") {
    rep.closedPeriods = prev.sort();
  }
  base.reporting = rep;
  return base;
}

/** Remove YYYY-MM from closedPeriodsByLedger (and legacy NAS flat list). */
export function unmergeClosedPeriod(
  settingsJson: unknown,
  key: string,
  ledgerType: ClosedPeriodLedgerKey = "NAS",
  bookId?: string | null,
): Record<string, unknown> {
  const base =
    settingsJson && typeof settingsJson === "object"
      ? { ...(settingsJson as Record<string, unknown>) }
      : {};
  const rep =
    base.reporting && typeof base.reporting === "object"
      ? { ...(base.reporting as Record<string, unknown>) }
      : {};
  const byLedger =
    rep.closedPeriodsByLedger && typeof rep.closedPeriodsByLedger === "object"
      ? { ...(rep.closedPeriodsByLedger as Record<string, unknown>) }
      : {};
  const prev = Array.isArray(byLedger[ledgerType])
    ? [...(byLedger[ledgerType] as string[])]
    : ledgerType === "NAS" && Array.isArray(rep.closedPeriods)
      ? [...(rep.closedPeriods as string[])]
      : [];
  const next = prev.filter((k) => k !== key).sort();
  byLedger[ledgerType] = next;
  rep.closedPeriodsByLedger = byLedger;
  if (bookId) {
    const byBook =
      rep.closedPeriodsByBookId && typeof rep.closedPeriodsByBookId === "object"
        ? { ...(rep.closedPeriodsByBookId as Record<string, unknown>) }
        : {};
    const bookPrev = Array.isArray(byBook[bookId])
      ? [...(byBook[bookId] as string[])]
      : [];
    const bookNext = bookPrev.filter((k) => k !== key).sort();
    if (bookNext.length > 0) byBook[bookId] = bookNext;
    else delete byBook[bookId];
    if (Object.keys(byBook).length > 0) rep.closedPeriodsByBookId = byBook;
    else delete rep.closedPeriodsByBookId;
  }
  if (ledgerType === "NAS") {
    rep.closedPeriods = next;
  }
  base.reporting = rep;
  return base;
}

export function mergeLockedPeriodUntil(
  settingsJson: unknown,
  lockedPeriodUntil: string | null,
  ledgerType: ClosedPeriodLedgerKey = "NAS",
  bookId?: string | null,
): Record<string, unknown> {
  const base =
    settingsJson && typeof settingsJson === "object"
      ? { ...(settingsJson as Record<string, unknown>) }
      : {};
  const ledger =
    base.ledger && typeof base.ledger === "object"
      ? { ...(base.ledger as Record<string, unknown>) }
      : {};
  const byLedger =
    ledger.lockedPeriodUntilByLedger &&
    typeof ledger.lockedPeriodUntilByLedger === "object"
      ? { ...(ledger.lockedPeriodUntilByLedger as Record<string, unknown>) }
      : {};
  const byBook =
    ledger.lockedPeriodUntilByBookId &&
    typeof ledger.lockedPeriodUntilByBookId === "object"
      ? { ...(ledger.lockedPeriodUntilByBookId as Record<string, unknown>) }
      : {};

  if (lockedPeriodUntil) {
    byLedger[ledgerType] = lockedPeriodUntil;
    if (bookId) byBook[bookId] = lockedPeriodUntil;
    if (ledgerType === "NAS") {
      ledger.lockedPeriodUntil = lockedPeriodUntil;
    }
  } else {
    delete byLedger[ledgerType];
    if (bookId) delete byBook[bookId];
    if (ledgerType === "NAS") {
      delete ledger.lockedPeriodUntil;
    }
  }

  if (Object.keys(byLedger).length > 0) {
    ledger.lockedPeriodUntilByLedger = byLedger;
  } else {
    delete ledger.lockedPeriodUntilByLedger;
  }
  if (Object.keys(byBook).length > 0) {
    ledger.lockedPeriodUntilByBookId = byBook;
  } else {
    delete ledger.lockedPeriodUntilByBookId;
  }
  base.ledger = ledger;
  return base;
}
