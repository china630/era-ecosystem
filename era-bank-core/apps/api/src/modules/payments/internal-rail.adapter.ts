import { Injectable } from "@nestjs/common";
import { PaymentRail, type PaymentOrder } from "@era/bank-core-database";
import type { PaymentRailAdapter, RailSubmitResult } from "./payment-rail.adapter";

@Injectable()
export class InternalRailAdapter implements PaymentRailAdapter {
  readonly rail = PaymentRail.INTERNAL;

  async submit(order: PaymentOrder): Promise<RailSubmitResult> {
    return {
      accepted: true,
      processorRef: `int-${order.id}`,
      payload: { rail: "INTERNAL", iso20022: "internal.transfer", orderId: order.id },
    };
  }
}
