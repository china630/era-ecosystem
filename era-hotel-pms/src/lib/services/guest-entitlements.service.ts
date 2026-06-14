import { prisma } from '@/lib/prisma';

export type GuestEntitlements = {
  reservationId: string;
  roomNumber: string | null;
  mealPlanCode: string | null;
  breakfastIncluded: boolean;
  allInclusive: boolean;
  addOns: Array<{ code: string; inclusion: string }>;
};

export async function getGuestEntitlements(input: {
  roomNumber?: string;
  reservationId?: string;
}): Promise<GuestEntitlements | null> {
  if (!input.roomNumber && !input.reservationId) {
    throw new Error('roomNumber or reservationId required');
  }

  const reservation = input.reservationId
    ? await prisma.reservation.findUnique({
        where: { id: input.reservationId },
        include: {
          ratePlan: { include: { mealPlan: true, addOns: { include: { addOn: true } } } },
          room: true,
        },
      })
    : await prisma.reservation.findFirst({
        where: {
          status: 'IN_HOUSE',
          room: { roomNumber: input.roomNumber },
        },
        include: {
          ratePlan: { include: { mealPlan: true, addOns: { include: { addOn: true } } } },
          room: true,
        },
        orderBy: { checkInDate: 'desc' },
      });

  if (!reservation) return null;

  const mealCode = reservation.ratePlan.mealPlan?.code ?? null;
  const addOns = reservation.ratePlan.addOns.map((l) => ({
    code: l.addOn.code,
    inclusion: l.inclusion,
  }));

  const breakfastIncluded =
    mealCode === 'BB' ||
    mealCode === 'HB' ||
    mealCode === 'FB' ||
    mealCode === 'AI' ||
    addOns.some((a) => a.code === 'BREAKFAST' && a.inclusion === 'INCLUDED');

  const allInclusive =
    mealCode === 'AI' || addOns.some((a) => a.code === 'ALL_INCLUSIVE' && a.inclusion === 'INCLUDED');

  return {
    reservationId: reservation.id,
    roomNumber: reservation.room?.roomNumber ?? input.roomNumber ?? null,
    mealPlanCode: mealCode,
    breakfastIncluded,
    allInclusive,
    addOns,
  };
}
