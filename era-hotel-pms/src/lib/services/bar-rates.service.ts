import { prisma } from '@/lib/prisma';
import { toDecimal, decimalToNumber } from '@/lib/decimal';

/** BASE plans that are hotel BAR tariffs (BAR, BAR-BB, BAR-FB, …). */
export async function listBarBasePlans() {
  const plans = await prisma.ratePlan.findMany({
    where: {
      type: 'BASE',
      active: true,
      OR: [{ code: 'BAR' }, { code: { startsWith: 'BAR-' } }],
    },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });
  return plans;
}

async function resolveBarPlanId(ratePlanId?: string): Promise<string | null> {
  if (ratePlanId) {
    const found = await prisma.ratePlan.findFirst({
      where: {
        id: ratePlanId,
        type: 'BASE',
        active: true,
        OR: [{ code: 'BAR' }, { code: { startsWith: 'BAR-' } }],
      },
      select: { id: true },
    });
    return found?.id ?? null;
  }
  const plans = await listBarBasePlans();
  // Prefer BB, then FB, then plain BAR, then first
  const preferred =
    plans.find((p) => p.code === 'BAR-BB') ??
    plans.find((p) => p.code === 'BAR-FB') ??
    plans.find((p) => p.code === 'BAR') ??
    plans[0];
  return preferred?.id ?? null;
}

export async function listBarRates(input: {
  ratePlanId?: string;
  roomTypeId?: string;
  from?: Date;
  to?: Date;
}) {
  const plans = await listBarBasePlans();
  const barPlan = await resolveBarPlanId(input.ratePlanId);

  const roomTypes = await prisma.roomType.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

  if (!barPlan) {
    return {
      plans,
      ratePlanId: null as string | null,
      roomTypes,
      rates: [] as Array<Record<string, unknown>>,
    };
  }

  const where: {
    ratePlanId: string;
    roomTypeId?: string;
    date?: { gte?: Date; lte?: Date };
  } = { ratePlanId: barPlan };
  if (input.roomTypeId) where.roomTypeId = input.roomTypeId;
  if (input.from || input.to) {
    where.date = {};
    if (input.from) where.date.gte = input.from;
    if (input.to) where.date.lte = input.to;
  }

  const rates = await prisma.roomTypeRate.findMany({
    where,
    include: { roomType: { select: { code: true, name: true } } },
    orderBy: [{ date: 'asc' }, { roomTypeId: 'asc' }],
  });

  return {
    plans,
    ratePlanId: barPlan,
    roomTypes,
    rates: rates.map((r) => ({
      id: r.id,
      roomTypeId: r.roomTypeId,
      roomTypeCode: r.roomType.code,
      roomTypeName: r.roomType.name,
      date: r.date.toISOString().slice(0, 10),
      amount: decimalToNumber(r.amount),
      currencyCode: r.currencyCode,
    })),
  };
}

export async function bulkUpsertBarRates(input: {
  ratePlanId: string;
  roomTypeId: string;
  from: Date;
  to: Date;
  amount: number;
  currencyCode?: string;
}) {
  const planOk = await resolveBarPlanId(input.ratePlanId);
  if (!planOk) throw new Error('BAR rate plan not found');

  const nights: Date[] = [];
  const cur = new Date(input.from.toISOString().slice(0, 10));
  const end = new Date(input.to.toISOString().slice(0, 10));
  while (cur <= end) {
    nights.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const currency = input.currencyCode ?? 'AZN';
  const amount = toDecimal(input.amount);

  await prisma.$transaction(
    nights.map((date) =>
      prisma.roomTypeRate.upsert({
        where: {
          ratePlanId_roomTypeId_date: {
            ratePlanId: input.ratePlanId,
            roomTypeId: input.roomTypeId,
            date,
          },
        },
        create: {
          ratePlanId: input.ratePlanId,
          roomTypeId: input.roomTypeId,
          date,
          amount,
          currencyCode: currency,
          source: 'MANUAL',
        },
        update: { amount, currencyCode: currency, source: 'MANUAL' },
      }),
    ),
  );

  return { upserted: nights.length };
}

export async function upsertBarRateCell(input: {
  ratePlanId: string;
  roomTypeId: string;
  date: Date;
  amount: number;
}) {
  const planOk = await resolveBarPlanId(input.ratePlanId);
  if (!planOk) throw new Error('BAR rate plan not found');
  const amount = toDecimal(input.amount);
  const date = new Date(input.date.toISOString().slice(0, 10));
  return prisma.roomTypeRate.upsert({
    where: {
      ratePlanId_roomTypeId_date: {
        ratePlanId: input.ratePlanId,
        roomTypeId: input.roomTypeId,
        date,
      },
    },
    create: {
      ratePlanId: input.ratePlanId,
      roomTypeId: input.roomTypeId,
      date,
      amount,
      currencyCode: 'AZN',
      source: 'MANUAL',
    },
    update: { amount, source: 'MANUAL' },
  });
}

export async function patchBarRate(id: string, amount: number) {
  const existing = await prisma.roomTypeRate.findUnique({ where: { id } });
  if (!existing) throw new Error('BAR rate not found');
  return prisma.roomTypeRate.update({
    where: { id },
    data: { amount: toDecimal(amount), source: 'MANUAL' },
  });
}
