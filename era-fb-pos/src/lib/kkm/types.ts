export type FiscalizeInput = {
  ticketId: string;
  amountAzn: number;
  method: "CASH" | "CARD";
  outletCode?: string;
};

export type FiscalizeResult = {
  receiptId: string;
  qrPayload: string;
  driver: string;
};

export interface KkmDriver {
  readonly name: string;
  fiscalize(input: FiscalizeInput): Promise<FiscalizeResult>;
}
