import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';

function dateRange(from: Date, to: Date) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function reportBookingSourceRevenue(from: Date, to: Date) {
  const { start, end } = dateRange(from, to);

  const reservations = await prisma.reservation.findMany({
    where: {
      checkInDate: { lte: end },
      checkOutDate: { gte: start },
      status: { notIn: ['CANCELLED'] },
    },
    include: {
      source: true,
      folios: { include: { charges: true } },
    },
  });

  const bySource = new Map<
    string,
    { sourceId: string | null; code: string; name: string; revenue: number; reservations: number; roomNights: number }
  >();

  for (const res of reservations) {
    const key = res.sourceId ?? '__none__';
    const code = res.source?.code ?? 'DIRECT';
    const name = res.source?.name ?? 'Direct / unknown';
    const row = bySource.get(key) ?? {
      sourceId: res.sourceId,
      code,
      name,
      revenue: 0,
      reservations: 0,
      roomNights: 0,
    };

    row.reservations += 1;
    const nights = Math.max(
      1,
      Math.ceil(
        (Math.min(res.checkOutDate.getTime(), end.getTime()) -
          Math.max(res.checkInDate.getTime(), start.getTime())) /
          86400000,
      ),
    );
    row.roomNights += nights;

    const folioRevenue = res.folios.reduce(
      (sum, folio) =>
        sum + folio.charges.reduce((s, c) => s + decimalToNumber(c.amount), 0),
      0,
    );
    row.revenue += folioRevenue > 0 ? folioRevenue : decimalToNumber(res.totalAmount);
    bySource.set(key, row);
  }

  const rows = [...bySource.values()].sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    totalRevenue,
    rows: rows.map((r) => ({
      ...r,
      sharePct: totalRevenue > 0 ? Math.round((r.revenue / totalRevenue) * 1000) / 10 : 0,
    })),
  };
}

export async function reportCancellationSummary(from: Date, to: Date) {
  const { start, end } = dateRange(from, to);

  const cancelled = await prisma.reservation.findMany({
    where: {
      status: 'CANCELLED',
      updatedAt: { gte: start, lte: end },
    },
    include: {
      source: true,
      notes: true,
      guest: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const bySource = new Map<string, { code: string; count: number }>();
  for (const res of cancelled) {
    const code = res.source?.code ?? 'DIRECT';
    const row = bySource.get(code) ?? { code, count: 0 };
    row.count += 1;
    bySource.set(code, row);
  }

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    totalCancelled: cancelled.length,
    bySource: [...bySource.values()].sort((a, b) => b.count - a.count),
    items: cancelled.map((r) => ({
      id: r.id,
      resNo: r.resNo,
      guestName: r.guest.fullName,
      sourceCode: r.source?.code ?? 'DIRECT',
      checkInDate: r.checkInDate.toISOString().slice(0, 10),
      checkOutDate: r.checkOutDate.toISOString().slice(0, 10),
      cancelNote:
        r.notes.find((n) => n.noteType === 'CANCEL_NOTE')?.text ??
        r.notes.find((n) => n.noteType === 'GENERAL_NOTE')?.text ??
        null,
      cancelledAt: r.updatedAt.toISOString(),
    })),
  };
}

export async function reportGuestDemographics(from: Date, to: Date) {
  const { start, end } = dateRange(from, to);

  const reservations = await prisma.reservation.findMany({
    where: {
      checkInDate: { lte: end },
      checkOutDate: { gte: start },
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
    },
    include: { guest: true },
  });

  const nationality = new Map<string, number>();
  let childBand0_6 = 0;
  let childBand7_11 = 0;
  let adults = 0;

  for (const res of reservations) {
    const nat = res.guest.nationality?.trim() || 'UNKNOWN';
    nationality.set(nat, (nationality.get(nat) ?? 0) + 1);
    childBand0_6 += res.children1_0 + res.children5_2;
    childBand7_11 += res.children11_6;
    adults += res.adults;
  }

  const totalGuests = reservations.length;

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    reservationCount: totalGuests,
    adults,
    childBand0_6,
    childBand7_11,
    nationality: [...nationality.entries()]
      .map(([code, count]) => ({
        code,
        count,
        sharePct: totalGuests > 0 ? Math.round((count / totalGuests) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count),
  };
}
