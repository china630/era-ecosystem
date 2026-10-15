import { bakuDayBounds } from '@era/satellite-kit/time';
import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';

export type CashDeskRow = {
  payingDepartment: string;
  payingDepartmentName: string;
  tender: string;
  tenderName: string;
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
  userLabel: string;
};

const BASE_TENDERS = ['CASH', 'CARD', 'DEPOSIT', 'BANK_TRANSFER', 'EPOINT', 'COMPANY_ACCOUNT'] as const;

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
    userLabel: '—',
  };
  map.set(key, created);
  return created;
}

function touch(bucket: Bucket, at: Date, userLabel?: string | null) {
  if (!bucket.lastActivityAt || at > bucket.lastActivityAt) {
    bucket.lastActivityAt = at;
    if (userLabel) bucket.userLabel = userLabel;
  }
}

function terminalTender(id: string) {
  return `terminal:${id}`;
}

export async function listCashDesk(businessDate: string): Promise<{ date: string; rows: CashDeskRow[] }> {
  const orgId = requestOrganizationId();
  const { start, end } = bakuDayBounds(businessDate);
  const day = new Date(`${businessDate}T00:00:00.000Z`);

  const [payments, deposits, pending, debtPayments, closes, departments, terminals, users] = await Promise.all([
    prisma.folioPayment.findMany({
      where: { createdAt: { gte: start, lt: end }, voidedAt: null },
      select: {
        amount: true,
        paymentMethod: true,
        kind: true,
        createdAt: true,
        bankTerminalId: true,
        createdByUserId: true,
      },
    }),
    prisma.folioDeposit.findMany({
      where: { heldAt: { gte: start, lt: end } },
      select: { amount: true, paymentMethod: true, heldAt: true },
    }),
    prisma.settlementPendingCharge.findMany({
      where: { status: 'PAID', paidAt: { gte: start, lt: end } },
      select: { amount: true, paymentMethod: true, sourceSystem: true, paidAt: true },
    }),
    prisma.guestDebtPayment.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: {
        amount: true,
        paymentMethod: true,
        createdAt: true,
        bankTerminalId: true,
        createdByUserId: true,
      },
    }),
    prisma.cashDeskClose.findMany({
      where: { organizationId: orgId, businessDate: day },
    }),
    prisma.department.findMany({
      where: { organizationId: orgId },
      select: { code: true, name: true },
      orderBy: { code: 'asc' },
    }),
    prisma.fiscalDeviceMirror.findMany({
      where: { organizationId: orgId, kind: 'BANK_POS' },
      select: { id: true, label: true },
      orderBy: { label: 'asc' },
    }),
    prisma.user.findMany({ select: { id: true, fullName: true } }),
  ]);

  const userName = new Map(users.map((user) => [user.id, user.fullName]));
  const catalogName = new Map(departments.map((row) => [row.code, row.name]));
  const payingPoints = new Set<string>(['RECEPTION']);
  for (const code of ['FNB_POS', 'CLINIC', 'RETAIL'] as const) {
    if (catalogName.has(code)) payingPoints.add(code);
  }
  const departmentName = new Map<string, string>();
  for (const code of payingPoints) {
    departmentName.set(code, catalogName.get(code) ?? code);
  }
  const tenderName = new Map<string, string>(BASE_TENDERS.map((code) => [code, code]));
  for (const terminal of terminals) {
    tenderName.set(terminalTender(terminal.id), terminal.label || terminal.id);
  }

  const map = new Map<string, Bucket>();
  const tenderCodes = [...tenderName.keys()];
  for (const department of payingPoints) {
    for (const tender of tenderCodes) bump(map, department, tender);
  }

  function tenderOf(method: string, bankTerminalId?: string | null) {
    if (method === 'CARD' && bankTerminalId && tenderName.has(terminalTender(bankTerminalId))) {
      return terminalTender(bankTerminalId);
    }
    if (!tenderName.has(method)) tenderName.set(method, method);
    return method;
  }

  for (const payment of payments) {
    const tender = tenderOf(payment.paymentMethod, payment.bankTerminalId);
    const bucket = bump(map, 'RECEPTION', tender);
    const amount = Number(payment.amount);
    if (payment.kind === 'REFUND') bucket.moneyGiven += amount;
    else if (payment.paymentMethod !== 'GUEST_DEBT') bucket.folioTaken += amount;
    touch(bucket, payment.createdAt, payment.createdByUserId ? userName.get(payment.createdByUserId) : null);
  }
  for (const payment of debtPayments) {
    const tender = tenderOf(payment.paymentMethod, payment.bankTerminalId);
    const bucket = bump(map, 'RECEPTION', tender);
    bucket.moneyTaken += Number(payment.amount);
    touch(bucket, payment.createdAt, payment.createdByUserId ? userName.get(payment.createdByUserId) : null);
  }
  for (const deposit of deposits) {
    const tender = tenderOf(deposit.paymentMethod);
    const bucket = bump(map, 'RECEPTION', tender);
    bucket.moneyTaken += Number(deposit.amount);
    touch(bucket, deposit.heldAt);
  }
  for (const row of pending) {
    if (!departmentName.has(row.sourceSystem)) {
      departmentName.set(row.sourceSystem, catalogName.get(row.sourceSystem) ?? row.sourceSystem);
    }
    const tender = tenderOf(row.paymentMethod ?? 'OTHER');
    for (const code of tenderCodes) bump(map, row.sourceSystem, code);
    const bucket = bump(map, row.sourceSystem, tender);
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
        payingDepartmentName: departmentName.get(bucket.payingDepartment) ?? bucket.payingDepartment,
        tender: bucket.tender,
        tenderName: tenderName.get(bucket.tender) ?? bucket.tender,
        userLabel: bucket.userLabel,
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
        ? a.tenderName.localeCompare(b.tenderName)
        : a.payingDepartmentName.localeCompare(b.payingDepartmentName),
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
  return rows.filter((row) => row.balance !== 0 && row.closedAt == null).length;
}
