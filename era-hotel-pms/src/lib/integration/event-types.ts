export type BreakdownItemType = 'ACCOMMODATION' | 'MINIBAR' | 'LAUNDRY' | 'RESTAURANT' | 'MEDICAL' | 'FOOD';

export type SatellitePaymentMethod = 'CASH' | 'CARD' | 'COMPANY_ACCOUNT';

export interface SatelliteHotelPayload {
  reservationId: string;
  guestName: string;
  guestVoen: string | null;
  amountNet: number;
  currency: 'AZN';
  paymentMethod: SatellitePaymentMethod;
  breakdown: Array<{
    itemType: BreakdownItemType;
    sku: string;
    qty: number;
    price: number;
  }>;
}

export interface NightAuditPayload {
  businessDate: string;
  nightAuditId?: string;
  currency: 'AZN';
  revenueLines: Array<{ revenueCode: string; amount: number }>;
  /** @deprecated use revenueLines */
  lines?: Array<{ revenueCode: string; amount: number }>;
  paymentLines: Array<{ method: string; amount: number }>;
}

export interface FolioChargePostedPayload {
  reservationId: string;
  folioId: string;
  folioType: string;
  chargeId: string;
  revenueCode: string;
  amount: number;
  qty: number;
  description: string;
  businessDate: string;
  guestVoen: string | null;
  requiresEInvoicing: boolean;
  currency: 'AZN';
}

export interface FolioPaymentReceivedPayload {
  reservationId: string;
  folioId: string;
  folioType: string;
  paymentId: string;
  amount: number;
  paymentMethod: SatellitePaymentMethod;
  registerRef: string | null;
  currency: 'AZN';
}

export interface FolioChargeVoidedPayload {
  reservationId: string;
  folioId: string;
  folioType: string;
  chargeId: string;
  revenueCode: string;
  amount: number;
  qty: number;
  description: string;
  businessDate: string;
  guestVoen: string | null;
  requiresEInvoicing: boolean;
  currency: 'AZN';
}

export interface InvoiceIssuedPayload {
  invoiceNumber: string;
  issueDate: string;
  counterpartyType: 'guest' | 'company' | 'agency';
  counterpartyTaxId: string | null;
  reservationId: string;
  folioId: string;
  folioType: string;
  fiscalStatus: string;
  currency: 'AZN';
  lines: Array<{
    description: string;
    revenueCode: string;
    qty: number;
    amount: number;
    vatRate?: number;
  }>;
}

export interface CityLedgerSnapshotPayload {
  agencyId: string;
  agencyCode: string;
  asOfDate: string;
  balance: number;
  periodCharges: number;
  periodPayments: number;
  currency: 'AZN';
}

export interface MasterDataSyncPayload {
  revenueCodes: Array<{ code: string; name: string }>;
  departments: Array<{ code: string; name: string }>;
}

export interface PaymentFiscalizedPayload {
  paymentId: string;
  folioId: string;
  reservationId: string;
  amount: number;
  receiptId: string;
  qrPayload: string | null;
  currency: 'AZN';
}

export type IntegrationEventType =
  | 'SATELLITE_HOTEL_RESERVATION_COMPLETED'
  | 'SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED'
  | 'SATELLITE_HOTEL_FOLIO_CHARGE_POSTED'
  | 'SATELLITE_HOTEL_FOLIO_PAYMENT_RECEIVED'
  | 'SATELLITE_HOTEL_FOLIO_CHARGE_VOIDED'
  | 'SATELLITE_HOTEL_INVOICE_ISSUED'
  | 'SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT'
  | 'SATELLITE_HOTEL_MASTER_DATA_SYNC'
  | 'SATELLITE_HOTEL_PAYMENT_FISCALIZED';

export type IntegrationPayload =
  | SatelliteHotelPayload
  | NightAuditPayload
  | FolioChargePostedPayload
  | FolioPaymentReceivedPayload
  | FolioChargeVoidedPayload
  | InvoiceIssuedPayload
  | CityLedgerSnapshotPayload
  | MasterDataSyncPayload
  | PaymentFiscalizedPayload;

export interface IntegrationEnvelope {
  correlationId: string;
  hotelId: string;
  eventType: IntegrationEventType;
  timestamp: string;
  payload: IntegrationPayload;
}

export interface DispatchResult {
  dispatched: boolean;
  correlationId: string;
  error?: string;
  attempts: number;
  skipped?: boolean;
}
