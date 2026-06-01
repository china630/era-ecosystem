import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

export type EmailSendInput = {
  to: string;
  subject: string;
  body: string;
};

export type EmailSendResult = {
  providerPayload: Record<string, unknown>;
};

@Injectable()
export class EmailAdapter {
  private readonly logger = new Logger(EmailAdapter.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>("SMTP_HOST")?.trim();
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>("SMTP_PORT") ?? "587"),
        secure:
          this.config.get<string>("SMTP_SECURE") === "1" ||
          this.config.get<string>("SMTP_SECURE") === "true",
        auth: {
          user: this.config.get<string>("SMTP_USER") ?? "",
          pass: this.config.get<string>("SMTP_PASS") ?? "",
        },
      });
    }
  }

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    if (!this.transporter) {
      this.logger.log(
        `[stub] Email would be sent to ${input.to}: ${input.subject}`,
      );
      return { providerPayload: { stub: true, channel: "EMAIL" } };
    }

    const from =
      this.config.get<string>("SMTP_FROM") ??
      this.config.get<string>("SMTP_USER") ??
      "no-reply@localhost";
    const info = await this.transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    this.logger.log(`Email sent to ${input.to}: ${input.subject}`);
    return {
      providerPayload: {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      },
    };
  }
}
