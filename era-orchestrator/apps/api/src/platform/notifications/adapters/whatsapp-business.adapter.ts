import { Injectable, Logger } from "@nestjs/common";

export type WhatsappBusinessSendInput = {
  to: string;
  body: string;
  templateName?: string;
  /** Optional tenant WABA (CRM connection) — preferred over ENV. */
  accessToken?: string;
  phoneNumberId?: string;
  graphVersion?: string;
};

/**
 * Platform WhatsApp sender (T-I10). Prefer tenant credentials from CRM;
 * ENV only as non-prod fallback. Never return silent stub success on HTTP failure.
 */
@Injectable()
export class WhatsappBusinessAdapter {
  private readonly logger = new Logger(WhatsappBusinessAdapter.name);

  async send(input: WhatsappBusinessSendInput): Promise<Record<string, unknown>> {
    const token =
      input.accessToken?.trim() ||
      process.env.WHATSAPP_BUSINESS_TOKEN?.trim() ||
      "";
    const phoneId =
      input.phoneNumberId?.trim() ||
      process.env.WHATSAPP_BUSINESS_PHONE_ID?.trim() ||
      "";
    const versionRaw =
      input.graphVersion?.trim() ||
      process.env.WHATSAPP_GRAPH_VERSION?.trim() ||
      "v21.0";
    const version = versionRaw.startsWith("v") ? versionRaw : `v${versionRaw}`;

    if (!token || !phoneId) {
      if (process.env.NODE_ENV === "production") {
        this.logger.error(
          "WhatsApp send refused: missing tenant or ENV credentials in production",
        );
        return {
          channel: "WHATSAPP_BUSINESS",
          ok: false,
          error: "missing_credentials",
        };
      }
      this.logger.warn(
        `[dev-fallback] WhatsApp Business missing creds → ${input.to}: ${input.body.slice(0, 80)}`,
      );
      return {
        channel: "WHATSAPP_BUSINESS",
        ok: false,
        stub: true,
        error: "missing_credentials_dev",
        to: input.to,
        templateName: input.templateName ?? "default",
      };
    }

    if (!input.accessToken && process.env.WHATSAPP_BUSINESS_TOKEN) {
      this.logger.warn(
        "WhatsApp send using platform ENV credentials — migrate tenant to CRM whatsapp_cloud connection",
      );
    }

    const res = await fetch(
      `https://graph.facebook.com/${version}/${phoneId}/messages`,
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
    ).catch((err: unknown) => {
      this.logger.error(
        `WhatsApp Graph fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    });

    if (!res) {
      return {
        channel: "WHATSAPP_BUSINESS",
        ok: false,
        error: "provider_network_error",
      };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      this.logger.error(`WhatsApp Graph HTTP ${res.status}: ${text.slice(0, 200)}`);
      return {
        channel: "WHATSAPP_BUSINESS",
        ok: false,
        error: "provider_http_error",
        status: res.status,
        body: text.slice(0, 500),
      };
    }
    const json = (await res.json()) as Record<string, unknown>;
    return { channel: "WHATSAPP_BUSINESS", ok: true, ...json };
  }
}
