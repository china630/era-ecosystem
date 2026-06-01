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

class NbcKkmProviderStub implements FiscalProvider {
  async fiscalizePayment(input: {
    amount: number;
    paymentMethod: string;
  }): Promise<FiscalReceiptResult> {
    const id = `NBC-${randomUUID().slice(0, 8)}`;
    return {
      receiptId: id,
      qrPayload: `nbc://fiscal/${id}?amt=${input.amount}&m=${input.paymentMethod}`,
    };
  }
}

export function getFiscalProvider(): FiscalProvider {
  const p = (process.env.ERA_FISCAL_PROVIDER ?? 'mock').toLowerCase();
  if (p === 'nbc' || p === 'cybernet') return new NbcKkmProviderStub();
  return new MockKkmProvider();
}
