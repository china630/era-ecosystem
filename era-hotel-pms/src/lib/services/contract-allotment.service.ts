import { prisma } from '@/lib/prisma';
import {
  computeBarPoolAfterContractHold,
  computeContractNightAvailable,
  eachNight,
} from '@/lib/services/contract-allotment-core';
import {
  countDoorsUsedOnNight,
  loadShareSlicesForType,
} from '@/lib/services/share-assignment.service';

export async function listContractAllotments(salesContractId: string) {
  return prisma.contractAllotment.findMany({
    where: { salesContractId },
    include: { roomType: true },
    orderBy: [{ validFrom: 'asc' }, { roomType: { code: 'asc' } }],
  });
}

export async function upsertContractAllotment(input: {
  salesContractId: string;
  roomTypeId: string;
  validFrom: Date;
  validTo: Date;
  nightlyQuota: number;
  releaseDays?: number;
  id?: string;
}) {
  if (input.nightlyQuota < 1) throw new Error('Nightly quota must be at least 1');
  if (input.validTo < input.validFrom) throw new Error('validTo must be on or after validFrom');

  const contract = await prisma.salesContract.findUnique({ where: { id: input.salesContractId } });
  if (!contract) throw new Error('Sales contract not found');

  const roomType = await prisma.roomType.findUnique({ where: { id: input.roomTypeId } });
  if (!roomType) throw new Error('Room type not found');

  if (input.id) {
    return prisma.contractAllotment.update({
      where: { id: input.id },
      data: {
        roomTypeId: input.roomTypeId,
        validFrom: input.validFrom,
        validTo: input.validTo,
        nightlyQuota: input.nightlyQuota,
        releaseDays: input.releaseDays ?? 0,
      },
      include: { roomType: true },
    });
  }

  return prisma.contractAllotment.create({
    data: {
      salesContractId: input.salesContractId,
      roomTypeId: input.roomTypeId,
      validFrom: input.validFrom,
      validTo: input.validTo,
      nightlyQuota: input.nightlyQuota,
      releaseDays: input.releaseDays ?? 0,
    },
    include: { roomType: true },
  });
}

export async function deleteContractAllotment(id: string) {
  return prisma.contractAllotment.delete({ where: { id } });
}

/** Count contract-tagged reservations overlapping a night for a room type. */
async function countContractBookings(roomTypeId: string, night: Date, salesContractId?: string) {
  const nextDay = new Date(night.getTime() + 86400000);
  return prisma.reservation.count({
    where: {
      roomTypeId,
      ...(salesContractId ? { salesContractId } : { salesContractId: { not: null } }),
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'OPTION'] },
      checkInDate: { lt: nextDay },
      checkOutDate: { gt: night },
    },
  });
}

/** Effective allotment quota for a room type on a given night (sum of active contract allotments). */
export async function getContractAllotmentQuota(roomTypeId: string, night: Date): Promise<number> {
  const day = new Date(night.toISOString().slice(0, 10));
  const rows = await prisma.contractAllotment.findMany({
    where: {
      roomTypeId,
      validFrom: { lte: day },
      validTo: { gte: day },
      salesContract: { status: 'ACTIVE' },
    },
  });
  return rows.reduce((sum, r) => sum + r.nightlyQuota, 0);
}

/**
 * Contract allotment reduces BAR availability: effective quota = min(room baseQuota, contract pool remaining + non-contract booked).
 * Priority: contract block > OTA > BAR (contract reservations consume allotment first).
 */
export async function getAvailabilityWithContractAllotment(
  roomTypeId: string,
  from: Date,
  to: Date,
  salesContractId?: string,
) {
  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!roomType) throw new Error('Room type not found');

  const nights = eachNight(from, to);
  const dayResults = [];

  for (const night of nights) {
    const nightEnd = new Date(night.getTime() + 86400000);
    const slices = await loadShareSlicesForType(roomTypeId, night, nightEnd);
    const overlapping = countDoorsUsedOnNight(slices, night, roomType.adultCapacity ?? 2);

    let available = Math.max(0, roomType.baseQuota - overlapping);

    if (salesContractId) {
      const allotment = await prisma.contractAllotment.findFirst({
        where: {
          salesContractId,
          roomTypeId,
          validFrom: { lte: night },
          validTo: { gte: night },
          salesContract: { status: 'ACTIVE' },
        },
      });
      if (!allotment) {
        dayResults.push({
          date: night.toISOString().slice(0, 10),
          available: 0,
          contractAllotment: 0,
          contractBooked: 0,
          reason: 'NO_ALLOTMENT',
        });
        continue;
      }
      const contractBooked = await countContractBookings(roomTypeId, night, salesContractId);
      const { available: contractAvail } = computeContractNightAvailable(
        allotment.nightlyQuota,
        contractBooked,
        available,
      );
      available = contractAvail;
      dayResults.push({
        date: night.toISOString().slice(0, 10),
        available,
        contractAllotment: allotment.nightlyQuota,
        contractBooked,
      });
    } else {
      const contractQuota = await getContractAllotmentQuota(roomTypeId, night);
      const contractBooked = await countContractBookings(roomTypeId, night);
      const barPool = computeBarPoolAfterContractHold(
        roomType.baseQuota,
        overlapping,
        contractQuota,
        contractBooked,
      );
      dayResults.push({
        date: night.toISOString().slice(0, 10),
        available: barPool,
        contractAllotment: contractQuota,
        contractBooked,
      });
    }
  }

  const minAvailable = dayResults.length
    ? Math.min(...dayResults.map((d) => d.available))
    : 0;

  return { quota: roomType.baseQuota, nights: dayResults, available: minAvailable };
}

export async function assertContractAllotmentAvailable(
  salesContractId: string,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
) {
  const result = await getAvailabilityWithContractAllotment(
    roomTypeId,
    checkIn,
    checkOut,
    salesContractId,
  );
  if (result.available < 1) {
    throw new Error('Contract allotment exhausted for selected dates');
  }
}
