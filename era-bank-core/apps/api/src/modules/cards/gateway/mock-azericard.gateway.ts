import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

export type RegisterCardInput = {
  cardToken: string;
  panLast4: string;
  bin6: string;
  customerId: string;
};

@Injectable()
export class MockAzeriCardGateway {
  readonly name = "MOCK_AZERICARD" as const;

  registerCard(input: RegisterCardInput) {
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
    return Promise.resolve({ audited: true, gateway: this.name, payload });
  }
}
