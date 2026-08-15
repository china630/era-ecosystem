import { Injectable } from "@nestjs/common";
import { PaymentRail, type PaymentOrder } from "@era/bank-core-database";
import {
  assertLiveConfigured,
  railMode,
  ConfigError,
} from "../../integration/live-mode";
import {
  type PaymentRailAdapter,
  type RailSubmitResult,
} from "./payment-rail.adapter";

/** Simulated AZIPS / XÖHKS / AÖS / SWIFT ACK for lab. Live mode requires creds (YC-E1). */
@Injectable()
export class StubRailAdapter implements PaymentRailAdapter {
  supports(rail: PaymentRail): boolean {
    return rail !== PaymentRail.INTERNAL;
  }

  get rail(): PaymentRail {
    return PaymentRail.AZIPS;
  }

  async submit(order: PaymentOrder): Promise<RailSubmitResult> {
    const mode = railMode();
    if (mode === "live") {
      assertLiveConfigured(
        mode,
        {
          BANK_RAIL_BASE_URL: process.env.BANK_RAIL_BASE_URL,
          BANK_RAIL_API_KEY: process.env.BANK_RAIL_API_KEY,
        },
        "BANK_RAIL_MODE=live",
      );
      throw new ConfigError(
        "BANK_RAIL_MODE=live requires a live rail adapter (YC-E1)",
      );
    }
    return {
      accepted: true,
      processorRef: `stub-${order.rail}-${order.id}`,
      payload: {
        stub: true,
        railMode: mode,
        rail: order.rail,
        iso20022: "pacs.008 stub",
        simulatedAck: true,
      },
    };
  }
}
