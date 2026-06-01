import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const from = new URL(req.url).searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
  const nights = Number(new URL(req.url).searchParams.get('nights') ?? '1');
  const plans = await prisma.ratePlan.findMany({ take: 5, orderBy: { code: 'asc' } });
  return NextResponse.json({
    from,
    nights,
    offers: plans.map((p) => ({
      ratePlanCode: p.code,
      name: p.name,
      amountPerNight: Number(p.pricePerNight),
      currency: 'AZN',
    })),
    widget: 'b2c_v2_mvp',
  });
}
