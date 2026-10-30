import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrgUnitStatus } from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceScopeService } from "./workforce-scope.service";

@Injectable()
export class WorkforceJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: WorkforceScopeService,
    private readonly audit: WorkforceAuditService,
  ) {}

  async listGrades(organizationId: string, status?: OrgUnitStatus) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    return this.prisma.workforceGrade.findMany({
      where: {
        workforceScopeId: link.workforceScopeId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ level: "asc" }, { code: "asc" }],
    });
  }

  async createGrade(
    organizationId: string,
    actorUserId: string,
    input: { code: string; name: string; level: number },
  ) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const code = input.code.trim();
    const name = input.name.trim();
    if (!code || !name) throw new BadRequestException("code and name required");
    if (!Number.isFinite(input.level)) {
      throw new BadRequestException("level required");
    }
    const row = await this.prisma.workforceGrade.create({
      data: {
        workforceScopeId: link.workforceScopeId,
        code,
        name,
        level: Math.floor(input.level),
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "GRADE_CREATED",
      entityType: "GRADE",
      entityId: row.id,
    });
    return row;
  }

  async updateGrade(
    organizationId: string,
    id: string,
    actorUserId: string,
    input: { code?: string; name?: string; level?: number },
  ) {
    const existing = await this.findGrade(organizationId, id);
    const row = await this.prisma.workforceGrade.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code.trim() } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.level !== undefined ? { level: Math.floor(input.level) } : {}),
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "GRADE_UPDATED",
      entityType: "GRADE",
      entityId: existing.id,
    });
    return row;
  }

  async archiveGrade(organizationId: string, id: string, actorUserId: string) {
    const existing = await this.findGrade(organizationId, id);
    if (existing.status === OrgUnitStatus.ARCHIVED) return existing;
    const jobCount = await this.prisma.workforceJob.count({
      where: { gradeId: id, status: OrgUnitStatus.ACTIVE },
    });
    if (jobCount > 0) {
      throw new BadRequestException({
        code: "GRADE_IN_USE",
        message: "Cannot archive grade while active jobs reference it",
      });
    }
    const row = await this.prisma.workforceGrade.update({
      where: { id },
      data: { status: OrgUnitStatus.ARCHIVED },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "GRADE_ARCHIVED",
      entityType: "GRADE",
      entityId: id,
    });
    return row;
  }

  async listJobs(organizationId: string, status?: OrgUnitStatus) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    return this.prisma.workforceJob.findMany({
      where: {
        workforceScopeId: link.workforceScopeId,
        ...(status ? { status } : {}),
      },
      include: { grade: true },
      orderBy: [{ name: "asc" }],
    });
  }

  async createJob(
    organizationId: string,
    actorUserId: string,
    input: {
      name: string;
      code?: string | null;
      jobFamily?: string | null;
      gradeId?: string | null;
    },
  ) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const name = input.name.trim();
    if (!name) throw new BadRequestException("name required");
    if (input.gradeId) {
      await this.findGrade(organizationId, input.gradeId);
    }
    const row = await this.prisma.workforceJob.create({
      data: {
        workforceScopeId: link.workforceScopeId,
        name,
        code: input.code?.trim() || null,
        jobFamily: input.jobFamily?.trim() || null,
        gradeId: input.gradeId || null,
      },
      include: { grade: true },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "JOB_CREATED",
      entityType: "JOB",
      entityId: row.id,
    });
    return row;
  }

  async updateJob(
    organizationId: string,
    id: string,
    actorUserId: string,
    input: {
      name?: string;
      code?: string | null;
      jobFamily?: string | null;
      gradeId?: string | null;
    },
  ) {
    await this.findJob(organizationId, id);
    if (input.gradeId) {
      await this.findGrade(organizationId, input.gradeId);
    }
    const row = await this.prisma.workforceJob.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.code !== undefined ? { code: input.code?.trim() || null } : {}),
        ...(input.jobFamily !== undefined
          ? { jobFamily: input.jobFamily?.trim() || null }
          : {}),
        ...(input.gradeId !== undefined ? { gradeId: input.gradeId || null } : {}),
      },
      include: { grade: true },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "JOB_UPDATED",
      entityType: "JOB",
      entityId: id,
    });
    return row;
  }

  async archiveJob(organizationId: string, id: string, actorUserId: string) {
    const existing = await this.findJob(organizationId, id);
    if (existing.status === OrgUnitStatus.ARCHIVED) return existing;
    await this.prisma.workforcePosition.updateMany({
      where: { jobId: id },
      data: { jobId: null },
    });
    const row = await this.prisma.workforceJob.update({
      where: { id },
      data: { status: OrgUnitStatus.ARCHIVED },
      include: { grade: true },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "JOB_ARCHIVED",
      entityType: "JOB",
      entityId: id,
    });
    return row;
  }

  async orgChart(
    organizationId: string,
    mode: "units" | "positions" | "people",
  ) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    if (mode === "units") {
      const rows = await this.prisma.orgUnit.findMany({
        where: {
          workforceScopeId: link.workforceScopeId,
          status: OrgUnitStatus.ACTIVE,
        },
        select: {
          id: true,
          parentId: true,
          name: true,
          unitKind: true,
          managerEmploymentId: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      return {
        mode,
        nodes: rows.map((r) => ({
          id: r.id,
          parentId: r.parentId,
          label: r.name,
          meta: { unitKind: r.unitKind, managerEmploymentId: r.managerEmploymentId },
        })),
      };
    }
    if (mode === "positions") {
      const rows = await this.prisma.workforcePosition.findMany({
        where: {
          status: OrgUnitStatus.ACTIVE,
          orgUnit: { workforceScopeId: link.workforceScopeId },
        },
        select: {
          id: true,
          parentPositionId: true,
          name: true,
          orgUnitId: true,
          leadership: true,
          jobId: true,
        },
        orderBy: [{ name: "asc" }],
      });
      return {
        mode,
        nodes: rows.map((r) => ({
          id: r.id,
          parentId: r.parentPositionId,
          label: r.name,
          meta: {
            orgUnitId: r.orgUnitId,
            leadership: r.leadership,
            jobId: r.jobId,
          },
        })),
      };
    }
    const emps = await this.prisma.workforceEmployment.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        managerEmploymentId: true,
        orgUnitId: true,
        positionId: true,
        globalPersonId: true,
        position: { select: { name: true } },
        orgUnit: { select: { name: true } },
      },
    });
    return {
      mode,
      nodes: emps.map((e) => ({
        id: e.id,
        parentId: e.managerEmploymentId,
        label: `${e.position.name} · ${e.orgUnit.name}`,
        meta: {
          orgUnitId: e.orgUnitId,
          positionId: e.positionId,
          globalPersonId: e.globalPersonId,
        },
      })),
    };
  }

  private async findGrade(organizationId: string, id: string) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const row = await this.prisma.workforceGrade.findFirst({
      where: { id, workforceScopeId: link.workforceScopeId },
    });
    if (!row) throw new NotFoundException("Grade not found");
    return row;
  }

  private async findJob(organizationId: string, id: string) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const row = await this.prisma.workforceJob.findFirst({
      where: { id, workforceScopeId: link.workforceScopeId },
    });
    if (!row) throw new NotFoundException("Job not found");
    return row;
  }
}
