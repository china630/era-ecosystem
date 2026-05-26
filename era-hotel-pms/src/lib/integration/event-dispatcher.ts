import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import axios, { AxiosError } from 'axios';
import { randomUUID } from 'crypto';
import type { FolioType, PaymentMethod, Reservation } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { getPropertyCode } from '@/lib/services/hotel.service';
import { getRedis, OUTBOUND_RETRY_QUEUE, IDEMPOTENCY_PREFIX } from '@/lib/redis';
import {
  getOutboundSettings,
  shouldDispatchEvent,
  type OutboundSettings,
} from './integration-settings';
import {
  envelopeToReservationCompletedEvent,
  envelopeToNightAuditClosedEvent,
  envelopeToInvoiceIssuedEvent,
  envelopeToCityLedgerSnapshotEvent,
  publishToOrchestratorGateway,
} from './orchestrator-gateway';
import type {
  IntegrationEnvelope,
  DispatchResult,
  SatellitePaymentMethod,
  BreakdownItemType,
  NightAuditPayload,
  FolioChargePostedPayload,
  FolioPaymentReceivedPayload,
  FolioChargeVoidedPayload,
  InvoiceIssuedPayload,
  CityLedgerSnapshotPayload,
  MasterDataSyncPayload,
  PaymentFiscalizedPayload,
  IntegrationEventType,
} from './event-types';

const LOG_DIR = join(process.cwd(), 'logs');
const LOG_FILE = join(LOG_DIR, 'failed-events.log');

function mapPaymentMethod(method: PaymentMethod): SatellitePaymentMethod {
  return method as SatellitePaymentMethod;
}

function mapRevenueToItemType(code: string): BreakdownItemType {
  const upper = code.toUpperCase();
  if (upper === 'ROOM') return 'ACCOMMODATION';
  if (upper === 'FOOD') return 'FOOD';
  if (upper === 'MEDICAL') return 'MEDICAL';
  if (upper.includes('MINIBAR')) return 'MINIBAR';
  if (upper.includes('LAUNDRY')) return 'LAUNDRY';
  return 'RESTAURANT';
}

function requiresEInvoicing(guestVoen: string | null): boolean {
  return guestVoen != null && guestVoen.length > 0;
}

type ReservationWithFolios = Reservation & {
  guest: { fullName: string; voen: string | null };
  folios: Array<{
    charges: Array<{
      qty: number;
      amount: { toNumber(): number };
      revenueCode: { code: string };
    }>;
    payments: Array<{ amount: { toNumber(): number } }>;
  }>;
};

export async function buildReservationCompletedEvent(
  reservation: ReservationWithFolios,
): Promise<IntegrationEnvelope> {
  const items: Array<{ itemType: BreakdownItemType; sku: string; qty: number; price: number }> = [];

  let totalCharges = 0;
  let totalPayments = 0;

  for (const folio of reservation.folios) {
    totalPayments += folio.payments.reduce((s, p) => s + decimalToNumber(p.amount), 0);
    for (const charge of folio.charges) {
      const lineTotal = decimalToNumber(charge.amount) * charge.qty;
      totalCharges += lineTotal;
      items.push({
        itemType: mapRevenueToItemType(charge.revenueCode.code),
        sku: charge.revenueCode.code,
        qty: charge.qty,
        price: decimalToNumber(charge.amount),
      });
    }
  }

  const amountNet = totalCharges - totalPayments;
  const hotelId = await getPropertyCode();

  return {
    correlationId: randomUUID(),
    hotelId,
    eventType: 'SATELLITE_HOTEL_RESERVATION_COMPLETED',
    timestamp: new Date().toISOString(),
    payload: {
      reservationId: reservation.id,
      guestName: reservation.guest.fullName,
      guestVoen: reservation.guest.voen,
      amountNet,
      currency: 'AZN',
      paymentMethod: mapPaymentMethod(reservation.paymentMethod),
      breakdown: items,
    },
  };
}

export function buildNightAuditEvent(
  input: {
    businessDate: string;
    nightAuditId?: string;
    revenueLines: Array<{ revenueCode: string; amount: number; glAccountCode?: string }>;
    paymentLines: Array<{ method: string; amount: number }>;
  },
  hotelId: string,
): IntegrationEnvelope {
  return {
    correlationId: randomUUID(),
    hotelId,
    eventType: 'SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED',
    timestamp: new Date().toISOString(),
    payload: {
      businessDate: input.businessDate,
      nightAuditId: input.nightAuditId,
      currency: 'AZN',
      revenueLines: input.revenueLines,
      lines: input.revenueLines,
      paymentLines: input.paymentLines,
    } as NightAuditPayload,
  };
}

