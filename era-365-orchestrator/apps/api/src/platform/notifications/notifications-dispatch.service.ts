import {
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  NotificationChannel,
  NotificationOutboxStatus,
  Prisma,
} from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { QuotaService } from "../../quota/quota.service";
import { EmailAdapter } from "./adapters/email.adapter";
import { SmsAdapter } from "./adapters/sms.adapter";
import { WhatsappAdapter } from "./adapters/whatsapp.adapter";

@Injectable()
export class NotificationsDispatchService {
  private readonly logger = new Logger(NotificationsDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    private readonly emailAdapter: EmailAdapter,
    private readonly whatsappAdapter: WhatsappAdapter,
    private readonly smsAdapter: SmsAdapter,
  ) {}

  async processPendingBatch(limit = 25): Promise<number> {
    const pending = await this.prisma.notificationOutbox.findMany({
      where: { status: NotificationOutboxStatus.PENDING },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    let processed = 0;
    for (const row of pending) {
      await this.dispatchOutboxEntry(row.organizationId, row.id);
      processed++;
    }
    return processed;
  }

  async dispatchOutboxEntry(
    organizationId: string,
    outboxId: string,
  ): Promise<void> {
    const entry = await this.prisma.notificationOutbox.findFirst({
      where: { id: outboxId, organizationId },
      include: { template: true },
    });
    if (!entry) {
      throw new NotFoundException("Outbox entry not found");
    }
    if (entry.status === NotificationOutboxStatus.SENT) {
      return;
    }

    if (entry.channel === NotificationChannel.WHATSAPP) {
      await this.quota.assertWhatsappQuota(organizationId);
    }

    const payload =
      entry.payload != null && typeof entry.payload === "object"
        ? (entry.payload as Record<string, unknown>)
        : {};
    const subject =
      typeof payload.subject === "string"
        ? payload.subject
        : (entry.template?.subject ?? entry.templateKey);
    const body =
      typeof payload.body === "string"
        ? payload.body
        : (entry.template?.bodyTemplate ?? "");

    try {
      const providerPayload = await this.dispatchChannel(entry.channel, {
        recipient: entry.recipient,
        subject,
        body,
      });
      await this.prisma.$transaction(async (tx) => {
        await tx.notificationOutbox.update({
          where: { id: entry.id },
          data: {
            status: NotificationOutboxStatus.SENT,
            sentAt: new Date(),
            errorMessage: null,
          },
        });
        await tx.notificationDeliveryLog.create({
          data: {
            outboxId: entry.id,
            organizationId,
            channel: entry.channel,
            status: NotificationOutboxStatus.SENT,
            providerPayload: providerPayload as Prisma.InputJsonValue,
          },
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Outbox ${entry.id} dispatch failed: ${message}`);
      await this.prisma.$transaction(async (tx) => {
        await tx.notificationOutbox.update({
          where: { id: entry.id },
          data: {
            status: NotificationOutboxStatus.FAILED,
            errorMessage: message,
          },
        });
        await tx.notificationDeliveryLog.create({
          data: {
            outboxId: entry.id,
            organizationId,
            channel: entry.channel,
            status: NotificationOutboxStatus.FAILED,
            errorMessage: message,
          },
        });
      });
      throw err;
    }
  }

  async applyProviderWebhook(
    outboxId: string,
    status: NotificationOutboxStatus,
    providerPayload?: Record<string, unknown>,
    errorMessage?: string,
  ): Promise<void> {
    const entry = await this.prisma.notificationOutbox.findUnique({
      where: { id: outboxId },
    });
    if (!entry) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.notificationOutbox.update({
        where: { id: outboxId },
        data: {
          status,
          sentAt: status === NotificationOutboxStatus.SENT ? new Date() : null,
          errorMessage: errorMessage ?? null,
        },
      });
      await tx.notificationDeliveryLog.create({
        data: {
          outboxId,
          organizationId: entry.organizationId,
          channel: entry.channel,
          status,
          providerPayload: (providerPayload ?? {}) as Prisma.InputJsonValue,
          errorMessage: errorMessage ?? null,
        },
      });
    });
  }

  private async dispatchChannel(
    channel: NotificationChannel,
    input: { recipient: string; subject: string; body: string },
  ): Promise<Record<string, unknown>> {
    switch (channel) {
      case NotificationChannel.EMAIL: {
        const result = await this.emailAdapter.send({
          to: input.recipient,
          subject: input.subject,
          body: input.body,
        });
        return result.providerPayload;
      }
      case NotificationChannel.WHATSAPP: {
        const result = await this.whatsappAdapter.send({
          to: input.recipient,
          body: input.body,
        });
        return result.providerPayload;
      }
      case NotificationChannel.SMS: {
        const result = await this.smsAdapter.send({
          to: input.recipient,
          body: input.body,
        });
        return result.providerPayload;
      }
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }
}
