import { type PaymentOrder, type PaymentRail } from "@era/bank-core-database";
import {
  assertLiveConfigured,
  ConfigError,
  railMode,
} from "../../integration/live-mode";
import type { RailSubmitResult } from "./payment-rail.adapter";

/** Shared stub/lab submit for external payment rails (YC-E1 live fail-closed). */
export async function submitExternalRailStub(
  order: PaymentOrder,
  rail: PaymentRail,
  iso20022Hint: string,
): Promise<RailSubmitResult> {
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
  // Lab path only — processorRef never looks like a live CBAR rail ACK.
  return {
    accepted: true,
    processorRef: `STUB-LAB-${rail}-${order.id}`,
    payload: {
      stub: true,
      live: false,
      labOnly: true,
      railMode: mode,
      rail,
      iso20022: iso20022Hint,
      simulatedAck: true,
      warning: "LAB_ONLY_NOT_LIVE_RAIL",
    },
  };
}