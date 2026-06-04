import { randomUUID } from "crypto";
import type { FiscalDriver, FiscalizeInput, FiscalizeResult } from "../types";

export class MockFiscalDriver implements FiscalDriver {
  readonly name = "mock";

  async fiscalize(input: FiscalizeInput): Promise<FiscalizeResult> {
    const id = `KKM-${randomUUID().slice(0, 8)}`;
    return {
      receiptId: id,
      qrPayload: `https://example.az/receipt/${id}?amount=${input.amount}&ref=${input.documentRef}`,
      driver: this.name,
    };
  }
}
