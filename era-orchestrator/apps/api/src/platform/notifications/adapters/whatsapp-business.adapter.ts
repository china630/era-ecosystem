import { Injectable, Logger } from "@nestjs/common";

export type WhatsappBusinessSendInput = {
  to: string;
  body: string;
  templateName?: string;
};

@Injectable()
export class WhatsappBusinessAdapter {
  private readonly logger = new Logger(WhatsappBusinessAdapter.name);

  async send(input: WhatsappBusinessSendInput): Promise<Record<string, unknown>> {
    const token = process.env.WHATSAPP_BUSINESS_TOKEN;
    const phoneId = process.env.WHATSAPP_BUSINESS_PHONE_ID;
    if (!token || !phoneId) {
      this.logger.warn(
        `[live-stub] WhatsApp Business → ${input.to}: ${input.body.slice(0, 80)}`,
      );
      return {
        channel: "WHATSAPP_BUSINESS",
        stub: true,
        to: input.to,
        templateName: input.templateName ?? "default",
      };
    }
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: input.to.replace(/\D/g, ""),
          type: "text",
          text: { body: input.body },
        }),
      },
    ).catch(() => null);
    if (!res?.ok) {
      return { channel: "WHATSAPP_BUSINESS", error: "provider_http_error", stub: true };
    }
    return { channel: "WHATSAPP_BUSINESS", ...(await res.json()) };
  }
}