export async function buildFolioChargePostedEvent(chargeId: string): Promise<IntegrationEnvelope> {
  const charge = await prisma.folioCharge.findUniqueOrThrow({
    where: { id: chargeId },
    include: {
      revenueCode: true,
      folio: { include: { reservation: { include: { guest: true } } } },
    },
  });
  const hotelId = await getPropertyCode();
  const payload: FolioChargePostedPayload = {
    reservationId: charge.folio.reservationId,
    folioId: charge.folioId,
    folioType: charge.folio.type,
    chargeId: charge.id,
    revenueCode: charge.revenueCode.code,
    amount: decimalToNumber(charge.amount),
    qty: charge.qty,
    description: charge.description,
    businessDate: charge.businessDate.toISOString().slice(0, 10),
    guestVoen: charge.folio.reservation.guest.voen,
    requiresEInvoicing: requiresEInvoicing(charge.folio.reservation.guest.voen),
    currency: 'AZN',
  };
  return {
    correlationId: randomUUID(),
    hotelId,
    eventType: 'SATELLITE_HOTEL_FOLIO_CHARGE_POSTED',
    timestamp: new Date().toISOString(),
    payload,
  };
}

export async function buildFolioPaymentReceivedEvent(
  paymentId: string,
): Promise<IntegrationEnvelope> {
  const payment = await prisma.folioPayment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { folio: { include: { reservation: true } } },
  });
  const hotelId = await getPropertyCode();
  const payload: FolioPaymentReceivedPayload = {
    reservationId: payment.folio.reservationId,
    folioId: payment.folioId,
    folioType: payment.folio.type,
    paymentId: payment.id,
    amount: decimalToNumber(payment.amount),
    paymentMethod: mapPaymentMethod(payment.paymentMethod),
    registerRef: payment.registerRef,
    currency: 'AZN',
  };
  return {
    correlationId: randomUUID(),
    hotelId,
    eventType: 'SATELLITE_HOTEL_FOLIO_PAYMENT_RECEIVED',
    timestamp: new Date().toISOString(),
    payload,
  };
}

export function buildFolioChargeVoidedEvent(input: {
  chargeId: string;
  reservationId: string;
  folioId: string;
  folioType: FolioType;
  revenueCode: string;
  amount: number;
  qty: number;
  description: string;
  businessDate: Date;
  guestVoen: string | null;
}): Promise<IntegrationEnvelope> {
  return getPropertyCode().then((hotelId) => {
    const payload: FolioChargeVoidedPayload = {
      reservationId: input.reservationId,
      folioId: input.folioId,
      folioType: input.folioType,
      chargeId: input.chargeId,
      revenueCode: input.revenueCode,
      amount: input.amount,
      qty: input.qty,
      description: input.description,
      businessDate: input.businessDate.toISOString().slice(0, 10),
      guestVoen: input.guestVoen,
      requiresEInvoicing: requiresEInvoicing(input.guestVoen),
      currency: 'AZN',
    };
    return {
      correlationId: randomUUID(),
      hotelId,
      eventType: 'SATELLITE_HOTEL_FOLIO_CHARGE_VOIDED',
      timestamp: new Date().toISOString(),
      payload,
    };
  });
}

function eventKind(eventType: IntegrationEventType): 'checkout' | 'nightAudit' {
  if (eventType === 'SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED') return 'nightAudit';
  return 'checkout';
}

function getIntegrationConfig(settings: OutboundSettings, kind: 'checkout' | 'nightAudit') {
  const url =
    kind === 'nightAudit'
      ? settings.urls.nightAudit || settings.urls.default
      : settings.urls.default;
  const token = process.env.EXTERNAL_INTEGRATION_TOKEN;
  const timeout = parseInt(process.env.EXTERNAL_HTTP_TIMEOUT_MS ?? '10000', 10);
  const maxRetries = parseInt(process.env.EXTERNAL_RETRY_MAX ?? '3', 10);
  return { url, token, timeout, maxRetries };
}

function appendFailedLog(envelope: IntegrationEnvelope, error: string) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(
      LOG_FILE,
      JSON.stringify({
        loggedAt: new Date().toISOString(),
        correlationId: envelope.correlationId,
        error,
        envelope,
      }) + '\n',
      'utf8',
    );
  } catch (fileErr) {
    console.error('Failed to write failed-events.log', fileErr);
  }
}

