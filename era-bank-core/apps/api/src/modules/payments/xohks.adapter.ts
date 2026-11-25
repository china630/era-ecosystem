import { Injectable } from "@nestjs/common";
import { PaymentRail, type PaymentOrder } from "@era/bank-core-database";
import type { PaymentRailAdapter, RailSubmitResult } from "./payment-rail.adapter";
import { submitExternalRailStub } from "./rail-stub.submit";

/** XÖHKS (large-value / RTGS-style) — ISO 20022 pacs.008 scaffold. */
@Injectable()
export class XohksRailAdapter implements PaymentRailAdapter {
  readonly rail = PaymentRail.XOHKS;

  submit(order: PaymentOrder): Promise<RailSubmitResult> {
    return submitExternalRailStub(order, PaymentRail.XOHKS, "pacs.008 xohks stub");
  }
}