import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';

function dateRange(from: Date, to: Date) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export type AgencyProfitRow = {
  bucket: 'agency' | 'direct';
  agencyId: string | null;
  agencyCode: string | null;
  agencyName: string;
  sourceCode: string | null;
  sourceName: string | null;
  revenue: number;
  roomNights: number;
  adr: number;
  reservations: number;
  cancelled: number;
  cancellationRatePct: number;
  cityLedgerNet: number;
};

export async function reportAgencyProfitability(from: Date, to: Date) {
  const { start, end } = dateRange(from, to);

  const allInRange = await prisma.reservation.findMany({
    where: {
      checkInDate: { lte: end },
      checkOutDate: { gte: start },
    },
    include: {
      agency: true,
      source: true,
      folios: {
        include: {
          charges: true,
          payments: true,
        },
      },
    },
  });

  const map = new Map<string, AgencyProfitRow>();

  for (const res of allInRange) {
    const bucket = res.agencyId ? 'agency' : 'direct';
    const key = res.agencyId ?? `direct:${res.sourceId ?? 'none'}`;
    const row = map.get(key) ?? {
      bucket,
      agencyId: res.agencyId,
      agencyCode: res.agency?.code ?? null,
      agencyName: res.agency?.name ?? (bucket === 'direct' ? 'Direct / walk-in' : 'Unknown'),
      sourceCode: res.source?.code ?? null,
      sourceName: res.source?.name ?? null,
      revenue: 0,
      roomNights: 0,
      adr: 0,
      reservations: 0,
      cancelled: 0,
      cancellationRatePct: 0,
      cityLedgerNet: 0,
    };

    if (res.status === 'CANCELLED') {
      row.cancelled += 1;
      map.set(key, row);
      continue;
    }

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
        sum +
        folio.charges.reduce((s, c) => s + decimalToNumber(c.amount) * c.qty, 0),
      0,
    );
    row.revenue += folioRevenue;

    const payments = res.folios.reduce(
      (sum, folio) =>
        sum + folio.payments.reduce((s, p) => s + decimalToNumber(p.amount), 0),
      0,
    );
    row.cityLedgerNet += folioRevenue - payments;

    map.set(key, row);
  }

  const rows = [...map.values()]
    .map((r) => {
      const total = r.reservations + r.cancelled;
      return {
        ...r,
        adr: r.roomNights > 0 ? Math.round((r.revenue / r.roomNights) * 100) / 100 : 0,
        cancellationRatePct:
          total > 0 ? Math.round((r.cancelled / total) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return {
    from: start.toISOString(),
    to: end.toISOString(),
    totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
    rows,
  };
}
