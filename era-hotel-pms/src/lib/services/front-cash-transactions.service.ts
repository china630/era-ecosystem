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

  const [payments, deposits, openShift, recentShifts, pendingSummary, pendingRows] =
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
                guest: { select: { fullName: true } },
                room: { select: { roomNumber: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
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
  ]);

  const paymentRows = payments.map((p) => ({
    id: p.id,
    createdAt: p.createdAt,
    amount: p.amount,
    paymentMethod: p.paymentMethod,
    kind: p.kind,
    refundReason: p.refundReason,
    bankReference: p.bankReference,
    fiscalReceiptId: p.fiscalReceiptId,
    folioId: p.folioId,
    folioType: p.folio.type,
    folioStatus: p.folio.status,
    reservationId: p.folio.reservationId,
    guestName: p.folio.reservation?.guest.fullName ?? null,
    roomNumber: p.folio.reservation?.room?.roomNumber ?? null,
  }));

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
    else bump(p.paymentMethod, 'payments', amt);
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
