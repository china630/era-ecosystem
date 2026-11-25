import { Injectable } from "@nestjs/common";
import { PaymentRail, type PaymentOrder } from "@era/bank-core-database";
import type { PaymentRailAdapter, RailSubmitResult } from "./payment-rail.adapter";
import { submitExternalRailStub } from "./rail-stub.submit";

/** AÖS (instant payments 24/7) — ISO 20022 pacs.008 scaffold. */
@Injectable()
export class AosRailAdapter implements PaymentRailAdapter {
  readonly rail = PaymentRail.AOS;

  submit(order: PaymentOrder): Promise<RailSubmitResult> {
    return submitExternalRailStub(order, PaymentRail.AOS, "pacs.008 aos stub");
  }
}