import { randomUUID } from "crypto";
import type { FiscalizeInput, FiscalizeResult } from "../types";
import { PartialFiscalDriver } from "./partial";

export class CybernetFiscalDriverStub extends PartialFiscalDriver {
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
