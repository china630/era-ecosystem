/** Asia/Baku is UTC+4 year-round (no DST). */
const BAKU_OFFSET = "+04:00";
const BAKU_TZ = "Asia/Baku";

/** YYYY-MM-DD in Asia/Baku. Safe to import from client components. */
export function bakuDateKey(isoOrDate: Date | string): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BAKU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function todayBakuYmd(asOf = new Date()): string {
  return bakuDateKey(asOf);
}

/** UTC instant range covering one Asia/Baku calendar day. */
export function bakuDayBounds(dateYmd: string): { start: Date; end: Date; date: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  if (!m) {
    throw new Error("Invalid date; use YYYY-MM-DD");
  }
  const start = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00${BAKU_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, date: `${m[1]}-${m[2]}-${m[3]}` };
}

/**
 * Wall clock in Asia/Baku → UTC instant.
 * `ymd` = YYYY-MM-DD; `hhmmss` = HH:MM or HH:MM:SS (normalized to HH:MM:SS).
 */
export function parseBakuDateTime(ymd: string, hhmmss: string): Date {
  const d = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error("Invalid date; use YYYY-MM-DD");
  }
  let t = String(hhmmss ?? "").trim();
  if (/^\d{2}:\d{2}$/.test(t)) t = `${t}:00`;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(t)) {
    throw new Error("Invalid time; use HH:MM or HH:MM:SS");
  }
  const instant = new Date(`${d}T${t}${BAKU_OFFSET}`);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Invalid Baku datetime: ${d} ${t}`);
  }
  return instant;
}

/** HH:MM in Asia/Baku. */
export function bakuTimeLabel(isoOrDate: Date | string): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** DD.MM.YYYY in Asia/Baku. */
export function bakuDateDisplay(isoOrDate: Date | string): string {
  const key = bakuDateKey(isoOrDate);
  const [y, m, day] = key.split("-");
  return `${day}.${m}.${y}`;
}

/** DD.MM in Asia/Baku (compact PLAN rows). */
export function bakuDateShort(isoOrDate: Date | string): string {
  const key = bakuDateKey(isoOrDate);
  const [, m, day] = key.split("-");
  return `${day}.${m}`;
}

/** `28.08 13:05` — date + time in Asia/Baku. */
export function bakuDateTimeLabel(isoOrDate: Date | string): string {
  return `${bakuDateShort(isoOrDate)} ${bakuTimeLabel(isoOrDate)}`;
}