async function enqueueRetry(envelope: IntegrationEnvelope) {
  try {
    const redis = await getRedis();
    if (redis) {
      await redis.lPush(OUTBOUND_RETRY_QUEUE, JSON.stringify(envelope));
    }
  } catch (e) {
    console.error('Redis enqueue failed', e);
  }
}

async function checkIdempotency(correlationId: string): Promise<boolean> {
  try {
    const redis = await getRedis();
    if (!redis) return false;
    const key = `${IDEMPOTENCY_PREFIX}${correlationId}`;
    const exists = await redis.get(key);
    return exists === '1';
  } catch {
    return false;
  }
}

async function markIdempotency(correlationId: string) {
  try {
    const redis = await getRedis();
    if (redis) {
      await redis.setEx(`${IDEMPOTENCY_PREFIX}${correlationId}`, 7 * 24 * 3600, '1');
    }
  } catch {
    /* optional */
  }
}

async function logOutboundEvent(
  envelope: IntegrationEnvelope,
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED',
  attempts: number,
  lastError?: string,
) {
  try {
    await prisma.outboundEventLog.upsert({
      where: { id: envelope.correlationId },
      create: {
        id: envelope.correlationId,
        eventType: envelope.eventType,
        payloadJson: JSON.stringify(envelope),
        status,
        attempts,
        lastError: lastError ?? null,
      },
      update: {
        status,
        attempts,
        lastError: lastError ?? null,
        payloadJson: JSON.stringify(envelope),
      },
    });
  } catch (dbErr) {
    console.error('OutboundEventLog write failed', dbErr);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function eventGatewayMode(): 'orchestrator' | 'legacy' {
  const mode = (process.env.ERA_EVENT_GATEWAY_MODE ?? 'legacy').toLowerCase();
  return mode === 'orchestrator' ? 'orchestrator' : 'legacy';
}

export async function publishEvent(
  envelope: IntegrationEnvelope,
  settings?: OutboundSettings,
): Promise<DispatchResult> {
  const outboundSettings = settings ?? (await getOutboundSettings());

  if (
    (envelope.eventType === 'SATELLITE_HOTEL_RESERVATION_COMPLETED' ||
      envelope.eventType === 'SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED' ||
      envelope.eventType === 'SATELLITE_HOTEL_INVOICE_ISSUED' ||
      envelope.eventType === 'SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT') &&
    eventGatewayMode() === 'orchestrator'
  ) {
    const organizationId =
      process.env.ERA_SATELLITE_ORGANIZATION_ID ?? process.env.ORGANIZATION_ID;
    if (!organizationId) {
      const msg = 'ERA_SATELLITE_ORGANIZATION_ID is not configured';
      appendFailedLog(envelope, msg);
      await logOutboundEvent(envelope, 'FAILED', 0, msg);
      return {
        dispatched: false,
        correlationId: envelope.correlationId,
        error: msg,
        attempts: 0,
      };
    }
    const contractEvent =
      envelope.eventType === 'SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED'
        ? envelopeToNightAuditClosedEvent(envelope, organizationId)
        : envelope.eventType === 'SATELLITE_HOTEL_INVOICE_ISSUED'
          ? envelopeToInvoiceIssuedEvent(envelope, organizationId)
          : envelope.eventType === 'SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT'
            ? envelopeToCityLedgerSnapshotEvent(envelope, organizationId)
            : envelopeToReservationCompletedEvent(envelope, organizationId);
    if (!contractEvent) {
      const msg = 'Failed to map envelope to @era/contracts event';
      await logOutboundEvent(envelope, 'FAILED', 0, msg);
      return {
        dispatched: false,
        correlationId: envelope.correlationId,
        error: msg,
        attempts: 0,
      };
    }
    if (await checkIdempotency(envelope.correlationId)) {
      return { dispatched: true, correlationId: envelope.correlationId, attempts: 0 };
    }
    await logOutboundEvent(envelope, 'PENDING', 0);
    const gateway = await publishToOrchestratorGateway(contractEvent);
    if (gateway.ok) {
      await markIdempotency(envelope.correlationId);
      await logOutboundEvent(envelope, 'SENT', 1);
      return { dispatched: true, correlationId: envelope.correlationId, attempts: 1 };
    }
    const err = gateway.error ?? 'Orchestrator gateway failed';
    appendFailedLog(envelope, err);
    await enqueueRetry(envelope);
    await logOutboundEvent(envelope, 'FAILED', 1, err);
    return {
      dispatched: false,
      correlationId: envelope.correlationId,
      error: err,
      attempts: 1,
    };
  }

  if (!shouldDispatchEvent(envelope.eventType, outboundSettings)) {
    await logOutboundEvent(envelope, 'SKIPPED', 0, 'Channel disabled in settings');
    return {
      dispatched: false,
      correlationId: envelope.correlationId,
      attempts: 0,
      skipped: true,
    };
  }

  const kind = eventKind(envelope.eventType);
  const { url, token, timeout, maxRetries } = getIntegrationConfig(outboundSettings, kind);

  if (!url) {
    const msg = 'Integration URL is not configured';
    appendFailedLog(envelope, msg);
    await logOutboundEvent(envelope, 'FAILED', 0, msg);
    return { dispatched: false, correlationId: envelope.correlationId, error: msg, attempts: 0 };
  }

  if (await checkIdempotency(envelope.correlationId)) {
    return { dispatched: true, correlationId: envelope.correlationId, attempts: 0 };
  }

  await logOutboundEvent(envelope, 'PENDING', 0);

  let lastError = '';
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await axios.post(url, envelope, {
        timeout,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      await markIdempotency(envelope.correlationId);
      await logOutboundEvent(envelope, 'SENT', attempt);
      return { dispatched: true, correlationId: envelope.correlationId, attempts: attempt };
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? `${err.message}${err.response ? ` (${err.response.status})` : ''}`
          : err instanceof Error
            ? err.message
            : 'Unknown error';
      lastError = message;
      await logOutboundEvent(envelope, 'PENDING', attempt, message);
      if (attempt < maxRetries) {
        await sleep(1000 * Math.pow(2, attempt - 1));
      }
    }
  }

  appendFailedLog(envelope, lastError);
  await enqueueRetry(envelope);
  await logOutboundEvent(envelope, 'FAILED', maxRetries, lastError);
  return {
    dispatched: false,
    correlationId: envelope.correlationId,
    error: lastError,
    attempts: maxRetries,
  };
}

export async function dispatchReservationCompleted(
  reservation: ReservationWithFolios,
): Promise<DispatchResult> {
  const envelope = await buildReservationCompletedEvent(reservation);
  return publishEvent(envelope);
}

export async function dispatchNightAuditClosed(input: {
  businessDate: string;
  nightAuditId?: string;
  revenueLines: Array<{ revenueCode: string; amount: number }>;
  paymentLines: Array<{ method: string; amount: number }>;
}): Promise<DispatchResult> {
  const hotelId = await getPropertyCode();
  const { enrichRevenueLinesWithGl } = await import('@/lib/services/revenue-gl-mapping.service');
  const revenueLines = await enrichRevenueLinesWithGl(input.revenueLines);
  const envelope = buildNightAuditEvent({ ...input, revenueLines }, hotelId);
  return publishEvent(envelope);
}

export async function dispatchFolioChargePosted(chargeId: string): Promise<DispatchResult> {
  const envelope = await buildFolioChargePostedEvent(chargeId);
  return publishEvent(envelope);
}

export async function dispatchFolioPaymentReceived(paymentId: string): Promise<DispatchResult> {
  const envelope = await buildFolioPaymentReceivedEvent(paymentId);
  return publishEvent(envelope);
}

export async function buildInvoiceIssuedEvent(
  fiscalDocumentId: string,
): Promise<IntegrationEnvelope> {
  const doc = await prisma.fiscalDocument.findUniqueOrThrow({
    where: { id: fiscalDocumentId },
    include: {
      folio: {
        include: {
          charges: { include: { revenueCode: true } },
          reservation: { include: { guest: true, agency: true } },
        },
      },
    },
  });
  if (!doc.folio) throw new Error('Folio required for invoice');
  const res = doc.folio.reservation;
  const counterpartyType =
    doc.folio.type === 'COMPANY' ? 'company' : res.agencyId ? 'agency' : 'guest';
  const payload: InvoiceIssuedPayload = {
    invoiceNumber: doc.invoiceNumber ?? doc.id,
    issueDate: new Date().toISOString().slice(0, 10),
    counterpartyType,
    counterpartyTaxId: doc.counterpartyVoen ?? res.guest.voen,
    reservationId: doc.reservationId,
    folioId: doc.folioId!,
    folioType: doc.folio.type,
    fiscalStatus: doc.fiscalStatus,
    currency: 'AZN',
    lines: doc.folio.charges.map((c) => ({
      description: c.description,
      revenueCode: c.revenueCode.code,
      qty: c.qty,
      amount: decimalToNumber(c.amount),
    })),
  };
  const hotelId = await getPropertyCode();
  return {
    correlationId: randomUUID(),
    hotelId,
    eventType: 'SATELLITE_HOTEL_INVOICE_ISSUED',
    timestamp: new Date().toISOString(),
    payload,
  };
}

export async function dispatchInvoiceIssued(fiscalDocumentId: string): Promise<DispatchResult> {
  const envelope = await buildInvoiceIssuedEvent(fiscalDocumentId);
  return publishEvent(envelope);
}

export async function dispatchCityLedgerSnapshot(
  agencyId: string,
  asOfDate: string,
): Promise<DispatchResult> {
  const { getAgencyLedger } = await import('@/lib/services/agency-ledger.service');
  const ledger = await getAgencyLedger(agencyId, new Date(asOfDate), new Date(asOfDate));
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: agencyId } });
  const hotelId = await getPropertyCode();
  const envelope: IntegrationEnvelope = {
    correlationId: randomUUID(),
    hotelId,
    eventType: 'SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT',
    timestamp: new Date().toISOString(),
    payload: {
      agencyId,
      agencyCode: agency.code,
      asOfDate,
      balance: ledger.closing,
      periodCharges: ledger.newCharges,
      periodPayments: ledger.payments,
      currency: 'AZN',
    } as CityLedgerSnapshotPayload,
  };
  return publishEvent(envelope);
}

