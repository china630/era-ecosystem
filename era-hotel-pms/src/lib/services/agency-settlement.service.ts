import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { folioBalance, postPayment } from '@/lib/services/folio.service';

/**
 * Record agency postpaid payment against TRANSFERRED_AR company/agency folios (FIFO).
 * H-BL-46 ops path — bank matching remains in Finance (H-BL-48).
 */
export async function recordAgencySettlementPayment(input: {
  agencyId: string;
  amount: number;
  paymentMethod?: 'CASH' | 'CARD' | 'COMPANY_ACCOUNT';
  registerRef?: string;
}) {
  if (input.amount <= 0.01) throw new Error('Amount must be positive');
  const agency = await prisma.agency.findUnique({ where: { id: input.agencyId } });
  if (!agency) throw new Error('Agency not found');

  const folios = await prisma.folio.findMany({
    where: {
      status: 'TRANSFERRED_AR',
      type: { in: ['AGENCY', 'COMPANY'] },
      reservation: { agencyId: input.agencyId },
    },
    include: { charges: true, payments: true },
    orderBy: { createdAt: 'asc' },
  });

  let remaining = input.amount;
  const applied: Array<{ folioId: string; amount: number }> = [];

  for (const f of folios) {
    if (remaining <= 0.01) break;
    const bal = folioBalance(f.charges, f.payments);
    if (bal <= 0.01) continue;
    const use = Math.min(bal, remaining);
    await prisma.folio.update({ where: { id: f.id }, data: { status: 'OPEN' } });
    await postPayment({
      folioId: f.id,
      amount: use,
      paymentMethod: input.paymentMethod ?? 'COMPANY_ACCOUNT',
      registerRef: input.registerRef ?? `agency-settle:${agency.code}`,
    });
    const refreshed = await prisma.folio.findUnique({
      where: { id: f.id },
      include: { charges: true, payments: true },
    });
    const newBal = refreshed ? folioBalance(refreshed.charges, refreshed.payments) : 0;
    await prisma.folio.update({
      where: { id: f.id },
      data: { status: Math.abs(newBal) <= 0.01 ? 'CLOSED' : 'TRANSFERRED_AR' },
    });
    applied.push({ folioId: f.id, amount: use });
    remaining -= use;
  }

  const commissionPct =
    agency.commissionPercent != null ? decimalToNumber(agency.commissionPercent) : 0;
  const commissionAccrual =
    commissionPct > 0 ? Math.round(input.amount * (commissionPct / 100) * 100) / 100 : 0;

  return {
    agencyId: agency.id,
    applied,
    unallocated: Math.max(0, remaining),
    commissionPercent: commissionPct,
    commissionAccrual,
  };
}

export async function listAgencyTransferredFolios(agencyId: string) {
  const folios = await prisma.folio.findMany({
    where: {
      status: 'TRANSFERRED_AR',
      type: { in: ['AGENCY', 'COMPANY'] },
      reservation: { agencyId },
    },
    include: {
      charges: true,
      payments: true,
      reservation: { select: { id: true, checkInDate: true, checkOutDate: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return folios.map((f) => ({
    id: f.id,
    type: f.type,
    reservationId: f.reservationId,
    balance: folioBalance(f.charges, f.payments),
    checkInDate: f.reservation.checkInDate,
    checkOutDate: f.reservation.checkOutDate,
  }));
}
