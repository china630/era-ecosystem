import { randomUUID } from "crypto";
import type { FiscalDriver, FiscalizeInput, FiscalizeResult } from "../types";

export class NbcFiscalDriverStub implements FiscalDriver {
  readonly name = "nbc";

  async fiscalize(input: FiscalizeInput): Promise<FiscalizeResult> {
    const id = `NBC-${randomUUID().slice(0, 8)}`;
    return {
      receiptId: id,
      qrPayload: `nbc://fiscal/${id}?amt=${input.amount}&m=${input.paymentMethod}`,
      driver: this.name,
    };
  }
}
