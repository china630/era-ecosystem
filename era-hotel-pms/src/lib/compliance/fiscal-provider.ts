import { randomUUID } from 'crypto';

export interface FiscalReceiptResult {
  receiptId: string;
  qrPayload: string | null;
}

export interface FiscalProvider {
  fiscalizePayment(input: {
    amount: number;
    paymentMethod: string;
    registerRef?: string;
  }): Promise<FiscalReceiptResult>;
}

export class MockKkmProvider implements FiscalProvider {
  async fiscalizePayment(input: {
    amount: number;
    paymentMethod: string;
  }): Promise<FiscalReceiptResult> {
    const id = `KKM-${randomUUID().slice(0, 8)}`;
    return {
      receiptId: id,
      qrPayload: `https://example.az/receipt/${id}?amount=${input.amount}`,
    };
  }
}

export function getFiscalProvider(): FiscalProvider {
  return new MockKkmProvider();
}
