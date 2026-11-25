import { Injectable } from "@nestjs/common";
import { PaymentRail, type PaymentOrder } from "@era/bank-core-database";
import type { PaymentRailAdapter, RailSubmitResult } from "./payment-rail.adapter";
import { submitExternalRailStub } from "./rail-stub.submit";

/** SWIFT cross-border — ISO 20022 pacs.008 scaffold. */
@Injectable()
export class SwiftRailAdapter implements PaymentRailAdapter {
  readonly rail = PaymentRail.SWIFT;

  submit(order: PaymentOrder): Promise<RailSubmitResult> {
    return submitExternalRailStub(order, PaymentRail.SWIFT, "pacs.008 swift stub");
  }
}