import { prisma } from '@/lib/prisma';
import { getHotelProfile } from '@/lib/services/hotel.service';
import type { IntegrationEventType } from './event-types';

export interface OutboundSettings {
  enabled: boolean;
  realtime: {
    chargePosted: boolean;
    paymentReceived: boolean;
    chargeVoided: boolean;
    reservationCompleted: boolean;
    invoiceIssued: boolean;
    paymentFiscalized: boolean;
  };
  cityLedgerSnapshot: boolean;
  masterDataSync: boolean;
  nightAuditClosed: boolean;
  urls: {
    default: string;
    nightAudit: string;
  };
  requireZeroBalanceOnCheckout: boolean;
}

export const DEFAULT_OUTBOUND_SETTINGS: OutboundSettings = {
  enabled: true,
  realtime: {
    chargePosted: true,
    paymentReceived: true,
    chargeVoided: true,
    reservationCompleted: true,
    invoiceIssued: true,
    paymentFiscalized: true,
  },
  cityLedgerSnapshot: true,
  masterDataSync: true,
  nightAuditClosed: true,
  urls: {
    default: process.env.EXTERNAL_INTEGRATION_URL ?? '',
    nightAudit:
      process.env.EXTERNAL_NIGHT_AUDIT_URL ||
      process.env.EXTERNAL_INTEGRATION_URL ||
      '',
  },
  requireZeroBalanceOnCheckout: true,
};

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return v === 'true' || v === '1';
}

function deepMergeOutbound(base: OutboundSettings, partial: Partial<OutboundSettings>): OutboundSettings {
  return {
    enabled: partial.enabled ?? base.enabled,
    realtime: { ...base.realtime, ...partial.realtime },
    nightAuditClosed: partial.nightAuditClosed ?? base.nightAuditClosed,
    cityLedgerSnapshot: partial.cityLedgerSnapshot ?? base.cityLedgerSnapshot,
    masterDataSync: partial.masterDataSync ?? base.masterDataSync,
    urls: { ...base.urls, ...partial.urls },
    requireZeroBalanceOnCheckout:
      partial.requireZeroBalanceOnCheckout ?? base.requireZeroBalanceOnCheckout,
  };
}

export function parseIntegrationSettingsJson(json: string | null | undefined): Partial<OutboundSettings> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as { outbound?: Partial<OutboundSettings> };
    return parsed.outbound ?? {};
  } catch {
    return {};
  }
}

export async function getOutboundSettings(): Promise<OutboundSettings> {
  const profile = await getHotelProfile();
  let settings = deepMergeOutbound(
    DEFAULT_OUTBOUND_SETTINGS,
    parseIntegrationSettingsJson(profile?.integrationSettingsJson),
  );

  settings = {
    ...settings,
    enabled: envBool('OUTBOUND_ENABLED', settings.enabled),
    realtime: {
      chargePosted: envBool('OUTBOUND_REALTIME_CHARGES', settings.realtime.chargePosted),
      paymentReceived: envBool('OUTBOUND_REALTIME_PAYMENTS', settings.realtime.paymentReceived),
      chargeVoided: envBool('OUTBOUND_REALTIME_VOIDS', settings.realtime.chargeVoided),
      reservationCompleted: envBool('OUTBOUND_CHECKOUT_EVENT', settings.realtime.reservationCompleted),
      invoiceIssued: envBool('OUTBOUND_INVOICE_ISSUED', settings.realtime.invoiceIssued),
      paymentFiscalized: envBool('OUTBOUND_PAYMENT_FISCALIZED', settings.realtime.paymentFiscalized),
    },
    cityLedgerSnapshot: envBool('OUTBOUND_CITY_LEDGER', settings.cityLedgerSnapshot),
    masterDataSync: envBool('OUTBOUND_MASTER_DATA_SYNC', settings.masterDataSync),
    nightAuditClosed: envBool('OUTBOUND_NIGHT_AUDIT_EVENT', settings.nightAuditClosed),
    urls: {
      default: settings.urls.default || process.env.EXTERNAL_INTEGRATION_URL || '',
      nightAudit:
        settings.urls.nightAudit ||
        process.env.EXTERNAL_NIGHT_AUDIT_URL ||
        process.env.EXTERNAL_INTEGRATION_URL ||
        '',
    },
  };

  return settings;
}

export function shouldDispatchEvent(
  eventType: IntegrationEventType,
  settings: OutboundSettings,
): boolean {
  if (!settings.enabled) return false;
  switch (eventType) {
    case 'SATELLITE_HOTEL_FOLIO_CHARGE_POSTED':
      return settings.realtime.chargePosted;
    case 'SATELLITE_HOTEL_FOLIO_PAYMENT_RECEIVED':
      return settings.realtime.paymentReceived;
    case 'SATELLITE_HOTEL_FOLIO_CHARGE_VOIDED':
      return settings.realtime.chargeVoided;
    case 'SATELLITE_HOTEL_RESERVATION_COMPLETED':
      return settings.realtime.reservationCompleted;
    case 'SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED':
      return settings.nightAuditClosed;
    case 'SATELLITE_HOTEL_INVOICE_ISSUED':
      return settings.realtime.invoiceIssued;
    case 'SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT':
      return settings.cityLedgerSnapshot;
    case 'SATELLITE_HOTEL_MASTER_DATA_SYNC':
      return settings.masterDataSync;
    case 'SATELLITE_HOTEL_PAYMENT_FISCALIZED':
      return settings.realtime.paymentFiscalized;
    default:
      return false;
  }
}

export async function saveIntegrationSettings(outbound: OutboundSettings): Promise<void> {
  const profile = await getHotelProfile();
  if (!profile) throw new Error('Hotel profile not configured');
  await prisma.hotelProfile.update({
    where: { id: profile.id },
    data: { integrationSettingsJson: JSON.stringify({ outbound }) },
  });
}
