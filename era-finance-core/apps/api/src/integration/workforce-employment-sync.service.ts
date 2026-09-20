import { Injectable, Logger } from "@nestjs/common";
import {
  satelliteWorkforceEmploymentHiredSchema,
  satelliteWorkforceEmploymentTerminatedSchema,
} from "@era/contracts";
import { EmployeeEmploymentStatus, EmasContractEventType, Prisma } from "@erafinance/database";
import { ControlPlaneClient } from "../control-plane/control-plane.client";
import { EmasContractService } from "../hr/emas-contract.service";
import { parseEmasMode } from "../hr/emas-mode";
import { OrchestratorMdmClientService } from "../orchestrator/orchestrator-mdm-client.service";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { WorkforceMirrorMissingError } from "./workforce-mirror-missing.error";
import { WorkforceOrgEnsureService } from "./workforce-org-ensure.service";

@Injectable()
export class WorkforceEmploymentSyncService {
  private readonly logger = new Logger(WorkforceEmploymentSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly orgEnsure: WorkforceOrgEnsureService,
    private readonly controlPlane: ControlPlaneClient,
    private readonly emas: EmasContractService,
    private readonly mdm: OrchestratorMdmClientService,
  ) {}

  async handleHired(
    organizationId: string,
    raw: unknown,
  ): Promise<{ meta?: Record<string, unknown> }> {
    if (!(await this.hasHrFull(organizationId))) {
      return { meta: { skipped: true, reason: "no_hr_full" } };
    }
    await this.orgEnsure.ensureOrganization(organizationId);

    const event = satelliteWorkforceEmploymentHiredSchema.parse(raw);
    const p = event.payload;
    const existing = await this.prisma.employee.findFirst({
      where: {
        organizationId,
        cpEmploymentId: p.cpEmploymentId,
        deletedAt: null,
      },
    });
    if (existing) {
      await this.linkFinanceEmployeeId(p.cpEmploymentId, existing.id);
      return {
        meta: { employeeId: existing.id, skipped: true, reason: "exists" },
      };
    }
    // Scope via department.organizationId so a dual-VÖEN tenant cannot attach
    // another org's position even if cpPositionId were ever shared by mistake.
    const position = await this.prisma.jobPosition.findFirst({
      where: {
        cpPositionId: p.positionId,
        deletedAt: null,
        department: { organizationId, deletedAt: null },
      },
    });
    if (!position) {
      this.logger.error(
        `JobPosition mirror missing for cpPosition=${p.positionId} org=${organizationId} — retrying`,
      );
      throw new WorkforceMirrorMissingError(
        "position_mirror_missing",
        `cpPositionId=${p.positionId}`,
      );
    }
    // SELECTIVE enqueue keys off emasEligible — must match Finance local hire (FIN present).
    let hasFin = false;
    try {
      const compliance = await this.mdm.complianceIdentity(
        p.globalPersonId,
        organizationId,
      );
      hasFin = Boolean(compliance?.fin);
    } catch (err) {
      this.logger.warn(
        `MDM complianceIdentity failed for hire gp=${p.globalPersonId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    const row = await this.prisma.employee.create({
      data: {
        organizationId,
        cpEmploymentId: p.cpEmploymentId,
        globalPersonId: p.globalPersonId,
        positionId: position.id,
        hireDate: new Date(`${p.hireDate}T00:00:00.000Z`),
        startDate: new Date(`${p.hireDate}T00:00:00.000Z`),
        // Contract salary arrives via later CP/Finance sync — never invent MGMT rate.
        salary: new Prisma.Decimal(0),
        emasEligible: hasFin,
        initialVacationDays: new Prisma.Decimal(0),
        initialSalaryBalance: new Prisma.Decimal(0),
      },
    });
    await this.linkFinanceEmployeeId(p.cpEmploymentId, row.id);
    let emasFinWarning = false;
    try {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
      });
      const mode = parseEmasMode(org?.settings);
      emasFinWarning = mode === "FULL" && !hasFin;
      await this.emas.enqueueManualLifecycle(
        organizationId,
        row.id,
        EmasContractEventType.HIRE,
      );
    } catch (err) {
      this.logger.warn(
        `ƏMAS enqueue hire failed emp=${row.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return {
      meta: {
        employeeId: row.id,
        cpEmploymentId: p.cpEmploymentId,
        emasEligible: hasFin,
        ...(emasFinWarning ? { emasFinWarning: true } : {}),
      },
    };
  }

  /**
   * Org-scoped terminate: only the Employee for this organizationId + cpEmploymentId.
   * A second VÖEN employment for the same globalPersonId is left ACTIVE.
   */
  async handleTerminated(
    organizationId: string,
    raw: unknown,
  ): Promise<{ meta?: Record<string, unknown> }> {
    if (!(await this.hasHrFull(organizationId))) {
      return { meta: { skipped: true, reason: "no_hr_full" } };
    }

    const event = satelliteWorkforceEmploymentTerminatedSchema.parse(raw);
    const p = event.payload;
    const terminateDay =
      event.occurredAt?.slice(0, 10) ||
      new Date().toISOString().slice(0, 10);

    let employee = await this.prisma.employee.findFirst({
      where: {
        organizationId,
        cpEmploymentId: p.cpEmploymentId,
        deletedAt: null,
      },
    });
    if (!employee && p.financeEmployeeId) {
      employee = await this.prisma.employee.findFirst({
        where: {
          organizationId,
          id: p.financeEmployeeId,
          deletedAt: null,
        },
      });
    }
    if (!employee) {
      this.logger.warn(
        `TERMINATED: no Employee for org=${organizationId} cpEmployment=${p.cpEmploymentId}`,
      );
      return { meta: { skipped: true, reason: "employee_not_found" } };
    }
    if (employee.employmentStatus === EmployeeEmploymentStatus.TERMINATED) {
      return {
        meta: {
          employeeId: employee.id,
          skipped: true,
          reason: "already_terminated",
        },
      };
    }

    await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        employmentStatus: EmployeeEmploymentStatus.TERMINATED,
        contractEndDate: new Date(`${terminateDay}T00:00:00.000Z`),
      },
    });
    try {
      await this.emas.enqueueManualLifecycle(
        organizationId,
        employee.id,
        EmasContractEventType.TERMINATE,
        { terminationDate: terminateDay },
      );
    } catch (err) {
      this.logger.warn(
        `ƏMAS enqueue terminate failed emp=${employee.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return {
      meta: {
        employeeId: employee.id,
        cpEmploymentId: p.cpEmploymentId,
        employmentStatus: EmployeeEmploymentStatus.TERMINATED,
      },
    };
  }

  private async linkFinanceEmployeeId(
    cpEmploymentId: string,
    financeEmployeeId: string,
  ): Promise<void> {
    try {
      await this.controlPlane.forward({
        method: "PATCH",
        path: `/internal/v1/workforce/employments/${encodeURIComponent(cpEmploymentId)}/finance-link`,
        body: { financeEmployeeId },
      });
    } catch (e) {
      this.logger.error(
        `Failed to write back financeEmployeeId=${financeEmployeeId} for cpEmployment=${cpEmploymentId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      throw e;
    }
  }

  private async hasHrFull(organizationId: string): Promise<boolean> {
    return this.subscriptionAccess.hasModule(
      organizationId,
      ModuleEntitlement.HR_FULL,
    );
  }
}
