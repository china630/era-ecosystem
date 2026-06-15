import { Injectable } from "@nestjs/common";
import { PaymentRail, type PaymentOrder } from "@era/bank-core-database";
import type { PaymentRailAdapter, RailSubmitResult } from "./payment-rail.adapter";

/** Simulated AZIPS / XÖHKS / AÖS / SWIFT ACK for dev UAT. */
@Injectable()
export class StubRailAdapter implements PaymentRailAdapter {
  supports(rail: PaymentRail): boolean {
    return rail !== PaymentRail.INTERNAL;
  }

  get rail(): PaymentRail {
    return PaymentRail.AZIPS;
  }

  async submit(order: PaymentOrder): Promise<RailSubmitResult> {
    return {
      accepted: true,
      processorRef: `stub-${order.rail}-${order.id}`,
      payload: {
        stub: true,
        rail: order.rail,
        iso20022: "pacs.008 stub",
        simulatedAck: true,
      },
    };
  }
}
