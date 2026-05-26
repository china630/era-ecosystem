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
import { PlatformEntitlementService } from "../platform-entitlement.service";
import type { SendNotificationDto } from "./dto/send-notification.dto";
import { NotificationsOutboxWorker } from "./notifications-outbox.worker";

const PLATFORM_NOTIFICATIONS = "platform_notifications";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    private readonly entitlement: PlatformEntitlementService,
    private readonly outboxWorker: NotificationsOutboxWorker,
  ) {}

  async send(organizationId: string, dto: SendNotificationDto) {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      throw new BadRequestException("Invalid organization id");
    }

    await this.entitlement.assertPlatformModule(orgId, PLATFORM_NOTIFICATIONS);

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
        payload: {
          ...(dto.payload ?? {}),
          subject,
          body,
        } as Prisma.InputJsonValue,
        sourceEntityType: dto.sourceEntityType,
        sourceEntityId: dto.sourceEntityId,
        status: NotificationOutboxStatus.PENDING,
      },
    });

    await this.outboxWorker.enqueueOutbox(outbox.id, orgId);

    return { outbox, idempotent: false as const };
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
}
