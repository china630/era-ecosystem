import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma, WebhookOutboxStatus } from "@era/bank-core-database";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { signWebhookPayload } from "./webhook-signature.util";

export const WEBHOOK_EVENT_CATALOG = [
  "loan.disbursed",
  "payment.settled",
  "account.blocked",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_CATALOG)[number];

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 250, 1000];
/** Outbox backoff seconds by attempt index (lab). */
export const OUTBOX_BACKOFF_SEC = [0, 30, 120, 600];

@Injectable()
export class WebhooksService {
  private readonly log = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  list() {
    return this.prisma.webhookSubscription.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async subscribe(input: {
    url: string;
    events: string[];
    secret?: string;
    active?: boolean;
  }) {
    const url = input.url.trim();
    if (!url.startsWith("https://") && process.env.NODE_ENV === "production") {
      throw new BadRequestException("Webhook url must use https");
    }
    if (!/^https?:\/\//i.test(url)) {
      throw new BadRequestException("Webhook url must be http(s)");
    }
    const events = input.events.filter(Boolean);
    if (events.length === 0) {
      throw new BadRequestException("At least one event type is required");
    }
    const plainSecret = input.secret?.trim() || randomBytes(24).toString("hex");
    return this.prisma.webhookSubscription.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        url,
        secretEnc: plainSecret,
        eventsJson: events as Prisma.InputJsonValue,
        active: input.active ?? true,
      },
    });
  }

  /** Build signed delivery envelope (no HTTP). */
  async buildDeliveryStub(
    subscriptionId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const prepared = await this.prepareDelivery(subscriptionId, eventType, payload);
    return {
      ...prepared,
      delivered: false,
      note: "Signed envelope only — call deliver() for HTTP with retries.",
    };
  }

  /**
   * Deliver with HMAC signature and bounded retries (P2-2).
   * Honours BANK_WEBHOOK_DELIVER=0 to force dry-run in locked labs.
   */
  async deliver(
    subscriptionId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const prepared = await this.prepareDelivery(subscriptionId, eventType, payload);
    if (process.env.BANK_WEBHOOK_DELIVER === "0") {
      return {
        ...prepared,
        delivered: false,
        attempts: 0,
        note: "BANK_WEBHOOK_DELIVER=0 — dry run",
      };
    }

    let lastStatus = 0;
    let lastError = "";
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const delay = RETRY_DELAYS_MS[attempt] ?? 1000;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      try {
        const res = await fetch(prepared.url, {
          method: "POST",
          headers: prepared.headers,
          body: prepared.body,
        });
        lastStatus = res.status;
        if (res.ok) {
          return {
            ...prepared,
            delivered: true,
            attempts: attempt + 1,
            httpStatus: res.status,
          };
        }
        lastError = `HTTP ${res.status}`;
        this.log.warn(
          `Webhook delivery attempt ${attempt + 1} failed: ${lastError} url=${prepared.url}`,
        );
      } catch (err) {
        lastError = String(err);
        this.log.warn(
          `Webhook delivery attempt ${attempt + 1} network error: ${lastError}`,
        );
      }
    }

    return {
      ...prepared,
      delivered: false,
      attempts: MAX_ATTEMPTS,
      httpStatus: lastStatus || undefined,
      error: lastError || "delivery failed",
    };
  }

  /** Durable enqueue for partner event delivery (P2-2). */
  async enqueueOutbox(
    subscriptionId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const sub = await this.prisma.webhookSubscription.findFirst({
      where: {
        id: subscriptionId,
        bankOrgId: this.bankOrg.bankOrgId,
        active: true,
      },
    });
    if (!sub) throw new BadRequestException("Webhook subscription not found");
    const events = Array.isArray(sub.eventsJson)
      ? (sub.eventsJson as string[])
      : [];
    if (!events.includes(eventType)) {
      throw new BadRequestException(`Event ${eventType} not subscribed`);
    }
    return this.prisma.webhookDeliveryOutbox.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        subscriptionId,
        eventType,
        payloadJson: payload as Prisma.InputJsonValue,
        status: WebhookOutboxStatus.PENDING,
        nextAttemptAt: new Date(),
      },
    });
  }

  listOutbox(status?: WebhookOutboxStatus) {
    return this.prisma.webhookDeliveryOutbox.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /**
   * Drain pending outbox rows with HMAC deliver + exponential backoff.
   * Marks DEAD after MAX_ATTEMPTS failures.
   */
  async drainOutbox(limit = 20) {
    const due = await this.prisma.webhookDeliveryOutbox.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: {
          in: [WebhookOutboxStatus.PENDING, WebhookOutboxStatus.FAILED],
        },
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: Math.min(100, Math.max(1, limit)),
    });
    const results: Array<{
      id: string;
      status: string;
      delivered?: boolean;
      error?: string;
    }> = [];
    for (const row of due) {
      const payload =
        row.payloadJson && typeof row.payloadJson === "object"
          ? (row.payloadJson as Record<string, unknown>)
          : {};
      try {
        const delivery = await this.deliver(
          row.subscriptionId,
          row.eventType,
          payload,
        );
        if (delivery.delivered) {
          await this.prisma.webhookDeliveryOutbox.update({
            where: { id: row.id },
            data: {
              status: WebhookOutboxStatus.DELIVERED,
              attempts: row.attempts + 1,
              lastError: null,
            },
          });
          results.push({ id: row.id, status: "DELIVERED", delivered: true });
        } else {
          const attempts = row.attempts + 1;
          const dead = attempts >= MAX_ATTEMPTS;
          const backoff =
            OUTBOX_BACKOFF_SEC[Math.min(attempts, OUTBOX_BACKOFF_SEC.length - 1)] ??
            600;
          await this.prisma.webhookDeliveryOutbox.update({
            where: { id: row.id },
            data: {
              status: dead
                ? WebhookOutboxStatus.DEAD
                : WebhookOutboxStatus.FAILED,
              attempts,
              lastError:
                ("error" in delivery ? delivery.error : undefined) ??
                "delivery failed",
              nextAttemptAt: new Date(Date.now() + backoff * 1000),
            },
          });
          results.push({
            id: row.id,
            status: dead ? "DEAD" : "FAILED",
            delivered: false,
            error: "error" in delivery ? delivery.error : undefined,
          });
        }
      } catch (err) {
        const attempts = row.attempts + 1;
        const dead = attempts >= MAX_ATTEMPTS;
        await this.prisma.webhookDeliveryOutbox.update({
          where: { id: row.id },
          data: {
            status: dead ? WebhookOutboxStatus.DEAD : WebhookOutboxStatus.FAILED,
            attempts,
            lastError: String(err),
            nextAttemptAt: new Date(Date.now() + 120_000),
          },
        });
        results.push({
          id: row.id,
          status: dead ? "DEAD" : "FAILED",
          error: String(err),
        });
      }
    }
    return { drained: due.length, results };
  }

  private async prepareDelivery(
    subscriptionId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const sub = await this.prisma.webhookSubscription.findFirst({
      where: {
        id: subscriptionId,
        bankOrgId: this.bankOrg.bankOrgId,
        active: true,
      },
    });
    if (!sub) throw new BadRequestException("Webhook subscription not found");
    const events = Array.isArray(sub.eventsJson)
      ? (sub.eventsJson as string[])
      : [];
    if (!events.includes(eventType)) {
      throw new BadRequestException(`Event ${eventType} not subscribed`);
    }
    const secret = sub.secretEnc ?? "";
    const body = JSON.stringify({
      type: eventType,
      occurredAt: new Date().toISOString(),
      payload,
    });
    const signature = secret ? signWebhookPayload(secret, body) : "";
    return {
      url: sub.url,
      headers: {
        "Content-Type": "application/json",
        "X-Era-Bank-Signature": `sha256=${signature}`,
        "X-Era-Bank-Event": eventType,
      },
      body,
    };
  }
}
