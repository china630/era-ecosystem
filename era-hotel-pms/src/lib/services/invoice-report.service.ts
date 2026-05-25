import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import type { Decimal } from '@prisma/client/runtime/library';

function folioChargeTotal(
  charges: Array<{ amount: Decimal; qty: number }>,
): number {
  return charges.reduce((sum, c) => sum + decimalToNumber(c.amount) * c.qty, 0);
}

export async function listInvoiceReport(filters?: {
  from?: Date;
  to?: Date;
  integrateOnly?: boolean;
}) {
  const docs = await prisma.fiscalDocument.findMany({
    where: {
      ...(filters?.integrateOnly ? { integrateToAccounting: true } : {}),
      ...(filters?.from || filters?.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: {
      folio: {
        include: {
          charges: true,
          reservation: {
            include: { guest: true, agency: true, ratePlan: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return docs.map((doc) => {
    const folio = doc.folio;
    const amount = folio ? folioChargeTotal(folio.charges) : 0;
    const folioType = folio?.type ?? '—';
    const guestName = folio?.reservation.guest.fullName ?? '—';
    const agencyName = folio?.reservation.agency?.name ?? null;
    return {
      id: doc.id,
      invoiceNumber: doc.invoiceNumber,
      folioType,
      amount,
      currency: 'AZN',
      fiscalStatus: doc.fiscalStatus,
      integrateToAccounting: doc.integrateToAccounting,
      counterpartyVoen: doc.counterpartyVoen,
      guestName,
      agencyName,
      reservationId: doc.reservationId,
      folioId: doc.folioId,
      createdAt: doc.createdAt,
    };
  });
}

export async function setInvoiceIntegrateFlag(id: string, integrateToAccounting: boolean) {
  return prisma.fiscalDocument.update({
    where: { id },
    data: { integrateToAccounting },
  });
}

export async function exportIntegrateReadyInvoices() {
  return listInvoiceReport({ integrateOnly: true });
}
