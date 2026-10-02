import { bakuDateKey, parseBakuDateTime, todayBakuYmd } from "@era/satellite-kit/time";

export const DEFAULT_BUSINESS_DAY_START = "05:00";

export function normalizeBusinessDayStart(raw: string | null | undefined): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec((raw ?? "").trim());
  if (!match) return DEFAULT_BUSINESS_DAY_START;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return DEFAULT_BUSINESS_DAY_START;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Start instant of the business day that contains `now` (Asia/Baku). */
export function currentBusinessDayStart(now: Date, hhmm: string): Date {
  const start = normalizeBusinessDayStart(hhmm);
  const today = todayBakuYmd(now);
  const todayStart = parseBakuDateTime(today, start);
  if (now.getTime() >= todayStart.getTime()) return todayStart;
  const yesterday = bakuDateKey(new Date(todayStart.getTime() - 60 * 60 * 1000));
  return parseBakuDateTime(yesterday, start);
}

export function isShiftStale(openedAt: Date, now: Date, hhmm: string): boolean {
  return openedAt.getTime() < currentBusinessDayStart(now, hhmm).getTime();
}

export function categoryCodeFromName(name: string, fallback: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase()
    .slice(0, 12);
  return slug || fallback;
}
