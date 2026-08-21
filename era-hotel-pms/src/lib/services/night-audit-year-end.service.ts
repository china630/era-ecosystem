import { getBusinessDateStatus } from '@/lib/services/business-date.service';
import { prisma } from '@/lib/prisma';
import { folioBalance } from '@/lib/services/folio.service';
import { getHotelPolicy } from '@/lib/services/hotel-policy.service';

export type YearEndAction = 'LAST_DAY' | 'FIRST_DAY';

export async function getYearEndPreview() {
  const status = await getBusinessDateStatus();
  const iso = status.currentBusinessDate;
  const asOf = new Date(`${iso}T23:59:59.999Z`);
  const [, month, day] = iso.split('-').map(Number);
  const isLastDayOfYear = month === 12 && day === 31;
  const isFirstDayOfYear = month === 1 && day === 1;
  const year = Number(iso.slice(0, 4));

  const openCityLedger = await getOpenCityLedgerPreview(asOf);

  return {
    businessDate: iso,
    wallClockDate: status.wallClockDate,
    businessDayStatus: status.businessDayStatus,
    year,
    isLastDayOfYear,
    isFirstDayOfYear,
    enabled: false,
    openCityLedger,
    note:
      'Year-end posting is staged (ADR hotel-year-end-calendar). Live close/open requires Finance calendar sign-off + yearEndPostingEnabled.',
  };
}

async function getOpenCityLedgerPreview(asOf: Date) {
  const folios = await prisma.folio.findMany({
    where: {
      status: 'TRANSFERRED_AR',
      type: { in: ['AGENCY', 'COMPANY'] },
    },
    include: {
      charges: { where: { businessDate: { lte: asOf } } },
      payments: { where: { createdAt: { lte: asOf } } },
      reservation: { select: { id: true, agencyId: true } },
    },
    take: 200,
  });

  let totalAzn = 0;
  const open = [];
  for (const f of folios) {
    const bal = folioBalance(f.charges, f.payments);
    if (Math.abs(bal) <= 0.01) continue;
    const positive = Math.max(0, bal);
    totalAzn += positive;
    open.push({ folioId: f.id, reservationId: f.reservationId, balance: positive });
  }

  return {
    count: open.length,
    totalAzn,
    // Keep refusal list short for UI.
    items: open.slice(0, 20),
  };
}

export async function runYearEndAction(action: YearEndAction) {
  const preview = await getYearEndPreview();

  const policy = await getHotelPolicy();
  if (
    action === 'LAST_DAY' &&
    policy.yearEndBlockIfOpenCityLedger &&
    preview.openCityLedger?.count > 0
  ) {
    return {
      ok: false as const,
      code: 'YEAR_END_BLOCKED_OPEN_CITY_LEDGER' as const,
      action,
      preview,
      message: `Last-day close blocked: City Ledger has ${preview.openCityLedger.count} open balances for the current business date.`,
    };
  }

  return {
    ok: false as const,
    code: 'YEAR_END_NOT_ENABLED' as const,
    action,
    preview,
    message:
      action === 'LAST_DAY'
        ? 'Last day of year close is not enabled yet (menu + preview only).'
        : 'First day of year open is not enabled yet (menu + preview only).',
  };
}
