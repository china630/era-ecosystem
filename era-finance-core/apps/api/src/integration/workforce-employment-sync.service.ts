import { Injectable, Logger } from "@nestjs/common";
import { satelliteWorkforceEmploymentHiredSchema } from "@era/contracts";
import { Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";

@Injectable()
export class WorkforceEmploymentSyncService {
  private readonly logger = new Logger(WorkforceEmploymentSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async handleHired(
    organizationId: string,
    raw: unknown,
  ): Promise<{ meta?: Record<string, unknown> }> {
    if (!(await this.hasHrFull(organizationId))) {
      return { meta: { skipped: true, reason: "no_hr_full" } };
    }
    const event = satelliteWorkforceEmploymentHiredSchema.parse(raw);
    const p = event.payload;
    const existing = await this.prisma.employee.findFirst({
      where: { organizationId, cpEmploymentId: p.cpEmploymentId },
    });
    if (existing) {
      return { meta: { employeeId: existing.id, skipped: true, reason: "exists" } };
    }
    const position = await this.prisma.jobPosition.findFirst({
      where: { cpPositionId: p.positionId },
    });
    if (!position) {
      this.logger.warn(`JobPosition mirror missing for cpPosition=${p.positionId}`);
      return { meta: { skipped: true, reason: "position_mirror_missing" } };
    }
    const row = await this.prisma.employee.create({
      data: {
        organizationId,
        cpEmploymentId: p.cpEmploymentId,
        globalPersonId: p.globalPersonId,
        positionId: position.id,
        hireDate: new Date(`${p.hireDate}T00:00:00.000Z`),
        startDate: new Date(`${p.hireDate}T00:00:00.000Z`),
        salary: new Prisma.Decimal(0),
        initialVacationDays: new Prisma.Decimal(0),
        initialSalaryBalance: new Prisma.Decimal(0),
      },
    });
    return { meta: { employeeId: row.id, cpEmploymentId: p.cpEmploymentId } };
  }

  private async hasHrFull(organizationId: string): Promise<boolean> {
    return this.subscriptionAccess.hasModule(
      organizationId,
      ModuleEntitlement.HR_FULL,
    );
  }
}
