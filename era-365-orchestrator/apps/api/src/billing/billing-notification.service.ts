import { Injectable, Logger } from "@nestjs/common";
import { UserRole } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";

const DEMO_FINISHED_ACTION = "BILLING_DEMO_PERIOD_FINISHED_1ST";

function billingPeriodKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

@Injectable()
export class BillingNotificationService {
  private readonly logger = new Logger(BillingNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifyUpcomingInvoice(organizationId: string, now = new Date()): Promise<void> {
    await this.writeBillingNotification({
      organizationId,
      entityId: `${organizationId}:${billingPeriodKey(now)}`,
      action: "BILLING_UPCOMING_INVOICE_25TH",
      message:
        "Скоро будет выставлен ежемесячный счёт за платные модули ERA Finance.",
      now,
    });
  }

  async notifyDemoPeriodFinished(
    organizationId: string,
    now = new Date(),
  ): Promise<void> {
    await this.writeBillingNotification({
      organizationId,
      entityId: organizationId,
      action: DEMO_FINISHED_ACTION,
      message:
        "Ваш бесплатный входной период завершен. С 1-го числа начался платный период пользования.",
      now,
    });
  }

  private async writeBillingNotification(input: {
    organizationId: string;
    entityId: string;
    action: string;
    message: string;
    now: Date;
  }): Promise<void> {
    const exists = await this.prisma.auditLog.findFirst({
      where: {
        organizationId: input.organizationId,
        entityType: "billing.notification",
        entityId: input.entityId,
        action: input.action,
      },
      select: { id: true },
    });
    if (exists) return;

    await this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: null,
        entityType: "billing.notification",
        entityId: input.entityId,
        action: input.action,
        newValues: {
          message: input.message,
          notifiedAt: input.now.toISOString(),
        },
      },
    });

    const owners = await this.prisma.organizationMembership.count({
      where: {
        organizationId: input.organizationId,
        role: { in: [UserRole.OWNER, UserRole.ACCOUNTANT] },
      },
    });
    this.logger.log(
      `${input.action}: audit logged for organization ${input.organizationId} (${owners} owner/accountant memberships)`,
    );
  }
}