export async function dispatchMasterDataSync(): Promise<DispatchResult> {
  const [revenueCodes, departments] = await Promise.all([
    prisma.revenueCode.findMany({ orderBy: { code: 'asc' } }),
    prisma.department.findMany({ orderBy: { code: 'asc' } }),
  ]);
  const hotelId = await getPropertyCode();
  const envelope: IntegrationEnvelope = {
    correlationId: randomUUID(),
    hotelId,
    eventType: 'SATELLITE_HOTEL_MASTER_DATA_SYNC',
    timestamp: new Date().toISOString(),
    payload: {
      revenueCodes: revenueCodes.map((r) => ({ code: r.code, name: r.name })),
      departments: departments.map((d) => ({ code: d.code, name: d.name })),
    } as MasterDataSyncPayload,
  };
  return publishEvent(envelope);
}

export async function dispatchPaymentFiscalized(input: {
  paymentId: string;
  folioId: string;
  reservationId: string;
  amount: number;
  receiptId: string;
  qrPayload: string | null;
}): Promise<DispatchResult> {
  const hotelId = await getPropertyCode();
  const envelope: IntegrationEnvelope = {
    correlationId: randomUUID(),
    hotelId,
    eventType: 'SATELLITE_HOTEL_PAYMENT_FISCALIZED',
    timestamp: new Date().toISOString(),
    payload: {
      ...input,
      currency: 'AZN',
    } as PaymentFiscalizedPayload,
  };
  return publishEvent(envelope);
}

export async function dispatchFolioChargeVoided(input: {
  chargeId: string;
  reservationId: string;
  folioId: string;
  folioType: FolioType;
  revenueCode: string;
  amount: number;
  qty: number;
  description: string;
  businessDate: Date;
  guestVoen: string | null;
}): Promise<DispatchResult> {
  const envelope = await buildFolioChargeVoidedEvent(input);
  return publishEvent(envelope);
}

export async function processRetryQueue(limit = 10): Promise<{ processed: number; sent: number }> {
  const redis = await getRedis();
  if (!redis) return { processed: 0, sent: 0 };

  let sent = 0;
  let processed = 0;
  for (let i = 0; i < limit; i++) {
    const raw = await redis.rPop(OUTBOUND_RETRY_QUEUE);
    if (!raw) break;
    processed++;
    const envelope = JSON.parse(raw) as IntegrationEnvelope;
    const result = await publishEvent(envelope);
    if (result.dispatched) sent++;
  }
  return { processed, sent };
}

export async function listOutboundEventLog(input: {
  limit?: number;
  status?: string;
}) {
  const limit = input.limit ?? 50;
  return prisma.outboundEventLog.findMany({
    where: input.status ? { status: input.status as 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED' } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
