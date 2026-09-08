export type BridgeEntityHint = 'guest' | 'reservation' | 'folio' | 'unknown';

const GUEST_OBJECTS = new Set([
  'QG_HOTEL_GUEST_SIMPLE',
  'QA_HOTEL_GUEST_RECORD',
  'QA_HOTEL_RES_GUEST',
  'QG_HOTEL_GUEST_ID',
]);

const RESERVATION_OBJECTS = new Set([
  'QA_HOTEL_RESERVATION_RESERVATION',
  'QA_HOTEL_RESERVATION',
  'QA_HOTEL_RESERVATION_CHECKOUT',
  'QA_EASYPMS_RESDETAIL',
  'QA_EASYPMS_NOTES',
]);

const FOLIO_OBJECTS = new Set(['Q_HOTELFOLIOACTION', 'HOTEL_FOLIOTRANS']);

export function objectNameFromUrl(sourceUrl: string): string | null {
  try {
    const path = new URL(sourceUrl).pathname;
    const m = path.match(/\/Select\/([^/?#]+)/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export function classifyBridgePayload(input: {
  sourceUrl: string;
  entityHint?: BridgeEntityHint | null;
}): { objectName: string | null; entity: BridgeEntityHint } {
  if (input.entityHint && input.entityHint !== 'unknown') {
    return { objectName: objectNameFromUrl(input.sourceUrl), entity: input.entityHint };
  }
  const objectName = objectNameFromUrl(input.sourceUrl);
  if (!objectName) return { objectName: null, entity: 'unknown' };
  if (GUEST_OBJECTS.has(objectName)) return { objectName, entity: 'guest' };
  if (RESERVATION_OBJECTS.has(objectName)) return { objectName, entity: 'reservation' };
  if (FOLIO_OBJECTS.has(objectName)) return { objectName, entity: 'folio' };
  return { objectName, entity: 'unknown' };
}

export function extractRows(raw: unknown): Record<string, unknown>[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  const rs = obj.ResultSets;
  if (Array.isArray(rs) && Array.isArray(rs[0])) {
    return rs[0].filter((r): r is Record<string, unknown> => !!r && typeof r === 'object');
  }
  if (Array.isArray(raw)) {
    return raw.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object');
  }
  return [obj];
}

export function rowHotelId(row: Record<string, unknown>): number | null {
  const v = row.HOTELID ?? row.OTELID;
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
