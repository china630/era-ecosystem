import { createHash } from "node:crypto";
import { catalogAdapter, secretField, stringField } from "./_factory";
import type {
  AdapterContext,
  MessagingAdapter,
  OutboundMessage,
  ProviderManifest,
  TestResult,
} from "../types";

const manifest: ProviderManifest = {
  key: "email_imap_smtp",
  name: "Email IMAP/SMTP",
  category: "EMAIL",
  family: "imap_smtp",
  regions: ["AZ", "CIS", "GLOBAL"],
  tier: "P0",
  docsUrl: "https://www.rfc-editor.org/rfc/rfc5321",
  verified: "V",
  auth: "api_key",
  fields: [
    stringField("imapHost", { ru: "IMAP host", az: "IMAP host", en: "IMAP host" }, true),
    stringField("imapPort", { ru: "IMAP port", az: "IMAP port", en: "IMAP port" }),
    stringField("smtpHost", { ru: "SMTP host", az: "SMTP host", en: "SMTP host" }, true),
    stringField("smtpPort", { ru: "SMTP port", az: "SMTP port", en: "SMTP port" }),
    stringField("username", { ru: "Username", az: "Username", en: "Username" }, true),
    secretField("password", { ru: "Password", az: "Password", en: "Password" }),
    stringField("fromAddress", {
      ru: "From address",
      az: "From address",
      en: "From address",
    }),
  ],
  inbound: { mode: "polling", events: ["message"], verify: "n/a (IMAP poll)" },
  outbound: ["sendText"],
  capabilities: { media: false },
  rateLimit: { perSecond: 5 },
  setupSteps: {
    ru: ["IMAP/SMTP host + логин", "Проверить SMTP", "Включить (poller подтянет INBOX)"],
    en: ["IMAP/SMTP host + login", "Test SMTP", "Enable (poller fetches INBOX)"],
    az: ["IMAP/SMTP host + login", "SMTP yoxla", "Aktiv et"],
  },
  autoRegisterWebhook: false,
};

async function loadNodemailer(): Promise<typeof import("nodemailer")> {
  try {
    return await import("nodemailer");
  } catch {
    throw new Error(
      "nodemailer is required for email_imap_smtp (add dependency to host app)",
    );
  }
}

function smtpOpts(ctx: AdapterContext) {
  const host = String(ctx.config.smtpHost ?? "");
  const port = Number(ctx.config.smtpPort ?? 587);
  const user = String(ctx.config.username ?? ctx.secrets.username ?? "");
  const pass = String(ctx.secrets.password ?? "");
  return { host, port, user, pass, secure: port === 465 };
}

export const emailImapSmtpAdapter: MessagingAdapter = {
  ...catalogAdapter(manifest, {
    async testConnection(ctx): Promise<TestResult> {
      const opts = smtpOpts(ctx);
      if (!opts.host || !opts.user || !opts.pass) {
        return { ok: false, message: "smtpHost/username/password required" };
      }
      try {
        const nodemailer = await loadNodemailer();
        const transport = nodemailer.createTransport({
          host: opts.host,
          port: opts.port,
          secure: opts.secure,
          auth: { user: opts.user, pass: opts.pass },
        });
        await transport.verify();
        return { ok: true, message: "SMTP verify ok" };
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },
  }),
  async sendMessage(ctx: AdapterContext, msg: OutboundMessage) {
    const opts = smtpOpts(ctx);
    if (!opts.host || !opts.user || !opts.pass) {
      throw new Error("smtpHost/username/password required");
    }
    const from =
      String(ctx.config.fromAddress ?? "") || opts.user;
    const to = msg.chatId;
    if (!to.includes("@")) throw new Error("chatId must be an email address");
    const nodemailer = await loadNodemailer();
    const transport = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.secure,
      auth: { user: opts.user, pass: opts.pass },
    });
    const info = await transport.sendMail({
      from,
      to,
      subject: String(msg.payload?.subject ?? "Message from CRM"),
      text: msg.text ?? "",
      inReplyTo: msg.payload?.inReplyTo
        ? String(msg.payload.inReplyTo)
        : undefined,
      references: msg.payload?.references
        ? String(msg.payload.references)
        : undefined,
    });
    const externalId = String(info.messageId ?? createHash("sha1").update(`${to}:${Date.now()}`).digest("hex"));
    return { externalId, raw: info };
  },
};
