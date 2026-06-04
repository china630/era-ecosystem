import { randomUUID } from "crypto";
import type { FiscalDriver, FiscalizeInput, FiscalizeResult } from "../types";

export class CybernetFiscalDriverStub implements FiscalDriver {
  readonly name = "cybernet";

  async fiscalize(input: FiscalizeInput): Promise<FiscalizeResult> {
    const id = `CYB-${randomUUID().slice(0, 8)}`;
    return {
      receiptId: id,
      qrPayload: `cybernet://receipt/${id}`,
      driver: this.name,
    };
  }
}
