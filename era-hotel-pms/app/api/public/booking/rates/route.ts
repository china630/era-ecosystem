import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { quoteReservationStay } from '@/lib/services/pricing-quote.service';

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const from = params.get('from') ?? new Date().toISOString().slice(0, 10);
  const nights = Number(params.get('nights') ?? '1');
  const checkIn = new Date(from);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + nights);

  const plans = await prisma.ratePlan.findMany({
    where: { active: true, medicalFlag: false },
    take: 8,
    orderBy: { code: 'asc' },
    include: { roomType: true },
  });

  const roomType = await prisma.roomType.findFirst({
    where: { active: true },
    orderBy: { code: 'asc' },
  });

  const offers = [];
  for (const p of plans) {
    const roomTypeId = p.roomTypeId ?? roomType?.id;
    if (!roomTypeId) {
      offers.push({
        ratePlanCode: p.code,
        name: p.name,
        amountPerNight: Number(p.pricePerNight),
        currency: 'AZN',
        source: 'LEGACY',
      });
      continue;
    }
    try {
      const quote = await quoteReservationStay({
        ratePlanId: p.id,
        roomTypeId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
      });
      offers.push({
        ratePlanCode: p.code,
        name: p.name,
        amountPerNight: quote.adultNightly,
        totalAmount: quote.totalAmount,
        currency: quote.currency,
        source: quote.source,
      });
    } catch {
      offers.push({
        ratePlanCode: p.code,
        name: p.name,
        amountPerNight: Number(p.pricePerNight),
        currency: 'AZN',
        source: 'LEGACY',
      });
    }
  }

  return NextResponse.json({
    from,
    nights,
    offers,
    widget: 'b2c_v2_bar',
  });
}
