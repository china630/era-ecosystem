import type { FiscalizeInput, FiscalizeResult, KkmDriver } from "./types";

export class MockKkmDriver implements KkmDriver {
  readonly name = "mock";

  async fiscalize(input: FiscalizeInput): Promise<FiscalizeResult> {
    const suffix = input.ticketId.slice(0, 8);
    return {
      receiptId: `kkm-mock-${suffix}`,
      qrPayload: `MOCK-QR-${suffix}-${input.amountAzn.toFixed(2)}`,
      driver: this.name,
    };
  }
}
