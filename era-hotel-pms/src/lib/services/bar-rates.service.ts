import { prisma } from '@/lib/prisma';
import { toDecimal, decimalToNumber } from '@/lib/decimal';

export async function listBarRates(input: {
  ratePlanId?: string;
  roomTypeId?: string;
  from?: Date;
  to?: Date;
}) {
  const barPlan =
    input.ratePlanId ??
    (
      await prisma.ratePlan.findFirst({
        where: { type: 'BASE', code: 'BAR', active: true },
        select: { id: true },
      })
    )?.id;

  if (!barPlan) {
    return { ratePlanId: null, rates: [] as Array<Record<string, unknown>> };
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
    ratePlanId: barPlan,
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
        },
        update: { amount, currencyCode: currency },
      }),
    ),
  );

  return { upserted: nights.length };
}

export async function patchBarRate(id: string, amount: number) {
  return prisma.roomTypeRate.update({
    where: { id },
    data: {
      amount: toDecimal(amount),
      source: "MANUAL",
      lockedAt: new Date(),
    },
  });
}
