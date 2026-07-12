import {
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { UserRole } from "@erafinance/database";
import { OrchestratorHoldingsClientService } from "../orchestrator/orchestrator-holdings-client.service";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Централизованные проверки доступа (v10.3): биллинг, смена владельца и т.д.
 */
@Injectable()
export class AccessControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly holdingsCp: OrchestratorHoldingsClientService,
  ) {}

  /**
   * Раздел биллинга / подписки (оплата, смена плана, модули) — только OWNER.
   */
  async assertOwnerForBilling(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
    });
    if (!membership || membership.role !== UserRole.OWNER) {
      throw new ForbiddenException({
        code: "BILLING_OWNER_ONLY",
        message: "Billing is only available to the organization owner.",
      });
    }
  }

  /**
   * Смена владельца — инициатор должен быть OWNER текущей организации.
   */
  async assertCurrentUserIsOwner(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    await this.assertOwnerForBilling(userId, organizationId);
  }

  /**
   * Проведение учёта / касса / банк — не ниже бухгалтера (OWNER, ADMIN, ACCOUNTANT).
   */
  async assertMayPostAccounting(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
    });
    if (
      !membership ||
      (membership.role !== UserRole.OWNER &&
        membership.role !== UserRole.ADMIN &&
        membership.role !== UserRole.ACCOUNTANT)
    ) {
      throw new ForbiddenException({
        code: "ACCOUNTING_ROLE_REQUIRED",
        message:
          "This action requires organization role OWNER, ADMIN, or ACCOUNTANT.",
      });
    }
  }

  /**
   * Просмотр отчётности по холдингу — grant из control plane
   * (владелец холдинга или участник OWNER/ADMIN/ACCOUNTANT).
   */
  async assertMayViewHoldingReports(
    userId: string,
    holdingId: string,
  ): Promise<void> {
    const holding = await this.holdingsCp.getHoldingForUser(userId, holdingId);
    if (!holding.canViewReports) {
      throw new ForbiddenException({
        code: "HOLDING_ACCESS_DENIED",
        message: "No access to this holding.",
      });
    }
  }
}
