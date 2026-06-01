import { randomUUID } from "crypto";

export interface FiscalReceiptResult {
  fiscalNumber: string;
  qrPayload: string | null;
}

export interface RetailFiscalProvider {
  fiscalizeReceipt(input: {
    receiptId: string;
    amountNet: number;
    paymentMethod: string;
  }): Promise<FiscalReceiptResult>;
}

class MockRetailKkm implements RetailFiscalProvider {
  async fiscalizeReceipt(input: {
    receiptId: string;
    amountNet: number;
  }): Promise<FiscalReceiptResult> {
    const n = `R-${randomUUID().slice(0, 8)}`;
    return {
      fiscalNumber: n,
      qrPayload: `https://example.az/retail/receipt/${n}?amount=${input.amountNet}`,
    };
  }
}

class NbcRetailKkmStub implements RetailFiscalProvider {
  async fiscalizeReceipt(input: {
    receiptId: string;
    amountNet: number;
  }): Promise<FiscalReceiptResult> {
    const n = `NBC-${input.receiptId.slice(0, 8)}`;
    return { fiscalNumber: n, qrPayload: `nbc://receipt/${n}` };
  }
}

export function getRetailFiscalProvider(): RetailFiscalProvider {
  const p = (process.env.ERA_FISCAL_PROVIDER ?? "mock").toLowerCase();
  if (p === "nbc") return new NbcRetailKkmStub();
  return new MockRetailKkm();
}
