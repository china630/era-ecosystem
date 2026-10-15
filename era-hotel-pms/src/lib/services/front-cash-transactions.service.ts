import { prisma } from '@/lib/prisma';
import { getPendingSummary } from '@/lib/services/settlement-hub.service';

function dayRange(from: Date, to: Date) {
  const toExclusive = new Date(to);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
  return { from, toExclusive };
}

export async function listFrontCashJournal(opts: {
  from: Date;
  to: Date;
  cashShiftId?: string;
}) {
  const { from, toExclusive } = dayRange(opts.from, opts.to);

  const selectedShift = opts.cashShiftId
    ? await prisma.cashShift.findUnique({ where: { id: opts.cashShiftId } })
    : null;

  const paymentWhere =
    selectedShift != null
      ? {
          createdAt: {
            gte: selectedShift.openedAt,
            ...(selectedShift.closedAt ? { lte: selectedShift.closedAt } : {}),
          },
        }
      : { createdAt: { gte: from, lt: toExclusive } };

  const [payments, debtPayments, deposits, openShift, recentShifts, pendingSummary, pendingRows, paidRows, departments] =
    await Promise.all([
    prisma.folioPayment.findMany({
      where: paymentWhere,
      include: {
        folio: {
          select: {
            id: true,
            type: true,
            status: true,
            reservationId: true,
            reservation: {
              select: {
                id: true,
                resNo: true,
                guest: { select: { fullName: true, lastName: true } },
                room: { select: { roomNumber: true } },
                agency: { select: { name: true, code: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.guestDebtPayment.findMany({
      where: paymentWhere,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { entry: { select: { note: true, reservationId: true } } },
    }),
    prisma.folioDeposit.findMany({
      where: {
        OR: [
          { heldAt: { gte: from, lt: toExclusive } },
          { status: 'HELD' },
        ],
      },
      include: {
        reservation: {
          select: {
            id: true,
            guest: { select: { fullName: true } },
            room: { select: { roomNumber: true } },
          },
        },
      },
      orderBy: { heldAt: 'desc' },
      take: 300,
    }),
    prisma.cashShift.findFirst({
      where: { status: 'OPEN' },
      orderBy: [{ isPrimary: 'desc' }, { openedAt: 'desc' }],
    }),
    prisma.cashShift.findMany({
      orderBy: { openedAt: 'desc' },
      take: 30,
    }),
    getPendingSummary(opts.from),
    prisma.settlementPendingCharge.findMany({
      where: { status: 'PENDING', businessDate: opts.from },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
    prisma.settlementPendingCharge.findMany({
      where: { status: 'PAID', paidAt: { gte: from, lt: toExclusive } },
      orderBy: { paidAt: 'desc' },
      take: 300,
    }),
    prisma.department.findMany({ select: { code: true, name: true } }),
  ]);

  const cashierIds = [
    ...new Set(
      [...payments, ...debtPayments]
        .map((p) => p.createdByUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const cashiers = cashierIds.length
    ? await prisma.user.findMany({
        where: { id: { in: cashierIds } },
        select: { id: true, fullName: true },
      })
    : [];
  const cashierNames = new Map(cashiers.map((user) => [user.id, user.fullName]));

  const paymentRows: Array<{
    id: string;
    createdAt: Date;
    amount: unknown;
    paymentMethod: string;
    kind: string;
    refundReason: string | null;
    bankReference: string | null;
    bankTerminalId: string | null;
    cashierName: string | null;
    fiscalReceiptId: string | null;
    folioId: string;
    folioType: string;
    folioStatus: string;
    reservationId: string;
    resNo: string | null;
    guestName: string | null;
    surname: string | null;
    roomNumber: string | null;
    agencyName: string | null;
    departmentCode: string;
    currency: string;
    rate: number;
    note: string | null;
  }> = payments.map((p) => ({
    id: p.id,
    createdAt: p.createdAt,
    amount: p.amount,
    paymentMethod: p.paymentMethod,
    kind: p.kind,
    refundReason: p.refundReason,
    bankReference: p.bankReference,
    bankTerminalId: p.bankTerminalId,
    cashierName: p.createdByUserId ? cashierNames.get(p.createdByUserId) ?? null : null,
    fiscalReceiptId: p.fiscalReceiptId,
    folioId: p.folioId,
    folioType: p.folio.type,
    folioStatus: p.folio.status,
    reservationId: p.folio.reservationId,
    resNo: p.folio.reservation?.resNo ?? null,
    guestName: p.folio.reservation?.guest.fullName ?? null,
    surname: p.folio.reservation?.guest.lastName ?? null,
    roomNumber: p.folio.reservation?.room?.roomNumber ?? null,
    agencyName: p.folio.reservation?.agency?.name ?? p.folio.reservation?.agency?.code ?? null,
    departmentCode: 'RECEPTION',
    currency: 'AZN',
    rate: 1,
    note: p.refundReason || p.bankReference || null,
  }));

  const debtReservationIds = [...new Set(debtPayments.map((row) => row.entry.reservationId))];
  const debtStays = debtReservationIds.length
    ? await prisma.reservation.findMany({
        where: { id: { in: debtReservationIds } },
        select: {
          id: true,
          resNo: true,
          guest: { select: { fullName: true, lastName: true } },
          room: { select: { roomNumber: true } },
          agency: { select: { name: true, code: true } },
        },
      })
    : [];
  const debtStay = new Map(debtStays.map((stay) => [stay.id, stay]));
  for (const row of debtPayments) {
    const stay = debtStay.get(row.entry.reservationId);
    paymentRows.push({
      id: row.id,
      createdAt: row.createdAt,
      amount: row.amount,
      paymentMethod: row.paymentMethod,
      kind: 'PAYMENT',
      refundReason: null,
      bankReference: null,
      bankTerminalId: row.bankTerminalId,
      cashierName: row.createdByUserId ? cashierNames.get(row.createdByUserId) ?? null : null,
      fiscalReceiptId: null,
      folioId: '',
      folioType: 'GUEST',
      folioStatus: 'CLOSED',
      reservationId: row.entry.reservationId,
      resNo: stay?.resNo ?? null,
      guestName: stay?.guest.fullName ?? null,
      surname: stay?.guest.lastName ?? null,
      roomNumber: stay?.room?.roomNumber ?? null,
      agencyName: stay?.agency?.name ?? stay?.agency?.code ?? null,
      departmentCode: 'RECEPTION',
      currency: 'AZN',
      rate: 1,
      note: row.entry.note,
    });
  }

  const departmentName = new Map(departments.map((row) => [row.code, row.name]));
  if (!departmentName.has('RECEPTION')) departmentName.set('RECEPTION', 'RECEPTION');
  for (const row of paidRows) {
    paymentRows.push({
      id: row.id,
      createdAt: row.paidAt ?? row.createdAt,
      amount: row.amount,
      paymentMethod: row.paymentMethod ?? 'OTHER',
      kind: 'PAYMENT',
      refundReason: null,
      bankReference: null,
      bankTerminalId: null,
      cashierName: null,
      fiscalReceiptId: row.fiscalReceiptId,
      folioId: '',
      folioType: row.sourceSystem,
      folioStatus: 'PAID',
      reservationId: row.reservationId ?? '',
      resNo: null,
      guestName: row.payerLabel,
      surname: null,
      roomNumber: null,
      agencyName: null,
      departmentCode: row.sourceSystem,
      currency: row.currency || 'AZN',
      rate: 1,
      note: row.description,
    });
  }
  for (const row of paymentRows) {
    const code = row.departmentCode;
    row.departmentCode = departmentName.get(code) && departmentName.get(code) !== code
      ? `${departmentName.get(code)} (${code})`
      : departmentName.get(code) ?? code;
  }

  const depositRows = deposits.map((d) => ({
    id: d.id,
    heldAt: d.heldAt,
    amount: d.amount,
    paymentMethod: d.paymentMethod,
    status: d.status,
    reservationId: d.reservationId,
    guestName: d.reservation.guest.fullName,
    roomNumber: d.reservation.room?.roomNumber ?? null,
  }));

  const totalsMap = new Map<
    string,
    { method: string; payments: number; refunds: number; depositsHeld: number }
  >();

  const bump = (method: string, field: 'payments' | 'refunds' | 'depositsHeld', amount: number) => {
    const row = totalsMap.get(method) ?? {
      method,
      payments: 0,
      refunds: 0,
      depositsHeld: 0,
    };
    row[field] += amount;
    totalsMap.set(method, row);
  };

  for (const p of payments) {
    const amt = Number(p.amount);
    if (p.kind === 'REFUND') bump(p.paymentMethod, 'refunds', amt);
    else if (p.paymentMethod !== 'GUEST_DEBT') bump(p.paymentMethod, 'payments', amt);
  }
  for (const row of debtPayments) {
    bump(row.paymentMethod, 'payments', Number(row.amount));
  }
  for (const d of deposits) {
    if (d.status === 'HELD') bump(d.paymentMethod, 'depositsHeld', Number(d.amount));
  }

  const totalsByMethod = [...totalsMap.values()]
    .map((r) => ({
      ...r,
      net: r.payments - r.refunds,
    }))
    .sort((a, b) => a.method.localeCompare(b.method));

  const pendingAmount = pendingRows.reduce((s, r) => s + Number(r.amount), 0);

  const zSummary = {
    cashShiftId: selectedShift?.id ?? openShift?.id ?? null,
    cashier: selectedShift?.cashier ?? openShift?.cashier ?? null,
    registerId: selectedShift?.registerId ?? openShift?.registerId ?? null,
    openedAt: selectedShift?.openedAt ?? openShift?.openedAt ?? null,
    closedAt: selectedShift?.closedAt ?? null,
    status: selectedShift?.status ?? openShift?.status ?? null,
    totalsByMethod,
    paymentsNet: totalsByMethod.reduce((s, r) => s + r.net, 0),
    depositsHeld: totalsByMethod.reduce((s, r) => s + r.depositsHeld, 0),
    pendingCount: pendingSummary.pendingCount,
    pendingAmount,
  };

  return {
    payments: paymentRows,
    deposits: depositRows,
    pending: {
      businessDate: pendingSummary.businessDate,
      pendingCount: pendingSummary.pendingCount,
      pendingAmount,
      items: pendingRows.map((r) => ({
        id: r.id,
        sourceSystem: r.sourceSystem,
        amount: r.amount,
        description: r.description,
        payerLabel: r.payerLabel,
        createdAt: r.createdAt,
      })),
    },
    openShift: openShift
      ? {
          id: openShift.id,
          cashier: openShift.cashier,
          registerId: openShift.registerId,
          isPrimary: openShift.isPrimary,
          openedAt: openShift.openedAt,
        }
      : null,
    shifts: recentShifts.map((s) => ({
      id: s.id,
      cashier: s.cashier,
      registerId: s.registerId,
      status: s.status,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      isPrimary: s.isPrimary,
    })),
    zSummary,
    totalsByMethod,
  };
}

/** @deprecated prefer listFrontCashJournal — kept for callers expecting a flat list */
export async function listFrontCashTransactions(opts: { from: Date; to: Date }) {
  const journal = await listFrontCashJournal(opts);
  return journal.payments;
}
