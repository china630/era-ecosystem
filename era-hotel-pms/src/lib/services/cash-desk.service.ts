import { bakuDayBounds } from '@era/satellite-kit/time';
import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
export type CashDeskRow = {
  payingDepartment: string;
  tender: string;
  userLabel: string;
  currency: string;
  moneyTaken: number;
  folioTaken: number;
  exchangeToken: number;
  folioGiven: number;
  exchangeGiven: number;
  moneyGiven: number;
  balance: number;
  closedAt: string | null;
  lastActivityAt: string | null;
};

type Bucket = {
  payingDepartment: string;
  tender: string;
  moneyTaken: number;
  folioTaken: number;
  moneyGiven: number;
  lastActivityAt: Date | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function bump(map: Map<string, Bucket>, department: string, tender: string): Bucket {
  const key = `${department}\u0000${tender}`;
  const existing = map.get(key);
  if (existing) return existing;
  const created: Bucket = {
    payingDepartment: department,
    tender,
    moneyTaken: 0,
    folioTaken: 0,
    moneyGiven: 0,
    lastActivityAt: null,
  };
  map.set(key, created);
  return created;
}

function touch(bucket: Bucket, at: Date) {
  if (!bucket.lastActivityAt || at > bucket.lastActivityAt) bucket.lastActivityAt = at;
}

export async function listCashDesk(businessDate: string): Promise<{ date: string; rows: CashDeskRow[] }> {
  const orgId = requestOrganizationId();
  const { start, end } = bakuDayBounds(businessDate);
  const day = new Date(`${businessDate}T00:00:00.000Z`);
  const map = new Map<string, Bucket>();

  const [payments, deposits, pending, closes] = await Promise.all([
    prisma.folioPayment.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { amount: true, paymentMethod: true, kind: true, createdAt: true },
    }),
    prisma.folioDeposit.findMany({
      where: { heldAt: { gte: start, lt: end } },
      select: { amount: true, paymentMethod: true, heldAt: true },
    }),
    prisma.settlementPendingCharge.findMany({
      where: { status: 'PAID', paidAt: { gte: start, lt: end } },
      select: { amount: true, paymentMethod: true, sourceSystem: true, paidAt: true },
    }),
    prisma.cashDeskClose.findMany({
      where: { organizationId: orgId, businessDate: day },
    }),
  ]);

  for (const payment of payments) {
    const bucket = bump(map, 'RECEPTION', payment.paymentMethod);
    const amount = Number(payment.amount);
    if (payment.kind === 'REFUND') bucket.moneyGiven += amount;
    else bucket.folioTaken += amount;
    touch(bucket, payment.createdAt);
  }
  for (const deposit of deposits) {
    const bucket = bump(map, 'RECEPTION', deposit.paymentMethod);
    bucket.moneyTaken += Number(deposit.amount);
    touch(bucket, deposit.heldAt);
  }
  for (const row of pending) {
    const bucket = bump(map, row.sourceSystem, row.paymentMethod ?? 'OTHER');
    bucket.folioTaken += Number(row.amount);
    if (row.paidAt) touch(bucket, row.paidAt);
  }

  const closeByKey = new Map(
    closes.map((row) => [`${row.payingDepartment}\u0000${row.tender}`, row.closedAt] as const),
  );

  const rows = [...map.values()]
    .map((bucket) => {
      const closedAt = closeByKey.get(`${bucket.payingDepartment}\u0000${bucket.tender}`) ?? null;
      const stillOpen = !closedAt || (bucket.lastActivityAt != null && bucket.lastActivityAt > closedAt);
      return {
        payingDepartment: bucket.payingDepartment,
        tender: bucket.tender,
        userLabel: '—',
        currency: 'AZN',
        moneyTaken: round2(bucket.moneyTaken),
        folioTaken: round2(bucket.folioTaken),
        exchangeToken: 0,
        folioGiven: 0,
        exchangeGiven: 0,
        moneyGiven: round2(bucket.moneyGiven),
        balance: round2(bucket.folioTaken + bucket.moneyTaken - bucket.moneyGiven),
        closedAt: stillOpen || !closedAt ? null : closedAt.toISOString(),
        lastActivityAt: bucket.lastActivityAt?.toISOString() ?? null,
      };
    })
    .sort((a, b) =>
      a.payingDepartment === b.payingDepartment
        ? a.tender.localeCompare(b.tender)
        : a.payingDepartment.localeCompare(b.payingDepartment),
    );

  return { date: businessDate, rows };
}

export async function closeCashDeskRow(input: {
  businessDate: string;
  payingDepartment: string;
  tender: string;
}) {
  const orgId = requestOrganizationId();
  const day = new Date(`${input.businessDate}T00:00:00.000Z`);
  return prisma.cashDeskClose.upsert({
    where: {
      organizationId_businessDate_payingDepartment_tender: {
        organizationId: orgId,
        businessDate: day,
        payingDepartment: input.payingDepartment,
        tender: input.tender,
      },
    },
    create: {
      organizationId: orgId,
      businessDate: day,
      payingDepartment: input.payingDepartment,
      tender: input.tender,
      closedAt: new Date(),
    },
    update: { closedAt: new Date() },
  });
}

export async function countUnclosedCashDesk(businessDate: string): Promise<number> {
  const { rows } = await listCashDesk(businessDate);
  return rows.filter((row) => row.closedAt == null).length;
}
