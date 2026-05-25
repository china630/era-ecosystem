import { Injectable, Logger } from "@nestjs/common";

export type WhatsappSendInput = {
  to: string;
  body: string;
};

export type WhatsappSendResult = {
  providerPayload: Record<string, unknown>;
};

@Injectable()
export class WhatsappAdapter {
  private readonly logger = new Logger(WhatsappAdapter.name);

  async send(input: WhatsappSendInput): Promise<WhatsappSendResult> {
    this.logger.log(
      `[stub] WhatsApp would be sent to ${input.to}: ${input.body.slice(0, 80)}`,
    );
    return {
      providerPayload: {
        stub: true,
        channel: "WHATSAPP",
        to: input.to,
      },
    };
  }
}
