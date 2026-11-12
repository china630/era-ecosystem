import { prisma } from '@/lib/prisma';

export async function createReservationGroup(input: {
  code: string;
  name?: string;
  agencyId?: string;
  folioMode?: 'INDIVIDUAL' | 'MASTER' | 'SPLIT';
  allotmentBlockId?: string;
  checkInDate?: Date;
  checkOutDate?: Date;
  notes?: string;
}) {
  return prisma.reservationGroup.create({
    data: {
      code: input.code,
      name: input.name,
      agencyId: input.agencyId,
      folioMode: input.folioMode ?? 'INDIVIDUAL',
      allotmentBlockId: input.allotmentBlockId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      notes: input.notes,
    },
  });
}

export async function assignReservationToGroup(reservationId: string, groupId: string | null) {
  return prisma.reservation.update({
    where: { id: reservationId },
    data: { groupId },
  });
}
