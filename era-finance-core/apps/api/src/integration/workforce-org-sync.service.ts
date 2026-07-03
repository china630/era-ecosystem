import { Injectable, Logger } from "@nestjs/common";
import {
  satelliteWorkforceEmploymentTransferredSchema,
  satelliteWorkforceOrgUnitArchivedSchema,
  satelliteWorkforceOrgUnitUpsertedSchema,
  satelliteWorkforcePositionUpsertedSchema,
} from "@era/contracts";
import { DepartmentSource, Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";

@Injectable()
export class WorkforceOrgSyncService {
  private readonly logger = new Logger(WorkforceOrgSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async handleOrgUnitUpserted(
    organizationId: string,
    raw: unknown,
  ): Promise<{ meta?: Record<string, unknown> }> {
    if (!(await this.hasHrFull(organizationId))) {
      return { meta: { skipped: true, reason: "no_hr_full" } };
    }
    const event = satelliteWorkforceOrgUnitUpsertedSchema.parse(raw);
    const p = event.payload;
    let parentId: string | null = null;
    if (p.parentCpOrgUnitId) {
      const parent = await this.prisma.department.findFirst({
        where: { organizationId, cpOrgUnitId: p.parentCpOrgUnitId },
      });
      parentId = parent?.id ?? null;
    }
    const row = await this.prisma.department.upsert({
      where: { cpOrgUnitId: p.cpOrgUnitId },
      create: {
        organizationId,
        name: p.name,
        parentId,
        cpOrgUnitId: p.cpOrgUnitId,
        costCenterCode: p.costCenterCode ?? p.code ?? p.cpOrgUnitId.slice(0, 8),
        managerEmploymentId: p.managerEmploymentId ?? null,
        source: DepartmentSource.CP_EVENT,
      },
      update: {
        name: p.name,
        parentId,
        costCenterCode: p.costCenterCode ?? p.code ?? p.cpOrgUnitId.slice(0, 8),
        managerEmploymentId: p.managerEmploymentId ?? null,
        deletedAt: null,
        deletedReason: null,
        source: DepartmentSource.CP_EVENT,
      },
    });
    return { meta: { departmentId: row.id, cpOrgUnitId: p.cpOrgUnitId } };
  }

  async handleOrgUnitArchived(
    organizationId: string,
    raw: unknown,
  ): Promise<{ meta?: Record<string, unknown> }> {
    if (!(await this.hasHrFull(organizationId))) {
      return { meta: { skipped: true, reason: "no_hr_full" } };
    }
    const event = satelliteWorkforceOrgUnitArchivedSchema.parse(raw);
    const existing = await this.prisma.department.findFirst({
      where: { organizationId, cpOrgUnitId: event.payload.cpOrgUnitId },
    });
    if (!existing) return { meta: { skipped: true } };
    await this.prisma.department.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        deletedReason: "CP_ARCHIVED",
      },
    });
    return { meta: { cpOrgUnitId: event.payload.cpOrgUnitId } };
  }

  async handlePositionUpserted(
    organizationId: string,
    raw: unknown,
  ): Promise<{ meta?: Record<string, unknown> }> {
    if (!(await this.hasHrFull(organizationId))) {
      return { meta: { skipped: true, reason: "no_hr_full" } };
    }
    const event = satelliteWorkforcePositionUpsertedSchema.parse(raw);
    const p = event.payload;
    const dept = await this.prisma.department.findFirst({
      where: { organizationId, cpOrgUnitId: p.cpOrgUnitId },
    });
    if (!dept) {
      this.logger.warn(`Department mirror missing for cpOrgUnit=${p.cpOrgUnitId}`);
      return { meta: { skipped: true, reason: "dept_mirror_missing" } };
    }
    const row = await this.prisma.jobPosition.upsert({
      where: { cpPositionId: p.cpPositionId },
      create: {
        departmentId: dept.id,
        name: p.name,
        jobTitleCode: p.code ?? null,
        totalSlots: p.totalSlots,
        minSalary: new Prisma.Decimal(0),
        maxSalary: new Prisma.Decimal(0),
        cpPositionId: p.cpPositionId,
        source: DepartmentSource.CP_EVENT,
      },
      update: {
        departmentId: dept.id,
        name: p.name,
        jobTitleCode: p.code ?? null,
        totalSlots: p.totalSlots,
        deletedAt: null,
        deletedReason: null,
        source: DepartmentSource.CP_EVENT,
      },
    });
    return { meta: { jobPositionId: row.id, cpPositionId: p.cpPositionId } };
  }

  async handleEmploymentTransferred(
    organizationId: string,
    raw: unknown,
  ): Promise<{ meta?: Record<string, unknown> }> {
    if (!(await this.hasHrFull(organizationId))) {
      return { meta: { skipped: true, reason: "no_hr_full" } };
    }
    const event = satelliteWorkforceEmploymentTransferredSchema.parse(raw);
    const p = event.payload;
    const employeeId = p.financeEmployeeId?.trim();
    if (!employeeId) {
      return { meta: { skipped: true, reason: "no_finance_employee" } };
    }
    const position = await this.prisma.jobPosition.findFirst({
      where: { cpPositionId: p.toPositionId },
    });
    if (!position) {
      return { meta: { skipped: true, reason: "position_mirror_missing" } };
    }
    await this.prisma.employee.updateMany({
      where: { id: employeeId, organizationId },
      data: {
        positionId: position.id,
        cpEmploymentId: p.cpEmploymentId,
      },
    });
    return { meta: { employeeId, cpEmploymentId: p.cpEmploymentId } };
  }

  private async hasHrFull(organizationId: string): Promise<boolean> {
    return this.subscriptionAccess.hasModule(
      organizationId,
      ModuleEntitlement.HR_FULL,
    );
  }
}
