import { Injectable } from "@nestjs/common";
import { PaymentRail, type PaymentOrder } from "@era/bank-core-database";
import type { PaymentRailAdapter, RailSubmitResult } from "./payment-rail.adapter";
import { submitExternalRailStub } from "./rail-stub.submit";

/** Fallback external-rail stub when no dedicated adapter is registered. */
@Injectable()
export class StubRailAdapter implements PaymentRailAdapter {
  readonly rail = PaymentRail.AZIPS;

  submit(order: PaymentOrder): Promise<RailSubmitResult> {
    const rail = order.rail ?? PaymentRail.AZIPS;
    return submitExternalRailStub(order, rail, "pacs.008 stub");
  }
}