import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';

export const CASH_POINT_ORDER = ['HOTEL', 'FNB_POS', 'CLINIC', 'RETAIL'] as const;
export type CashPointCode = (typeof CASH_POINT_ORDER)[number];

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
  const day = bakuCivilUtcDate(businessDate);

  const [payments, deposits, pending, debtPayments, closes, departments, terminals, users] = await Promise.all([
    prisma.folioPayment.findMany({
      where: { businessDate: day, voidedAt: null },
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
      where: { businessDate: day },
      select: { amount: true, paymentMethod: true, heldAt: true },
    }),
    prisma.settlementPendingCharge.findMany({
      where: { status: 'PAID', businessDate: day },
      select: { amount: true, paymentMethod: true, sourceSystem: true, paidAt: true },
    }),
    prisma.guestDebtPayment.findMany({
      where: { businessDate: day },
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
      select: { code: true, name: true, cashPoint: true },
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
  const departmentName = new Map<string, string>();
  for (const row of departments) {
    if (row.cashPoint) departmentName.set(row.cashPoint, row.name);
  }
  const tenderName = new Map<string, string>();
  for (const terminal of terminals) {
    tenderName.set(terminalTender(terminal.id), terminal.label || terminal.id);
  }

  const map = new Map<string, Bucket>();

  function tenderOf(method: string, bankTerminalId?: string | null) {
    if (method === 'CARD' && bankTerminalId) {
      const key = terminalTender(bankTerminalId);
      if (!tenderName.has(key)) tenderName.set(key, tenderName.get(key) ?? bankTerminalId);
      return key;
    }
    if (!tenderName.has(method)) tenderName.set(method, method);
    return method;
  }

  for (const payment of payments) {
    const tender = tenderOf(payment.paymentMethod, payment.bankTerminalId);
    const bucket = bump(map, 'HOTEL', tender);
    const amount = Number(payment.amount);
    if (payment.kind === 'REFUND') bucket.moneyGiven += amount;
    else if (payment.paymentMethod !== 'GUEST_DEBT') bucket.folioTaken += amount;
    touch(bucket, payment.createdAt, payment.createdByUserId ? userName.get(payment.createdByUserId) : null);
  }
  for (const payment of debtPayments) {
    const tender = tenderOf(payment.paymentMethod, payment.bankTerminalId);
    const bucket = bump(map, 'HOTEL', tender);
    bucket.moneyTaken += Number(payment.amount);
    touch(bucket, payment.createdAt, payment.createdByUserId ? userName.get(payment.createdByUserId) : null);
  }
  for (const deposit of deposits) {
    const tender = tenderOf(deposit.paymentMethod);
    const bucket = bump(map, 'HOTEL', tender);
    bucket.moneyTaken += Number(deposit.amount);
    touch(bucket, deposit.heldAt);
  }
  for (const row of pending) {
    const point = row.sourceSystem;
    if (!departmentName.has(point)) departmentName.set(point, point);
    const tender = tenderOf(row.paymentMethod ?? 'OTHER');
    const bucket = bump(map, point, tender);
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
    .filter((row) => row.folioTaken !== 0 || row.moneyTaken !== 0 || row.moneyGiven !== 0)
    .sort((a, b) => {
      const ai = CASH_POINT_ORDER.indexOf(a.payingDepartment as CashPointCode);
      const bi = CASH_POINT_ORDER.indexOf(b.payingDepartment as CashPointCode);
      const ao = ai === -1 ? 99 : ai;
      const bo = bi === -1 ? 99 : bi;
      return ao - bo || a.tenderName.localeCompare(b.tenderName);
    });

  return { date: businessDate, rows };
}

export async function closeCashDeskRow(input: {
  businessDate: string;
  payingDepartment: string;
  tender: string;
}) {
  const orgId = requestOrganizationId();
  const day = bakuCivilUtcDate(input.businessDate);
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

export type CashJournalLine = {
  id: string;
  at: string;
  employee: string;
  guestName: string | null;
  roomNumber: string | null;
  reservationId: string | null;
  description: string;
  amount: number;
  kind: string;
  tender: string;
  cashPoint: string;
};

function journalPartyName(folio: {
  type: string;
  reservationGuest: { guest: { fullName: string } | null } | null;
  reservation: {
    guest: { fullName: string };
    agency: { name: string } | null;
    company: { name: string } | null;
  };
}) {
  if (folio.type === 'AGENCY') return folio.reservation.agency?.name ?? folio.reservation.guest.fullName;
  if (folio.type === 'COMPANY') return folio.reservation.company?.name ?? folio.reservation.guest.fullName;
  return folio.reservationGuest?.guest?.fullName ?? folio.reservation.guest.fullName;
}

export async function listCashJournal(input: {
  businessDate: string;
  cashPoint?: string | null;
  tender?: string | null;
}): Promise<CashJournalLine[]> {
  const day = bakuCivilUtcDate(input.businessDate);
  const [payments, debts, deposits, pending, users] = await Promise.all([
    prisma.folioPayment.findMany({
      where: { businessDate: day, voidedAt: null },
      select: {
        id: true,
        amount: true,
        kind: true,
        paymentMethod: true,
        bankTerminalId: true,
        createdAt: true,
        createdByUserId: true,
        folio: {
          select: {
            type: true,
            reservationId: true,
            reservationGuest: { select: { guest: { select: { fullName: true } } } },
            reservation: {
              select: {
                guest: { select: { fullName: true } },
                room: { select: { roomNumber: true } },
                agency: { select: { name: true } },
                company: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.guestDebtPayment.findMany({
      where: { businessDate: day },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        bankTerminalId: true,
        createdAt: true,
        createdByUserId: true,
        entry: { select: { note: true, reservationId: true } },
      },
    }),
    prisma.folioDeposit.findMany({
      where: { businessDate: day },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        heldAt: true,
        reservationId: true,
        reservation: {
          select: {
            guest: { select: { fullName: true } },
            room: { select: { roomNumber: true } },
          },
        },
      },
    }),
    prisma.settlementPendingCharge.findMany({
      where: { status: 'PAID', businessDate: day },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        sourceSystem: true,
        description: true,
        payerLabel: true,
        paidAt: true,
        reservationId: true,
      },
    }),
    prisma.user.findMany({ select: { id: true, fullName: true } }),
  ]);
  const userName = new Map(users.map((user) => [user.id, user.fullName]));
  const debtReservationIds = [...new Set(debts.map((row) => row.entry.reservationId))];
  const debtReservations = debtReservationIds.length
    ? await prisma.reservation.findMany({
        where: { id: { in: debtReservationIds } },
        select: {
          id: true,
          guest: { select: { fullName: true } },
          room: { select: { roomNumber: true } },
        },
      })
    : [];
  const debtStay = new Map(debtReservations.map((row) => [row.id, row]));
  const lines: CashJournalLine[] = [];
  for (const payment of payments) {
    const tender =
      payment.paymentMethod === 'CARD' && payment.bankTerminalId
        ? terminalTender(payment.bankTerminalId)
        : payment.paymentMethod;
    const amount = Number(payment.amount);
    lines.push({
      id: payment.id,
      at: payment.createdAt.toISOString(),
      employee: payment.createdByUserId ? userName.get(payment.createdByUserId) ?? '—' : '—',
      guestName: journalPartyName(payment.folio),
      roomNumber: payment.folio.reservation.room?.roomNumber ?? null,
      reservationId: payment.folio.reservationId,
      description: payment.paymentMethod,
      amount: payment.kind === 'REFUND' ? -amount : amount,
      kind: payment.kind,
      tender,
      cashPoint: 'HOTEL',
    });
  }
  for (const payment of debts) {
    const tender =
      payment.paymentMethod === 'CARD' && payment.bankTerminalId
        ? terminalTender(payment.bankTerminalId)
        : payment.paymentMethod;
    lines.push({
      id: payment.id,
      at: payment.createdAt.toISOString(),
      employee: payment.createdByUserId ? userName.get(payment.createdByUserId) ?? '—' : '—',
      guestName: debtStay.get(payment.entry.reservationId)?.guest.fullName ?? null,
      roomNumber: debtStay.get(payment.entry.reservationId)?.room?.roomNumber ?? null,
      reservationId: payment.entry.reservationId,
      description: payment.entry.note,
      amount: Number(payment.amount),
      kind: 'DEBT',
      tender,
      cashPoint: 'HOTEL',
    });
  }
  for (const deposit of deposits) {
    lines.push({
      id: deposit.id,
      at: deposit.heldAt.toISOString(),
      employee: '—',
      guestName: deposit.reservation.guest.fullName,
      roomNumber: deposit.reservation.room?.roomNumber ?? null,
      reservationId: deposit.reservationId,
      description: deposit.paymentMethod,
      amount: Number(deposit.amount),
      kind: 'DEPOSIT',
      tender: deposit.paymentMethod,
      cashPoint: 'HOTEL',
    });
  }
  for (const row of pending) {
    lines.push({
      id: row.id,
      at: (row.paidAt ?? day).toISOString(),
      employee: '—',
      guestName: row.payerLabel,
      roomNumber: null,
      reservationId: row.reservationId,
      description: row.description,
      amount: Number(row.amount),
      kind: 'PENDING',
      tender: row.paymentMethod ?? 'OTHER',
      cashPoint: row.sourceSystem,
    });
  }
  return lines
    .filter((line) => !input.cashPoint || line.cashPoint === input.cashPoint)
    .filter((line) => !input.tender || line.tender === input.tender)
    .sort((a, b) => a.employee.localeCompare(b.employee) || a.at.localeCompare(b.at));
}
