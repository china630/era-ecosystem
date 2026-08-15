import { prisma } from '@/lib/prisma';
import type { AllotmentBlockStatus, Prisma } from '@prisma/client';

export async function listAllotmentBlocks(filter?: {
  status?: AllotmentBlockStatus;
  agencyId?: string;
}) {
  return prisma.allotmentBlock.findMany({
    where: {
      status: filter?.status,
      agencyId: filter?.agencyId,
    },
    include: {
      agency: { select: { id: true, code: true, name: true } },
      salesContract: { select: { id: true, code: true, name: true } },
      lines: {
        include: {
          roomType: { select: { id: true, code: true, name: true } },
          ratePlan: { select: { id: true, code: true, name: true } },
        },
      },
      bookings: { select: { id: true, code: true, name: true } },
      _count: { select: { bookings: true } },
    },
    orderBy: [{ validFrom: 'desc' }, { code: 'asc' }],
  });
}

export async function getAllotmentBlock(id: string) {
  return prisma.allotmentBlock.findUnique({
    where: { id },
    include: {
      agency: true,
      salesContract: true,
      lines: { include: { roomType: true, ratePlan: true } },
      bookings: {
        include: {
          reservations: {
            select: {
              id: true,
              status: true,
              roomTypeId: true,
              checkInDate: true,
              checkOutDate: true,
              roomId: true,
            },
          },
        },
      },
    },
  });
}

export type AllotmentBlockLineInput = {
  roomTypeId: string;
  quantity: number;
  ratePlanId?: string | null;
};

export async function createAllotmentBlock(input: {
  code: string;
  name?: string;
  status?: AllotmentBlockStatus;
  agencyId?: string;
  salesContractId?: string;
  validFrom: Date;
  validTo: Date;
  cutoffDate?: Date | null;
  notes?: string;
  lines: AllotmentBlockLineInput[];
}) {
  if (!input.lines.length) throw new Error('At least one block line is required');
  if (input.validTo < input.validFrom) throw new Error('validTo must be on or after validFrom');
  for (const line of input.lines) {
    if (line.quantity < 1) throw new Error('Line quantity must be >= 1');
  }

  return prisma.allotmentBlock.create({
    data: {
      code: input.code,
      name: input.name,
      status: input.status ?? 'TENTATIVE',
      agencyId: input.agencyId,
      salesContractId: input.salesContractId,
      validFrom: input.validFrom,
      validTo: input.validTo,
      cutoffDate: input.cutoffDate ?? undefined,
      notes: input.notes,
      lines: {
        create: input.lines.map((l) => ({
          roomTypeId: l.roomTypeId,
          quantity: l.quantity,
          ratePlanId: l.ratePlanId ?? undefined,
        })),
      },
    },
    include: { lines: true },
  });
}

export async function updateAllotmentBlock(
  id: string,
  input: {
    name?: string;
    status?: AllotmentBlockStatus;
    agencyId?: string | null;
    salesContractId?: string | null;
    validFrom?: Date;
    validTo?: Date;
    cutoffDate?: Date | null;
    notes?: string | null;
    lines?: AllotmentBlockLineInput[];
  },
) {
  return prisma.$transaction(async (tx) => {
    const data: Prisma.AllotmentBlockUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.status !== undefined) data.status = input.status;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.validFrom !== undefined) data.validFrom = input.validFrom;
    if (input.validTo !== undefined) data.validTo = input.validTo;
    if (input.cutoffDate !== undefined) data.cutoffDate = input.cutoffDate;
    if (input.agencyId !== undefined) {
      data.agency = input.agencyId ? { connect: { id: input.agencyId } } : { disconnect: true };
    }
    if (input.salesContractId !== undefined) {
      data.salesContract = input.salesContractId
        ? { connect: { id: input.salesContractId } }
        : { disconnect: true };
    }

    if (input.lines) {
      await tx.allotmentBlockLine.deleteMany({ where: { allotmentBlockId: id } });
      await tx.allotmentBlockLine.createMany({
        data: input.lines.map((l) => ({
          allotmentBlockId: id,
          roomTypeId: l.roomTypeId,
          quantity: l.quantity,
          ratePlanId: l.ratePlanId ?? null,
        })),
      });
    }

    return tx.allotmentBlock.update({
      where: { id },
      data,
      include: { lines: true },
    });
  });
}

/** Rooms held minus stays already picked into bookings linked to this block. */
export async function getAllotmentBlockPickup(id: string) {
  const block = await getAllotmentBlock(id);
  if (!block) return null;

  const pickedByType = new Map<string, number>();
  for (const booking of block.bookings) {
    for (const stay of booking.reservations) {
      if (stay.status === 'CANCELLED' || stay.status === 'NO_SHOW') continue;
      pickedByType.set(stay.roomTypeId, (pickedByType.get(stay.roomTypeId) ?? 0) + 1);
    }
  }

  const lines = block.lines.map((line) => {
    const picked = pickedByType.get(line.roomTypeId) ?? 0;
    return {
      roomTypeId: line.roomTypeId,
      roomTypeCode: line.roomType.code,
      quantity: line.quantity,
      picked,
      remaining: Math.max(0, line.quantity - picked),
    };
  });

  return {
    blockId: block.id,
    code: block.code,
    status: block.status,
    cutoffDate: block.cutoffDate,
    lines,
    totalHeld: lines.reduce((s, l) => s + l.quantity, 0),
    totalPicked: lines.reduce((s, l) => s + l.picked, 0),
    totalRemaining: lines.reduce((s, l) => s + l.remaining, 0),
  };
}
