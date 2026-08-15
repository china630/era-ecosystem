import { prisma } from '@/lib/prisma';
import { createReservation } from '@/lib/services/reservation.service';
import { getAllotmentBlockPickup } from '@/lib/services/allotment-block.service';
import type { BookingFolioMode, PaymentMethod } from '@prisma/client';

/**
 * Pickup remaining rooms from an allotment block into one Booking (ReservationGroup)
 * + N RoomStay rows (variant A: one stay per physical room).
 */
export async function pickupAllotmentBlock(input: {
  allotmentBlockId: string;
  bookingCode: string;
  bookingName?: string;
  guestId: string;
  folioMode?: BookingFolioMode;
  paymentMethod?: PaymentMethod;
  /** Cap how many rooms to pick per line (default = remaining). */
  quantities?: Record<string, number>;
}) {
  const block = await prisma.allotmentBlock.findUnique({
    where: { id: input.allotmentBlockId },
    include: {
      lines: { include: { roomType: true, ratePlan: true } },
      salesContract: true,
    },
  });
  if (!block) throw new Error('Allotment block not found');
  if (block.status === 'CANCELLED' || block.status === 'RELEASED') {
    throw new Error('Block is not open for pickup');
  }

  const pickup = await getAllotmentBlockPickup(block.id);
  if (!pickup) throw new Error('Pickup snapshot failed');

  const remainingByType = new Map(pickup.lines.map((l) => [l.roomTypeId, l.remaining]));
  const defaultRate =
    block.salesContract?.ratePlanId ??
    block.lines.find((l) => l.ratePlanId)?.ratePlanId ??
    null;

  const plan: Array<{ roomTypeId: string; ratePlanId: string; count: number }> = [];
  for (const line of block.lines) {
    const rem = remainingByType.get(line.roomTypeId) ?? 0;
    const want = input.quantities?.[line.roomTypeId] ?? rem;
    const count = Math.min(Math.max(0, want), rem);
    if (count < 1) continue;
    const ratePlanId = line.ratePlanId ?? defaultRate;
    if (!ratePlanId) throw new Error(`No rate plan for room type ${line.roomType.code}`);
    plan.push({ roomTypeId: line.roomTypeId, ratePlanId, count });
  }
  if (plan.length === 0) throw new Error('Nothing left to pick up');

  const totalStays = plan.reduce((s, p) => s + p.count, 0);

  const group = await prisma.reservationGroup.create({
    data: {
      code: input.bookingCode,
      name: input.bookingName,
      agencyId: block.agencyId,
      allotmentBlockId: block.id,
      folioMode: input.folioMode ?? 'MASTER',
      checkInDate: block.validFrom,
      checkOutDate: block.validTo,
    },
  });

  if (block.status === 'TENTATIVE') {
    await prisma.allotmentBlock.update({
      where: { id: block.id },
      data: { status: 'DEFINITE' },
    });
  }

  const paymentMethod = input.paymentMethod ?? 'COMPANY_ACCOUNT';
  const stays = [];
  for (const p of plan) {
    for (let i = 0; i < p.count; i++) {
      const stay = await createReservation({
        roomTypeId: p.roomTypeId,
        guestId: input.guestId,
        ratePlanId: p.ratePlanId,
        agencyId: block.agencyId ?? undefined,
        salesContractId: block.salesContractId ?? undefined,
        groupId: group.id,
        checkInDate: block.validFrom,
        checkOutDate: block.validTo,
        paymentMethod,
        adults: 1,
      });
      stays.push(stay);
    }
  }

  return {
    booking: group,
    stayCount: totalStays,
    stays: stays.map((s) => ({ id: s.id, roomTypeId: s.roomTypeId, status: s.status })),
  };
}
