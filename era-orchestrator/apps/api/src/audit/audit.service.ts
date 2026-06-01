import { Injectable } from "@nestjs/common";
import type { Prisma } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import { DataMaskingService } from "../privacy/data-masking.service";

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataMasking: DataMaskingService,
  ) {}

  async logPlatformBillingPaymentApplied(
    tx: Prisma.TransactionClient,
    orderId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const exists = await tx.auditLog.findFirst({
      where: {
        entityType: "platform.billing.payment_applied",
        entityId: orderId,
      },
      select: { id: true },
    });
    if (exists) return;
    await tx.auditLog.create({
      data: {
        organizationId: null,
        userId: null,
        entityType: "platform.billing.payment_applied",
        entityId: orderId,
        action: "webhook",
        newValues: this.dataMasking.maskDeep(payload) as object,
      },
    });
  }
}
