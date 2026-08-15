import { prisma } from '@/lib/prisma';
import { reportCancellationSummary } from '@/lib/services/reports-analytics.service';

function dayStart(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function dayEndExclusive(iso: string) {
  const d = dayStart(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export type EodReportType =
  | 'cancelled'
  | 'created'
  | 'folio-transactions'
  | 'room-price-control'
  | 'no-shows'
  | 'room-moves'
  | 'vip-in-house';

export async function getEodReport(type: EodReportType, dateIso: string) {
  switch (type) {
    case 'cancelled':
      return reportCancellationSummary(dayStart(dateIso), dayStart(dateIso));
    case 'created':
      return listCreatedReservations(dateIso);
    case 'folio-transactions':
      return listFolioDayTransactions(dateIso);
    case 'room-price-control':
      return listRoomPriceControl(dateIso);
    case 'no-shows':
      return listNoShows(dateIso);
    case 'room-moves':
      return listRoomMoves(dateIso);
    case 'vip-in-house':
      return listVipInHouse(dateIso);
    default:
      throw new Error(`Unknown EOD report type: ${type as string}`);
  }
}

async function listCreatedReservations(dateIso: string) {
  const from = dayStart(dateIso);
  const to = dayEndExclusive(dateIso);
  const rows = await prisma.reservation.findMany({
    where: { createdAt: { gte: from, lt: to } },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { roomNumber: true } },
      roomType: { select: { code: true } },
      source: { select: { code: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return {
    date: dateIso,
    totalCreated: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      resNo: r.resNo,
      status: r.status,
      guestName: r.guest.fullName,
      roomNumber: r.room?.roomNumber ?? null,
      roomTypeCode: r.roomType.code,
      sourceCode: r.source?.code ?? 'DIRECT',
      checkInDate: r.checkInDate.toISOString().slice(0, 10),
      checkOutDate: r.checkOutDate.toISOString().slice(0, 10),
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

async function listFolioDayTransactions(dateIso: string) {
  const from = dayStart(dateIso);
  const to = dayEndExclusive(dateIso);
  const businessDate = from;

  const [charges, payments] = await Promise.all([
    prisma.folioCharge.findMany({
      where: {
        OR: [
          { businessDate },
          { createdAt: { gte: from, lt: to } },
        ],
      },
      include: {
        revenueCode: { select: { code: true } },
        folio: {
          select: {
            type: true,
            reservationId: true,
            reservation: {
              select: {
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
    prisma.folioPayment.findMany({
      where: { createdAt: { gte: from, lt: to } },
      include: {
        folio: {
          select: {
            type: true,
            reservationId: true,
            reservation: {
              select: {
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
  ]);

  const chargeRows = charges.map((c) => ({
    id: c.id,
    entryType: 'CHARGE' as const,
    at: c.createdAt.toISOString(),
    amount: c.amount,
    description: c.description,
    code: c.revenueCode.code,
    kind: null as string | null,
    method: null as string | null,
    folioType: c.folio.type,
    reservationId: c.folio.reservationId,
    guestName: c.folio.reservation?.guest.fullName ?? null,
    roomNumber: c.folio.reservation?.room?.roomNumber ?? null,
  }));

  const paymentRows = payments.map((p) => ({
    id: p.id,
    entryType: 'PAYMENT' as const,
    at: p.createdAt.toISOString(),
    amount: p.amount,
    description: p.kind === 'REFUND' ? `Refund${p.refundReason ? `: ${p.refundReason}` : ''}` : 'Payment',
    code: null as string | null,
    kind: p.kind,
    method: p.paymentMethod,
    folioType: p.folio.type,
    reservationId: p.folio.reservationId,
    guestName: p.folio.reservation?.guest.fullName ?? null,
    roomNumber: p.folio.reservation?.room?.roomNumber ?? null,
  }));

  const items = [...chargeRows, ...paymentRows].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return {
    date: dateIso,
    chargeCount: chargeRows.length,
    paymentCount: paymentRows.length,
    items,
  };
}

async function listRoomPriceControl(dateIso: string) {
  const stayDate = dayStart(dateIso);

  const [manualRes, dailyManual] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        useManualRate: true,
        checkInDate: { lte: stayDate },
        checkOutDate: { gt: stayDate },
        status: { in: ['OPTION', 'CONFIRMED', 'IN_HOUSE'] },
      },
      include: {
        guest: { select: { fullName: true } },
        room: { select: { roomNumber: true } },
        roomType: { select: { code: true } },
        ratePlan: { select: { code: true } },
      },
      take: 300,
    }),
    prisma.reservationDailyRate.findMany({
      where: {
        stayDate,
        OR: [{ manualFlag: true }, { discountPct: { gt: 0 } }],
      },
      include: {
        reservation: {
          include: {
            guest: { select: { fullName: true } },
            room: { select: { roomNumber: true } },
            roomType: { select: { code: true } },
            ratePlan: { select: { code: true } },
          },
        },
      },
      take: 500,
    }),
  ]);

  const byRes = new Map<
    string,
    {
      id: string;
      guestName: string;
      roomNumber: string | null;
      roomTypeCode: string;
      ratePlanCode: string | null;
      useManualRate: boolean;
      manualDailyRate: number | null;
      stayAmount: number | null;
      fixPrice: boolean;
      discountPct: number | null;
      dailyManualFlag: boolean;
    }
  >();

  for (const r of manualRes) {
    byRes.set(r.id, {
      id: r.id,
      guestName: r.guest.fullName,
      roomNumber: r.room?.roomNumber ?? null,
      roomTypeCode: r.roomType.code,
      ratePlanCode: r.ratePlan?.code ?? null,
      useManualRate: true,
      manualDailyRate: r.manualDailyRate != null ? Number(r.manualDailyRate) : null,
      stayAmount: null,
      fixPrice: false,
      discountPct: null,
      dailyManualFlag: false,
    });
  }

  for (const d of dailyManual) {
    const r = d.reservation;
    const existing = byRes.get(r.id);
    byRes.set(r.id, {
      id: r.id,
      guestName: r.guest.fullName,
      roomNumber: r.room?.roomNumber ?? null,
      roomTypeCode: r.roomType.code,
      ratePlanCode: r.ratePlan?.code ?? null,
      useManualRate: existing?.useManualRate || r.useManualRate,
      manualDailyRate:
        existing?.manualDailyRate ??
        (r.manualDailyRate != null ? Number(r.manualDailyRate) : null),
      stayAmount: Number(d.amount),
      fixPrice: d.fixPrice,
      discountPct: d.discountPct != null ? Number(d.discountPct) : null,
      dailyManualFlag: d.manualFlag,
    });
  }

  const items = [...byRes.values()].sort((a, b) =>
    (a.roomNumber ?? '').localeCompare(b.roomNumber ?? ''),
  );

  return {
    date: dateIso,
    totalFlagged: items.length,
    items,
  };
}

async function listNoShows(dateIso: string) {
  const from = dayStart(dateIso);
  const to = dayEndExclusive(dateIso);
  const rows = await prisma.reservation.findMany({
    where: {
      status: 'NO_SHOW',
      OR: [
        { checkInDate: { gte: from, lt: to } },
        { updatedAt: { gte: from, lt: to } },
      ],
    },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { roomNumber: true } },
      roomType: { select: { code: true } },
    },
    orderBy: { checkInDate: 'asc' },
    take: 500,
  });
  return {
    date: dateIso,
    total: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      resNo: r.resNo,
      guestName: r.guest.fullName,
      roomNumber: r.room?.roomNumber ?? null,
      roomTypeCode: r.roomType.code,
      checkInDate: r.checkInDate.toISOString().slice(0, 10),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

async function listRoomMoves(dateIso: string) {
  const from = dayStart(dateIso);
  const to = dayEndExclusive(dateIso);
  const rows = await prisma.roomChangePlan.findMany({
    where: {
      OR: [
        { effectiveAt: { gte: from, lt: to } },
        { createdAt: { gte: from, lt: to } },
      ],
    },
    include: {
      reservation: {
        include: { guest: { select: { fullName: true } } },
      },
      fromRoom: { select: { roomNumber: true } },
      toRoom: { select: { roomNumber: true } },
    },
    orderBy: { effectiveAt: 'asc' },
    take: 500,
  });
  return {
    date: dateIso,
    total: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      reservationId: r.reservationId,
      guestName: r.reservation.guest.fullName,
      fromRoom: r.fromRoom?.roomNumber ?? null,
      toRoom: r.toRoom?.roomNumber ?? null,
      plannedDate: r.effectiveAt.toISOString().slice(0, 10),
      status: r.status,
      reason: r.notes,
    })),
  };
}

async function listVipInHouse(dateIso: string) {
  const day = dayStart(dateIso);
  const next = dayEndExclusive(dateIso);
  const rows = await prisma.reservation.findMany({
    where: {
      status: 'IN_HOUSE',
      checkInDate: { lt: next },
      checkOutDate: { gt: day },
      vipType: { not: null },
    },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { roomNumber: true } },
      roomType: { select: { code: true } },
    },
    orderBy: { vipType: 'asc' },
    take: 500,
  });
  const items = rows
    .filter((r) => Boolean(r.vipType && String(r.vipType).trim()))
    .map((r) => ({
      id: r.id,
      resNo: r.resNo,
      guestName: r.guest.fullName,
      roomNumber: r.room?.roomNumber ?? null,
      roomTypeCode: r.roomType.code,
      vipType: r.vipType,
      checkOutDate: r.checkOutDate.toISOString().slice(0, 10),
    }));
  return { date: dateIso, total: items.length, items };
}
