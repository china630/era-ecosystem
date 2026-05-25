import { Injectable, Logger } from "@nestjs/common";

export type SmsSendInput = {
  to: string;
  body: string;
};

export type SmsSendResult = {
  providerPayload: Record<string, unknown>;
};

@Injectable()
export class SmsAdapter {
  private readonly logger = new Logger(SmsAdapter.name);

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    this.logger.log(
      `[stub] SMS would be sent to ${input.to}: ${input.body.slice(0, 80)}`,
    );
    return {
      providerPayload: {
        stub: true,
        channel: "SMS",
        to: input.to,
      },
    };
  }
}
