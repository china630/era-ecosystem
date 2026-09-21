import { Injectable, Logger } from "@nestjs/common";
import {
  satelliteWorkforceEmploymentTransferredSchema,
  satelliteWorkforceOrgUnitArchivedSchema,
  satelliteWorkforceOrgUnitUpsertedSchema,
  satelliteWorkforcePositionUpsertedSchema,
} from "@era/contracts";
import { DepartmentSource, EmasContractEventType, Prisma } from "@erafinance/database";
import { EmasContractService } from "../hr/emas-contract.service";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { WorkforceMirrorMissingError } from "./workforce-mirror-missing.error";
import { WorkforceOrgEnsureService } from "./workforce-org-ensure.service";

@Injectable()
export class WorkforceOrgSyncService {
  private readonly logger = new Logger(WorkforceOrgSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly orgEnsure: WorkforceOrgEnsureService,
    private readonly emas: EmasContractService,
  ) {}

  async handleOrgUnitUpserted(
    organizationId: string,
    raw: unknown,
  ): Promise<{ meta?: Record<string, unknown> }> {
    if (!(await this.hasHrFull(organizationId))) {
      return { meta: { skipped: true, reason: "no_hr_full" } };
    }
    await this.orgEnsure.ensureOrganization(organizationId);
    const event = satelliteWorkforceOrgUnitUpsertedSchema.parse(raw);
    const p = event.payload;
    let parentId: string | null = null;
    if (p.parentCpOrgUnitId) {
      const parent = await this.prisma.department.findFirst({
        where: {
          organizationId,
          cpOrgUnitId: p.parentCpOrgUnitId,
          deletedAt: null,
        },
      });
      if (!parent) {
        this.logger.error(
          `Parent Department mirror missing for cpOrgUnit=${p.parentCpOrgUnitId} org=${organizationId} — retrying`,
        );
        throw new WorkforceMirrorMissingError(
          "parent_dept_mirror_missing",
          `parentCpOrgUnitId=${p.parentCpOrgUnitId}`,
        );
      }
      parentId = parent.id;
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
    await this.orgEnsure.ensureOrganization(organizationId);
    const event = satelliteWorkforcePositionUpsertedSchema.parse(raw);
    const p = event.payload;
    const dept = await this.prisma.department.findFirst({
      where: {
        organizationId,
        cpOrgUnitId: p.cpOrgUnitId,
        deletedAt: null,
      },
    });
    if (!dept) {
      this.logger.error(
        `Department mirror missing for cpOrgUnit=${p.cpOrgUnitId} org=${organizationId} — retrying`,
      );
      throw new WorkforceMirrorMissingError(
        "dept_mirror_missing",
        `cpOrgUnitId=${p.cpOrgUnitId}`,
      );
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
    // Prefer financeEmployeeId; fall back to cpEmploymentId (write-back race /
    // legacy employments without link). Same pattern as timesheet / absence.
    const employee = await this.prisma.employee.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          ...(p.financeEmployeeId?.trim()
            ? [{ id: p.financeEmployeeId.trim() }]
            : []),
          { cpEmploymentId: p.cpEmploymentId },
        ],
      },
    });
    if (!employee) {
      this.logger.error(
        `TRANSFER: Employee mirror missing org=${organizationId} cpEmployment=${p.cpEmploymentId} — retrying`,
      );
      throw new WorkforceMirrorMissingError(
        "employee_mirror_missing",
        `cpEmploymentId=${p.cpEmploymentId}`,
      );
    }
    const position = await this.prisma.jobPosition.findFirst({
      where: {
        cpPositionId: p.toPositionId,
        deletedAt: null,
        department: { organizationId, deletedAt: null },
      },
    });
    if (!position) {
      this.logger.error(
        `JobPosition mirror missing for transfer toPosition=${p.toPositionId} org=${organizationId} — retrying`,
      );
      throw new WorkforceMirrorMissingError(
        "position_mirror_missing",
        `toPositionId=${p.toPositionId}`,
      );
    }
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        positionId: position.id,
        cpEmploymentId: p.cpEmploymentId,
      },
    });
    try {
      await this.emas.enqueueManualLifecycle(
        organizationId,
        employee.id,
        EmasContractEventType.TRANSFER,
        {
          toPositionId: p.toPositionId,
          toPositionName: position.name,
        },
      );
    } catch (err) {
      this.logger.warn(
        `ƏMAS enqueue transfer failed emp=${employee.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return {
      meta: { employeeId: employee.id, cpEmploymentId: p.cpEmploymentId },
    };
  }

  private async hasHrFull(organizationId: string): Promise<boolean> {
    return this.subscriptionAccess.hasModule(
      organizationId,
      ModuleEntitlement.HR_FULL,
    );
  }
}
