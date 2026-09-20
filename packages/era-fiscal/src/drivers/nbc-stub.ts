import { randomUUID } from "crypto";
import type { FiscalizeInput, FiscalizeResult } from "../types";
import { PartialFiscalDriver } from "./partial";

export class NbcFiscalDriverStub extends PartialFiscalDriver {
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
