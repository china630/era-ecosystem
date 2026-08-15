import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  assertLiveConfigured,
  cardsMode,
  ConfigError,
} from "../../../integration/live-mode";

export type RegisterCardInput = {
  cardToken: string;
  panLast4: string;
  bin6: string;
  customerId: string;
};

@Injectable()
export class MockAzeriCardGateway {
  readonly name = "MOCK_AZERICARD" as const;

  private assertStubMode() {
    const mode = cardsMode();
    if (mode === "live") {
      assertLiveConfigured(
        mode,
        {
          BANK_CARDS_BASE_URL: process.env.BANK_CARDS_BASE_URL,
          BANK_CARDS_API_KEY: process.env.BANK_CARDS_API_KEY,
        },
        "BANK_CARDS_MODE=live",
      );
      throw new ConfigError(
        "BANK_CARDS_MODE=live requires live card gateway (YC-E2)",
      );
    }
  }

  registerCard(input: RegisterCardInput) {
    this.assertStubMode();
    return Promise.resolve({
      processorToken: `azc_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      gateway: this.name,
      payload: {
        iso8583: "mock-register",
        panLast4: input.panLast4,
        bin6: input.bin6,
      },
    });
  }

  forwardAuthorize(payload: Record<string, unknown>) {
    this.assertStubMode();
    return Promise.resolve({ audited: true, gateway: this.name, payload });
  }
}
