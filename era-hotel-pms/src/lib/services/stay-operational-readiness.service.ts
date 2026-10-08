import { todayBakuYmd } from '@era/satellite-kit/time';
import { prisma } from '@/lib/prisma';
import {
  gapsForStay,
  type StayOperationalGap,
} from '@/lib/guest-stay-requirements';

const guestInclude = {
  documents: { select: { docType: true, docNumber: true } },
  contacts: { select: { kind: true, value: true } },
} as const;

export async function collectStayOperationalGaps(
  reservationId: string,
): Promise<StayOperationalGap[]> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      guest: { include: guestInclude },
      paxGuests: { include: { guest: { include: guestInclude } } },
    },
  });
  if (!reservation) throw new Error('Reservation not found');
  return gapsForStay(reservation, todayBakuYmd());
}
