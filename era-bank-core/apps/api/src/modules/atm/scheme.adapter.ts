import { Injectable } from "@nestjs/common";
import { cardsMode, assertLiveConfigured, ConfigError } from "../../integration/live-mode";

export type SchemeEnqueueResult = {
  accepted: boolean;
  outboxId?: string;
  processorRef: string;
  payload: Record<string, unknown>;
};

@Injectable()
export class SchemeSwitchAdapter {
  enqueue(messageType: string, payload: Record<string, unknown>): SchemeEnqueueResult {
    const mode = cardsMode();
    if (mode === "live") {
      assertLiveConfigured(
        mode,
        {
          BANK_SCHEME_BASE_URL: process.env.BANK_SCHEME_BASE_URL,
          BANK_SCHEME_API_KEY: process.env.BANK_SCHEME_API_KEY,
        },
        "BANK_CARDS_MODE=live scheme switch",
      );
      throw new ConfigError(
        "BANK_CARDS_MODE=live scheme adapter wiring pending YC-E2 partner sandbox",
      );
    }
    return {
      accepted: true,
      processorRef: `scheme-stub-${messageType}-${Date.now()}`,
      payload: { stub: true, cardsMode: mode, messageType, ...payload },
    };
  }
}
