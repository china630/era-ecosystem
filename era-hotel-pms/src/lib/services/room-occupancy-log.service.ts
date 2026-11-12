import { prisma } from '@/lib/prisma';

export async function recordRoomMove(input: {
  reservationId: string;
  fromRoomId?: string | null;
  toRoomId?: string | null;
  effectiveAt?: Date;
  notes?: string;
  reasonCode?: string;
  createdByUserId?: string;
  organizationId?: string;
  kind?: 'OCCURRED' | 'SCHEDULED';
  status?: 'PENDING' | 'APPLIED' | 'CANCELLED';
}) {
  const organizationId =
    input.organizationId ??
    (
      await prisma.reservation.findUnique({
        where: { id: input.reservationId },
        select: { organizationId: true },
      })
    )?.organizationId;
  if (!organizationId) throw new Error('Reservation not found');
  return prisma.roomChangePlan.create({
    data: {
      organizationId,
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
