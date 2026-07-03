/**
 * Production calendar — read-only via Orchestrator Platform Catalog Gateway.
 */

import type {
  CalendarAddBusinessDaysResponse,
  CalendarDayPoint,
  CalendarDayResponse,
  CalendarDaysBulkResponse,
} from "@era/contracts";
import {
  platformCatalogGet,
  type PlatformCatalogClientOptions,
} from "./platform-catalog.client";

/** @deprecated Use PlatformCatalogClientOptions */
export type CalendarClientOptions = PlatformCatalogClientOptions;

type CacheEntry<T> = { at: number; value: T };

const YEAR_TTL_MS = 24 * 60 * 60 * 1000;
const yearCache = new Map<string, CacheEntry<Map<string, CalendarDayPoint>>>();

/** Degraded fallback: Sat/Sun non-working only (no per-app az-2026.ts). */
export function fallbackIsWorkingDay(isoDate: string): boolean {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`);
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6;
}

export function fallbackDayType(isoDate: string): CalendarDayPoint["dayType"] {
  return fallbackIsWorkingDay(isoDate) ? "working" : "weekend";
}

function cacheKey(country: string, year: number): string {
  return `${country.toUpperCase()}:${year}`;
}

function getCachedDay(
  country: string,
  isoDate: string,
): CalendarDayPoint | null {
  const year = Number(isoDate.slice(0, 4));
  const hit = yearCache.get(cacheKey(country, year));
  if (!hit || Date.now() - hit.at > YEAR_TTL_MS) return null;
  return hit.value.get(isoDate) ?? null;
}

function putCachedDays(country: string, days: CalendarDayPoint[]): void {
  if (days.length === 0) return;
  const year = Number(days[0]!.date.slice(0, 4));
  const map = new Map<string, CalendarDayPoint>();
  for (const d of days) map.set(d.date, d);
  yearCache.set(cacheKey(country, year), { at: Date.now(), value: map });
}

async function getJson<T>(
  path: string,
  opts?: CalendarClientOptions,
): Promise<T | null> {
  return platformCatalogGet<T>(path, opts);
}

export async function getCalendarDay(
  date: string,
  country = "az",
  opts?: CalendarClientOptions,
): Promise<CalendarDayPoint | null> {
  const iso = date.slice(0, 10);
  const cached = getCachedDay(country, iso);
  if (cached) return cached;

  const body = await getJson<CalendarDayResponse>(
    `/calendar/${country}/day?date=${encodeURIComponent(iso)}`,
    opts,
  );
  if (body?.date) {
    const point: CalendarDayPoint = {
      country: body.country,
      date: body.date,
      isWorking: body.isWorking,
      dayType: body.dayType,
      labelAz: body.labelAz,
      labelRu: body.labelRu,
      labelEn: body.labelEn,
    };
    putCachedDays(country, [point]);
    return point;
  }

  const legacy = await getJson<CalendarDayResponse>(
    `/calendar/${country}/is-working-day?date=${encodeURIComponent(iso)}`,
    opts,
  );
  if (legacy?.date) {
    const point: CalendarDayPoint = {
      country: legacy.country,
      date: legacy.date,
      isWorking: legacy.isWorking,
      dayType: legacy.dayType,
      labelAz: legacy.labelAz,
      labelRu: legacy.labelRu,
      labelEn: legacy.labelEn,
    };
    putCachedDays(country, [point]);
    return point;
  }

  return {
    country: country.toUpperCase(),
    date: iso,
    isWorking: fallbackIsWorkingDay(iso),
    dayType: fallbackDayType(iso),
  };
}

export async function isWorkingDay(
  date: string,
  country = "az",
  opts?: CalendarClientOptions,
): Promise<boolean> {
  const day = await getCalendarDay(date, country, opts);
  return day?.isWorking ?? fallbackIsWorkingDay(date.slice(0, 10));
}

export async function addBusinessDays(
  date: string,
  n: number,
  country = "az",
  opts?: CalendarClientOptions,
): Promise<string> {
  const q = new URLSearchParams({
    date: date.slice(0, 10),
    n: String(n),
  });
  const body = await getJson<CalendarAddBusinessDaysResponse>(
    `/calendar/${country}/add-business-days?${q}`,
    opts,
  );
  if (body?.resultDate) return body.resultDate;

  let cursor = new Date(`${date.slice(0, 10)}T12:00:00.000Z`);
  let added = 0;
  while (added < n) {
    cursor = new Date(cursor.getTime() + 86400000);
    const iso = cursor.toISOString().slice(0, 10);
    if (await isWorkingDay(iso, country, opts)) added++;
    if (cursor.getUTCFullYear() > 2035) break;
  }
  return cursor.toISOString().slice(0, 10);
}

export async function getCalendarDaysRange(
  from: string,
  to: string,
  country = "az",
  opts?: CalendarClientOptions,
): Promise<CalendarDayPoint[]> {
  const q = new URLSearchParams({
    from: from.slice(0, 10),
    to: to.slice(0, 10),
  });
  const body = await getJson<CalendarDaysBulkResponse>(
    `/calendar/${country}/days?${q}`,
    opts,
  );
  if (body?.days?.length) {
    putCachedDays(country, body.days);
    return body.days;
  }
  return [];
}

export async function warmCalendarYear(
  year: number,
  country = "az",
  opts?: CalendarClientOptions,
): Promise<number> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const days = await getCalendarDaysRange(from, to, country, opts);
  return days.length;
}
