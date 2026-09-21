import { createHash } from 'crypto';
import type { AvailabilityPushRow } from '@/lib/channel/adapters/types';
import { isChannexUuid } from '@/lib/channel/channex-api';

export const CHANNEX_SOFT_ROOM_TYPE_CAP = 20;
export const CHANNEX_SOFT_RATE_PLAN_CAP = 200;

export type AriJobKind = 'AVAILABILITY' | 'RESTRICTIONS';

type CanonicalRow = {
  date: string;
  otaRoomCode: string;
  otaRateCode?: string;
  available: number;
  price?: number;
  stopSell?: boolean;
};

export function canonicalizeAriRows(rows: AvailabilityPushRow[]): CanonicalRow[] {
  return [...rows]
    .map((r) => ({
      date: r.date,
      otaRoomCode: r.otaRoomCode,
      otaRateCode: r.otaRateCode,
      available: r.available,
      price: r.price,
      stopSell: r.stopSell,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export function hashAriPayload(kind: AriJobKind, rows: AvailabilityPushRow[]): string {
  const payload = JSON.stringify({ kind, rows: canonicalizeAriRows(rows) });
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

export function splitAriJobs(rows: AvailabilityPushRow[]): {
  availability: AvailabilityPushRow[];
  restrictions: AvailabilityPushRow[];
} {
  const availByKey = new Map<string, AvailabilityPushRow>();
  const restrictions: AvailabilityPushRow[] = [];
  for (const row of rows) {
    if (isChannexUuid(row.otaRoomCode)) {
      const key = `${row.otaRoomCode}|${row.date}`;
      const prev = availByKey.get(key);
      if (!prev || (row.stopSell ? 0 : row.available) < (prev.stopSell ? 0 : prev.available)) {
        availByKey.set(key, row);
      }
    }
    if (isChannexUuid(row.otaRateCode) && isChannexUuid(row.otaRoomCode)) {
      restrictions.push(row);
    }
  }
  return { availability: [...availByKey.values()], restrictions };
}

export function softCapWarnings(rows: AvailabilityPushRow[]): string[] {
  const rooms = new Set(rows.map((r) => r.otaRoomCode).filter(Boolean));
  const rates = new Set(rows.map((r) => r.otaRateCode).filter(Boolean));
  const warnings: string[] = [];
  if (rooms.size > CHANNEX_SOFT_ROOM_TYPE_CAP) {
    warnings.push(`room_types ${rooms.size} > ${CHANNEX_SOFT_ROOM_TYPE_CAP}`);
  }
  if (rates.size > CHANNEX_SOFT_RATE_PLAN_CAP) {
    warnings.push(`rate_plans ${rates.size} > ${CHANNEX_SOFT_RATE_PLAN_CAP}`);
  }
  return warnings;
}
