import { prisma } from '@/lib/prisma';
import type { FiscalDocumentStatus } from '@prisma/client';
import { dispatchInvoiceIssued } from '@/lib/integration/event-dispatcher';

const STATUS_MAP: Record<string, FiscalDocumentStatus> = {
  pending: 'PENDING',
  sent: 'SENT',
  accepted: 'ACCEPTED',
  rejected: 'REJECTED',
  PENDING: 'PENDING',
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
};

export async function listFiscalDocuments(reservationId: string) {
  return prisma.fiscalDocument.findMany({
    where: { reservationId },
    orderBy: { createdAt: 'desc' },
    include: { folio: true },
  });
}

export async function createFiscalDocumentsOnCheckout(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      guest: true,
      folios: { where: { status: 'CLOSED' } },
    },
  });
  if (!reservation) return [];

  const created = [];
  for (const folio of reservation.folios) {
    const needsInvoice =
      folio.type === 'COMPANY' || (folio.type === 'GUEST' && reservation.guest.voen);
    if (!needsInvoice) continue;

    const doc = await prisma.fiscalDocument.create({
      data: {
        reservationId,
        folioId: folio.id,
        invoiceNumber: `INV-${reservationId.slice(0, 8)}-${folio.type}`,
        counterpartyVoen: reservation.guest.voen,
        fiscalStatus: 'PENDING',
      },
    });
    created.push(doc);
  }
  return created;
}

export async function applyE6FiscalStatusChanged(input: {
  invoiceRef: string;
  fiscalStatus: string;
  fiscalExternalId?: string;
  rejectionReason?: string;
  updatedAt?: string;
}) {
  const status = STATUS_MAP[input.fiscalStatus];
  if (!status) throw new Error(`Unknown fiscal_status: ${input.fiscalStatus}`);

  let doc = await prisma.fiscalDocument.findFirst({
    where: {
      OR: [
        { id: input.invoiceRef },
        { invoiceNumber: input.invoiceRef },
        { fiscalExternalId: input.invoiceRef },
      ],
    },
  });

  if (!doc) {
    throw new Error(`Fiscal document not found for ref: ${input.invoiceRef}`);
  }

  doc = await prisma.fiscalDocument.update({
    where: { id: doc.id },
    data: {
      fiscalStatus: status,
      fiscalExternalId: input.fiscalExternalId ?? doc.fiscalExternalId,
      rejectionReason: input.rejectionReason ?? null,
      lastEventAt: input.updatedAt ? new Date(input.updatedAt) : new Date(),
    },
    include: { folio: true, reservation: { include: { guest: true } } },
  });

  return doc;
}

export async function issueFolioInvoice(folioId: string) {
  const folio = await prisma.folio.findUnique({
    where: { id: folioId },
    include: {
      charges: true,
      reservation: { include: { guest: true, agency: true } },
    },
  });
  if (!folio) throw new Error('Folio not found');
  if (folio.charges.length === 0) throw new Error('Cannot issue invoice without charges');

  let doc = await prisma.fiscalDocument.findFirst({
    where: { folioId },
    orderBy: { createdAt: 'desc' },
  });

  const invoiceNumber = `INV-${folio.reservationId.slice(0, 8)}-${folio.type}-${Date.now().toString(36)}`;
  const voen =
    folio.type === 'COMPANY'
      ? folio.reservation.agency?.voen ?? folio.reservation.guest.voen
      : folio.reservation.guest.voen;

  if (doc) {
    doc = await prisma.fiscalDocument.update({
      where: { id: doc.id },
      data: {
        invoiceNumber,
        counterpartyVoen: voen,
        fiscalStatus: 'SENT',
        lastEventAt: new Date(),
      },
    });
  } else {
    doc = await prisma.fiscalDocument.create({
      data: {
        reservationId: folio.reservationId,
        folioId,
        invoiceNumber,
        counterpartyVoen: voen,
        fiscalStatus: 'SENT',
        lastEventAt: new Date(),
      },
    });
  }

  void dispatchInvoiceIssued(doc.id).catch((err) =>
    console.error('Invoice issued dispatch failed', err),
  );

  const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ?? '';
  const amountAzn = folio.charges.reduce(
    (sum, c) => sum + Number(c.amount ?? 0),
    0,
  );
  let payUrl: string | undefined;
  if (organizationId && amountAzn > 0) {
    const { runPlatformCommerceHooks } = await import('@era/satellite-kit');
    const hooks = await runPlatformCommerceHooks({
      organizationId,
      portal: { entityType: 'folio', entityId: folioId },
      payment: {
        amountAzn,
        sourceEntityType: 'fiscal_document',
        sourceEntityId: doc.id,
        description: `Invoice ${invoiceNumber}`,
      },
      delivery: {
        sourceEntityType: 'fiscal_document',
        sourceEntityId: doc.id,
        externalRef: folioId,
      },
      loyalty: {
        code: `HOTEL-FOLIO-${doc.id.slice(0, 8)}`,
        name: 'Hotel folio promotion',
        discountValue: 5,
        metadata: { folioId, fiscalDocumentId: doc.id },
      },
    });
    payUrl = hooks.payUrl;
  }

  const guestPhone = folio.reservation.guest.phone?.trim();
  if (guestPhone) {
    const { trySendPlatformNotification } = await import('@/lib/platform-notify');
    void trySendPlatformNotification({
      templateKey: 'hotel.invoice.issued',
      channel: 'WHATSAPP',
      messageClass: 'FINANCIAL',
      recipient: guestPhone,
      sourceEntityType: 'fiscal_document',
      sourceEntityId: doc.id,
      body: `Invoice ${invoiceNumber} issued for your stay.${payUrl ? ` Pay: ${payUrl}` : ''}`,
      payload: { folioId, invoiceNumber, payUrl },
    });
  }

  return prisma.fiscalDocument.findUniqueOrThrow({
    where: { id: doc.id },
    include: { folio: true },
  });
}
