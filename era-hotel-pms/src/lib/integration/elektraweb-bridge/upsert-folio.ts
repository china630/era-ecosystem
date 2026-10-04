import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/decimal';
import { assertHotelIdMatches, bridgeRequestOrganizationId } from '@/lib/integration/elektraweb-bridge/config';
import { num, parseElektrawebDate, str } from '@/lib/integration/elektraweb-bridge/normalize';
import type { UpsertResult } from '@/lib/integration/elektraweb-bridge/upsert-guest';
import { resolveElektraRevenueCodeId } from '@/lib/integration/elektraweb-revenue';

function resolveRevenueCodeId(row: Record<string, unknown>): Promise<string> {
  return resolveElektraRevenueCodeId(prisma, {
    name: str(row.REVENUE) ?? str(row.REVID_REVENUENAME),
    code: str(row.REVCODE),
    numericId: num(row.REVID),
  });
}

export async function upsertFolioFromElektrawebRow(
  row: Record<string, unknown>,
): Promise<UpsertResult> {
  const hotelId = num(row.HOTELID);
  if (hotelId != null) await assertHotelIdMatches(hotelId);

  const externalRef = str(row.ID);
  if (!externalRef) throw new Error('Folio row missing ID');

  const reservationExternalRef = str(row.RESID) ?? str(row.INITIALRESID);
  if (!reservationExternalRef) {
    throw new Error(`Folio ${externalRef} missing RESID`);
  }

  const amount = num(row.MCTOTAL) ?? num(row.CTOTAL) ?? num(row.MCTOTALNET);
  if (amount == null) throw new Error(`Folio ${externalRef} missing amount (CTOTAL/MCTOTAL)`);

  const reservation = await prisma.reservation.findFirst({
    where: { externalRef: reservationExternalRef },
    include: { folios: true },
  });
  if (!reservation) {
    return { action: 'skipped', key: externalRef, mdmLinked: false };
  }

  const revenueCodeId = await resolveRevenueCodeId(row);

  let folio = reservation.folios.find((f) => f.type === 'GUEST' && f.status === 'OPEN');
  if (!folio) {
    folio = await prisma.folio.create({
      data: {
        organizationId: bridgeRequestOrganizationId(),
        reservationId: reservation.id,
        type: 'GUEST',
        status: 'OPEN',
      },
    });
  }

  if (!folio) throw new Error('Open folio missing after ensure');

  const businessDate = parseElektrawebDate(row.TDATE) ?? new Date();
  const description =
    [str(row.REVENUE) ?? str(row.REVID_REVENUENAME), str(row.GUESTNAMES) ?? str(row.FULLNAME)]
      .filter(Boolean)
      .join(' — ') || `Elektraweb folio ${externalRef}`;

  const organizationId = bridgeRequestOrganizationId();
  const existing = await prisma.folioCharge.findFirst({ where: { externalRef } });
  const data = {
    organizationId,
    externalRef,
    folioId: folio.id,
    revenueCodeId,
    amount: toDecimal(amount),
    qty: 1,
    description,
    businessDate,
  };

  await prisma.folioCharge.upsert({
    where: { organizationId_externalRef: { organizationId, externalRef } },
    create: data,
    update: {
      revenueCodeId: data.revenueCodeId,
      amount: data.amount,
      description: data.description,
      businessDate: data.businessDate,
    },
  });

  return { action: existing ? 'updated' : 'created', key: externalRef, mdmLinked: false };
}
