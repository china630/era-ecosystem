import { prisma } from '@/lib/prisma';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { eachNight } from '@/lib/services/contract-allotment-core';
import { isStopSellForDate } from '@/lib/services/channel.service';
import {
  countDoorsUsedOnNight,
  loadInventoryStays,
  resolveMaxBed,
  segmentsConsumingType,
  type ShareReservationSlice,
} from '@/lib/services/share-assignment.service';
import {
  houseSellCap,
  sellableOnNight,
  typeSellCap,
  worstNight,
  type SellCapReason,
} from '@/lib/services/inventory-caps';

export class InventoryCapError extends Error {
  status = 409;
  code: SellCapReason;
  constructor(code: SellCapReason) {
    super(
      code === 'STOP_SELL'
        ? 'Stop sell is closed for this room type'
        : code === 'TYPE_CAP'
          ? 'Room type overbook limit reached'
          : 'House overbook limit reached',
    );
    this.name = 'InventoryCapError';
    this.code = code;
  }
}

type TypeRow = {
  id: string;
  baseQuota: number;
  overbookAllowance: number;
  adultCapacity: number | null;
};

export type NightSellState = {
  night: Date;
  typeUsed: number;
  typeCap: number;
  houseUsed: number;
  houseCap: number;
  stopSell: boolean;
  available: number;
  reason: SellCapReason | null;
};

async function houseAllowance(): Promise<number> {
  const profile = await prisma.hotelProfile.findFirst({
    select: { houseOverbookAllowance: true },
  });
  return profile?.houseOverbookAllowance ?? 0;
}

async function activeTypes(): Promise<TypeRow[]> {
  return prisma.roomType.findMany({
    where: { active: true },
    select: { id: true, baseQuota: true, overbookAllowance: true, adultCapacity: true },
  });
}

function houseUsedOnNight(
  types: TypeRow[],
  segments: Map<string, ShareReservationSlice[]>,
  night: Date,
): number {
  let used = 0;
  for (const type of types) {
    const bed = resolveMaxBed(null, type.adultCapacity);
    used += countDoorsUsedOnNight(segments.get(type.id) ?? [], night, bed);
  }
  return used;
}

/** Current occupancy and both caps for each night. Does not include a candidate stay. */
export async function sellStatesForType(
  roomTypeId: string,
  from: Date,
  to: Date,
  excludeReservationId?: string,
): Promise<{ states: NightSellState[]; roomType: TypeRow }> {
  const types = await activeTypes();
  let roomType = types.find((row) => row.id === roomTypeId) ?? null;
  if (!roomType) {
    const row = await prisma.roomType.findUnique({
      where: { id: roomTypeId },
      select: { id: true, baseQuota: true, overbookAllowance: true, adultCapacity: true },
    });
    if (!row) throw new Error('Room type not found');
    roomType = row;
    types.push(row);
  }
  const houseCap = houseSellCap(
    types.reduce((sum, row) => sum + row.baseQuota, 0),
    await houseAllowance(),
  );
  const nights = eachNight(from, to);
  const stays =
    nights.length > 0 ? await loadInventoryStays(from, to, excludeReservationId) : [];
  const segments = new Map(types.map((row) => [row.id, segmentsConsumingType(row.id, stays)]));
  const bed = resolveMaxBed(null, roomType.adultCapacity);
  const states: NightSellState[] = [];
  for (const night of nights) {
    const stopSell = await isStopSellForDate(night, roomTypeId);
    const typeCap = typeSellCap(roomType.baseQuota, roomType.overbookAllowance, stopSell);
    const typeUsed = countDoorsUsedOnNight(segments.get(roomTypeId) ?? [], night, bed);
    const houseUsed = houseUsedOnNight(types, segments, night);
    const sell = sellableOnNight({ typeUsed, typeCap, houseUsed, houseCap, stopSell });
    states.push({ night, typeUsed, typeCap, houseUsed, houseCap, stopSell, ...sell });
  }
  return { states, roomType };
}

export async function measureStaySellable(
  roomTypeId: string,
  from: Date,
  to: Date,
  excludeReservationId?: string,
) {
  const { states, roomType } = await sellStatesForType(roomTypeId, from, to, excludeReservationId);
  const worst = worstNight(states);
  const openCap = typeSellCap(roomType.baseQuota, roomType.overbookAllowance, false);
  return {
    quota: worst?.typeCap ?? openCap,
    booked: worst?.typeUsed ?? 0,
    available: worst?.available ?? 0,
    stopSell: states.some((row) => row.stopSell),
    reason: worst?.reason ?? null,
  };
}

export function rejectIfAddedDoor(state: NightSellState, usedWithCandidate: number): void {
  const delta = usedWithCandidate - state.typeUsed;
  if (delta <= 0) return;
  const sell = sellableOnNight({
    typeUsed: usedWithCandidate,
    typeCap: state.typeCap,
    houseUsed: state.houseUsed + delta,
    houseCap: state.houseCap,
    stopSell: state.stopSell,
  });
  if (sell.available < 1 && sell.reason) throw new InventoryCapError(sell.reason);
}

export function nightKey(night: Date): string {
  return hotelDateKey(night);
}
