export type FiscalizeInput = {
  documentRef: string;
  amount: number;
  currency?: "AZN";
  paymentMethod: string;
  registerRef?: string;
  outletCode?: string;
  metadata?: Record<string, string>;
};

export type FiscalizeResult = {
  receiptId: string;
  qrPayload: string | null;
  driver: string;
};

export interface FiscalDriver {
  readonly name: string;
  fiscalize(input: FiscalizeInput): Promise<FiscalizeResult>;
}
