import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  NotificationChannel,
  NotificationOutboxStatus,
  Prisma,
} from "@era365/database";
import { QuotaService } from "../../quota/quota.service";
import { resolveOrganizationUuid } from "../../common/organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailAdapter } from "./adapters/email.adapter";
import { SmsAdapter } from "./adapters/sms.adapter";
import { WhatsappAdapter } from "./adapters/whatsapp.adapter";
import type { SendNotificationDto } from "./dto/send-notification.dto";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    private readonly emailAdapter: EmailAdapter,
    private readonly whatsappAdapter: WhatsappAdapter,
    private readonly smsAdapter: SmsAdapter,
  ) {}

  async send(organizationId: string, dto: SendNotificationDto) {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      throw new BadRequestException("Invalid organization id");
    }

    const existing = await this.prisma.notificationOutbox.findUnique({
      where: {
        organizationId_sourceEntityType_sourceEntityId_templateKey: {
          organizationId: orgId,
          sourceEntityType: dto.sourceEntityType,
          sourceEntityId: dto.sourceEntityId,
          templateKey: dto.templateKey,
        },
      },
    });
    if (existing) {
      return { outbox: existing, idempotent: true as const };
    }

    const template = await this.prisma.notificationTemplate.findFirst({
      where: {
        templateKey: dto.templateKey,
        channel: dto.channel,
        isActive: true,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      orderBy: { organizationId: "desc" },
    });

    if (dto.channel === NotificationChannel.WHATSAPP) {
      await this.quota.assertWhatsappQuota(orgId);
    }

    const body = dto.body ?? template?.bodyTemplate ?? "";
    const subject = dto.subject ?? template?.subject ?? dto.templateKey;
    if (!body.trim()) {
      throw new BadRequestException(
        "Notification body is required when no template body exists",
      );
    }

    const outbox = await this.prisma.notificationOutbox.create({
      data: {
        organizationId: orgId,
        templateKey: dto.templateKey,
        templateId: template?.id,
        messageClass: dto.messageClass,
        channel: dto.channel,
        recipient: dto.recipient,
        payload: (dto.payload ?? {}) as Prisma.InputJsonValue,
        sourceEntityType: dto.sourceEntityType,
        sourceEntityId: dto.sourceEntityId,
        status: NotificationOutboxStatus.PENDING,
      },
    });

    try {
      const providerPayload = await this.dispatch(dto.channel, {
        recipient: dto.recipient,
        subject,
        body,
      });

      const sent = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.notificationOutbox.update({
          where: { id: outbox.id },
          data: {
            status: NotificationOutboxStatus.SENT,
            sentAt: new Date(),
            errorMessage: null,
          },
        });
        await tx.notificationDeliveryLog.create({
          data: {
            outboxId: outbox.id,
            organizationId: orgId,
            channel: dto.channel,
            status: NotificationOutboxStatus.SENT,
            providerPayload: providerPayload as Prisma.InputJsonValue,
          },
        });
        return updated;
      });

      return { outbox: sent, idempotent: false as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Notification send failed for outbox ${outbox.id}: ${message}`);

      const failed = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.notificationOutbox.update({
          where: { id: outbox.id },
          data: {
            status: NotificationOutboxStatus.FAILED,
            errorMessage: message,
          },
        });
        await tx.notificationDeliveryLog.create({
          data: {
            outboxId: outbox.id,
            organizationId: orgId,
            channel: dto.channel,
            status: NotificationOutboxStatus.FAILED,
            errorMessage: message,
          },
        });
        return updated;
      });

      return { outbox: failed, idempotent: false as const };
    }
  }

  async listOutbox(
    organizationId: string,
    opts: { status?: NotificationOutboxStatus; limit?: number; offset?: number },
  ) {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      throw new BadRequestException("Invalid organization id");
    }

    const where: Prisma.NotificationOutboxWhereInput = {
      organizationId: orgId,
      ...(opts.status ? { status: opts.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notificationOutbox.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: opts.limit ?? 50,
        skip: opts.offset ?? 0,
        include: {
          deliveryLogs: {
            orderBy: { attemptedAt: "desc" },
            take: 5,
          },
        },
      }),
      this.prisma.notificationOutbox.count({ where }),
    ]);

    return { items, total, limit: opts.limit ?? 50, offset: opts.offset ?? 0 };
  }

  async getOutboxEntry(organizationId: string, outboxId: string) {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      throw new BadRequestException("Invalid organization id");
    }

    const entry = await this.prisma.notificationOutbox.findFirst({
      where: { id: outboxId, organizationId: orgId },
      include: {
        deliveryLogs: { orderBy: { attemptedAt: "desc" } },
        template: true,
      },
    });
    if (!entry) {
      throw new NotFoundException("Outbox entry not found");
    }
    return entry;
  }

  private async dispatch(
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
        throw new BadRequestException(`Unsupported channel: ${channel}`);
    }
  }
}
