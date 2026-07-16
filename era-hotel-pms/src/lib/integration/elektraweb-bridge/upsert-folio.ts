import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/decimal';
import { assertHotelIdMatches } from '@/lib/integration/elektraweb-bridge/config';
import { num, parseElektrawebDate, str } from '@/lib/integration/elektraweb-bridge/normalize';
import type { UpsertResult } from '@/lib/integration/elektraweb-bridge/upsert-guest';

async function resolveRevenueCodeId(row: Record<string, unknown>): Promise<string | null> {
  const name = str(row.REVENUE) ?? str(row.REVID_REVENUENAME);
  const code = str(row.REVCODE) ?? (num(row.REVID) != null ? String(num(row.REVID)) : null);

  if (name) {
    const byName = await prisma.revenueCode.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (byName) return byName.id;
  }
  if (code) {
    const byCode = await prisma.revenueCode.findFirst({
      where: {
        OR: [
          { code: { equals: code, mode: 'insensitive' } },
          { code: { equals: `EW-${code}`, mode: 'insensitive' } },
        ],
      },
    });
    if (byCode) return byCode.id;
  }

  // Soft fallback: ROOM / first active — better than dropping day lines entirely
  const room = await prisma.revenueCode.findFirst({
    where: { code: { equals: 'ROOM', mode: 'insensitive' } },
  });
  if (room) return room.id;
  const any = await prisma.revenueCode.findFirst({ orderBy: { code: 'asc' } });
  return any?.id ?? null;
}

export async function upsertFolioFromElektrawebRow(
  row: Record<string, unknown>,
): Promise<UpsertResult> {
  const hotelId = num(row.HOTELID);
  if (hotelId != null) assertHotelIdMatches(hotelId);

  const externalRef = str(row.ID);
  if (!externalRef) throw new Error('Folio row missing ID');

  const reservationExternalRef = str(row.RESID) ?? str(row.INITIALRESID);
  if (!reservationExternalRef) {
    throw new Error(`Folio ${externalRef} missing RESID`);
  }

  const amount = num(row.MCTOTAL) ?? num(row.CTOTAL) ?? num(row.MCTOTALNET);
  if (amount == null) throw new Error(`Folio ${externalRef} missing amount (CTOTAL/MCTOTAL)`);

  const reservation = await prisma.reservation.findUnique({
    where: { externalRef: reservationExternalRef },
    include: { folios: true },
  });
  if (!reservation) {
    return { action: 'skipped', key: externalRef };
  }

  const revenueCodeId = await resolveRevenueCodeId(row);
  if (!revenueCodeId) throw new Error(`No revenue codes configured (folio ${externalRef})`);

  let folio = reservation.folios.find((f) => f.type === 'GUEST' && f.status === 'OPEN');
  if (!folio) {
    folio = await prisma.folio.create({
      data: { reservationId: reservation.id, type: 'GUEST', status: 'OPEN' },
    });
  }

  const businessDate = parseElektrawebDate(row.TDATE) ?? new Date();
  const description =
    [str(row.REVENUE) ?? str(row.REVID_REVENUENAME), str(row.GUESTNAMES) ?? str(row.FULLNAME)]
      .filter(Boolean)
      .join(' — ') || `Elektraweb folio ${externalRef}`;

  const existing = await prisma.folioCharge.findUnique({ where: { externalRef } });
  const data = {
    externalRef,
    folioId: folio.id,
    revenueCodeId,
    amount: toDecimal(amount),
    qty: 1,
    description,
    businessDate,
  };

  await prisma.folioCharge.upsert({
    where: { externalRef },
    create: data,
    update: {
      revenueCodeId: data.revenueCodeId,
      amount: data.amount,
      description: data.description,
      businessDate: data.businessDate,
    },
  });

  return { action: existing ? 'updated' : 'created', key: externalRef };
}
