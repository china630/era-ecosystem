import { prisma } from '@/lib/prisma';

export async function recordRoomMove(input: {
  reservationId: string;
  fromRoomId?: string | null;
  toRoomId?: string | null;
  effectiveAt?: Date;
  notes?: string;
  reasonCode?: string;
  createdByUserId?: string;
  kind?: 'OCCURRED' | 'SCHEDULED';
  status?: 'PENDING' | 'APPLIED' | 'CANCELLED';
}) {
  return prisma.roomChangePlan.create({
    data: {
      reservationId: input.reservationId,
      fromRoomId: input.fromRoomId ?? undefined,
      toRoomId: input.toRoomId ?? undefined,
      effectiveAt: input.effectiveAt ?? new Date(),
      notes: input.notes,
      reasonCode: input.reasonCode,
      createdByUserId: input.createdByUserId,
      kind: input.kind ?? 'OCCURRED',
      status: input.status ?? 'APPLIED',
    },
    include: { fromRoom: true, toRoom: true, reservation: { include: { guest: true } } },
  });
}

export async function listRoomChangesForReservation(reservationId: string) {
  return prisma.roomChangePlan.findMany({
    where: { reservationId, kind: 'OCCURRED' },
    orderBy: { effectiveAt: 'asc' },
    include: { fromRoom: true, toRoom: true },
  });
}
