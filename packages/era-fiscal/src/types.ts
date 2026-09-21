/** Fiscal cash register vs guest bank POS terminal. */
export type FiscalDeviceKind = "FISCAL_KKM" | "BANK_POS";

export type FiscalDeviceStatus = "active" | "retired";

/** Stable device row (platform SoR or in-memory directory). */
export type FiscalDeviceRef = {
  id: string;
  organizationId: string;
  kind: FiscalDeviceKind;
  providerId: string;
  label: string;
  outletCode?: string | null;
  registerCode?: string | null;
  serial?: string | null;
  /** KIZ / TID / MID etc. */
  externalIds?: Record<string, string>;
  endpoint?: string | null;
  /** Decrypted at Sync hydrate — never persist on satellite disk. */
  secrets?: Record<string, string>;
  status: FiscalDeviceStatus;
  isOrgDefault?: boolean;
  isOutletDefault?: boolean;
  isRegisterDefault?: boolean;
};

export type FiscalContext = {
  organizationId: string;
  outletCode?: string;
  registerRef?: string;
  shiftId?: string;
  /** Explicit shift binding (overrides register/outlet defaults). */
  shiftFiscalDeviceId?: string;
  shiftBankTerminalId?: string;
};

export type SaleLine = {
  sku?: string;
  name: string;
  qty: number;
  unitPrice: number;
  /** VAT rate percent, e.g. 18 */
  vatRate?: number;
  discount?: number;
};

export type Tender = {
  method: string;
  amount: number;
};

export type SaleInput = {
  documentRef: string;
  lines: SaleLine[];
  tenders: Tender[];
  currency?: "AZN";
  fiscalDeviceId?: string;
  bankTerminalId?: string;
  metadata?: Record<string, string>;
} & FiscalContext;

export type SaleResult = {
  receiptId: string;
  qrPayload: string | null;
  driver: string;
  fiscalDeviceId: string;
  bankTerminalId?: string | null;
  bankAuthRef?: string | null;
};

export type RefundInput = {
  documentRef: string;
  originalReceiptId: string;
  amount: number;
  currency?: "AZN";
  fiscalDeviceId?: string;
  reason?: string;
  metadata?: Record<string, string>;
} & FiscalContext;

export type VoidInput = {
  documentRef: string;
  receiptId: string;
  fiscalDeviceId?: string;
  reason?: string;
} & FiscalContext;

export type DeviceShiftInput = {
  fiscalDeviceId: string;
  openingCash?: number;
} & FiscalContext;

export type DeviceReportResult = {
  reportId: string;
  driver: string;
  payload?: Record<string, unknown>;
};

export type BankAuthInput = {
  bankTerminalId: string;
  amount: number;
  currency?: "AZN";
  documentRef: string;
  metadata?: Record<string, string>;
} & FiscalContext;

export type BankAuthResult = {
  authRef: string;
  driver: string;
  amount: number;
};

export type DeviceStatusResult = {
  online: boolean;
  driver: string;
  lastReceiptId?: string | null;
  detail?: string;
};

/** @deprecated Prefer SaleInput — kept for mid-migration adapters. */
export type FiscalizeInput = {
  documentRef: string;
  amount: number;
  currency?: "AZN";
  paymentMethod: string;
  registerRef?: string;
  outletCode?: string;
  organizationId?: string;
  fiscalDeviceId?: string;
  bankTerminalId?: string;
  shiftFiscalDeviceId?: string;
  shiftBankTerminalId?: string;
  lines?: SaleLine[];
  metadata?: Record<string, string>;
};

/** @deprecated Prefer SaleResult. */
export type FiscalizeResult = {
  receiptId: string;
  qrPayload: string | null;
  driver: string;
  fiscalDeviceId?: string;
  skipped?: boolean;
  skipReason?: "recorded_no_device" | "parent_fiscal";
};

export type SaleForSatelliteOutcome =
  | SaleResult
  | {
      skipped: true;
      reason: "recorded_no_device";
    };

export class FiscalError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "FiscalError";
  }
}

export const FISCAL_ERROR = {
  DEVICE_SELECTION_REQUIRED: "DEVICE_SELECTION_REQUIRED",
  DEVICE_NOT_FOUND: "DEVICE_NOT_FOUND",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  LIVE_DEVICE_REQUIRED: "LIVE_DEVICE_REQUIRED",
} as const;

/**
 * Full device protocol. Legacy `fiscalize` is optional — facade adapts to `sale`.
 */
export interface FiscalDriver {
  readonly name: string;
  fiscalize?(input: FiscalizeInput): Promise<FiscalizeResult>;
  sale(input: SaleInput & { fiscalDeviceId: string }): Promise<SaleResult>;
  refund(input: RefundInput & { fiscalDeviceId: string }): Promise<SaleResult>;
  voidReceipt(input: VoidInput & { fiscalDeviceId: string }): Promise<SaleResult>;
  openShift(input: DeviceShiftInput): Promise<DeviceReportResult>;
  xReport(input: DeviceShiftInput): Promise<DeviceReportResult>;
  zReport(input: DeviceShiftInput): Promise<DeviceReportResult>;
  bankAuthorize(input: BankAuthInput): Promise<BankAuthResult>;
  bankCapture(input: BankAuthInput & { authRef: string }): Promise<BankAuthResult>;
  bankReverse(input: BankAuthInput & { authRef: string }): Promise<BankAuthResult>;
  status(input: DeviceShiftInput): Promise<DeviceStatusResult>;
  lastReceipt(input: DeviceShiftInput): Promise<SaleResult | null>;
}
