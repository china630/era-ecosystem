import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WORKFORCE_POSITION_UPSERTED } from "@era/contracts";
import { OrgUnitStatus, Prisma, WorkforceEmploymentStatus } from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { SatelliteEventsService } from "../../satellite-events/satellite-events.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import type {
  CreateWorkforcePositionDto,
  UpdateWorkforcePositionDto,
} from "./dto/workforce-org.dto";

@Injectable()
export class WorkforcePositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: WorkforceScopeService,
    private readonly audit: WorkforceAuditService,
    private readonly satelliteEvents: SatelliteEventsService,
  ) {}

  async list(
    organizationId: string,
    orgUnitId?: string,
    status?: OrgUnitStatus,
  ) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    return this.prisma.workforcePosition.findMany({
      where: {
        ...(orgUnitId
          ? { orgUnitId }
          : { orgUnit: { workforceScopeId: link.workforceScopeId } }),
        ...(status ? { status } : {}),
      },
      include: {
        orgUnit: true,
        job: { select: { id: true, name: true, code: true } },
        _count: {
          select: {
            employments: {
              where: { status: WorkforceEmploymentStatus.ACTIVE },
            },
          },
        },
      },
      orderBy: [{ orgUnitId: "asc" }, { name: "asc" }],
    });
  }

  async archive(organizationId: string, id: string, actorUserId: string) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const existing = await this.prisma.workforcePosition.findFirst({
      where: {
        id,
        orgUnit: { workforceScopeId: link.workforceScopeId },
      },
    });
    if (!existing) throw new NotFoundException("Position not found");
    if (existing.status === OrgUnitStatus.ARCHIVED) {
      return existing;
    }
    const activeEmployments = await this.prisma.workforceEmployment.count({
      where: {
        positionId: id,
        status: WorkforceEmploymentStatus.ACTIVE,
      },
    });
    if (activeEmployments > 0) {
      throw new BadRequestException(
        "Cannot archive position with active employments",
      );
    }
    const row = await this.prisma.workforcePosition.update({
      where: { id },
      data: { status: OrgUnitStatus.ARCHIVED },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "POSITION_ARCHIVED",
      entityType: "POSITION",
      entityId: id,
    });
    await this.emitUpsert(link.workforceScope.anchorOrganizationId, row);
    return row;
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateWorkforcePositionDto,
  ) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const unit = await this.prisma.orgUnit.findFirst({
      where: { id: dto.orgUnitId, workforceScopeId: link.workforceScopeId },
    });
    if (!unit || unit.status !== OrgUnitStatus.ACTIVE) {
      throw new NotFoundException("OrgUnit not found");
    }
    if (dto.jobId) {
      await this.assertJobInScope(dto.jobId, link.workforceScopeId);
    }
    if (dto.parentPositionId) {
      await this.assertParentInScope(
        dto.parentPositionId,
        link.workforceScopeId,
        null,
      );
    }
    const row = await this.prisma.workforcePosition.create({
      data: {
        orgUnitId: dto.orgUnitId,
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
        totalSlots: dto.totalSlots ?? 1,
        leadership: dto.leadership === true,
        tariffAzn: money(dto.tariffAzn),
        defaultWorkRegime: dto.defaultWorkRegime ?? null,
        weeklyHours: money(dto.weeklyHours),
        jobId: dto.jobId ?? null,
        parentPositionId: dto.parentPositionId ?? null,
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "POSITION_CREATED",
      entityType: "POSITION",
      entityId: row.id,
    });
    await this.emitUpsert(link.workforceScope.anchorOrganizationId, row);
    return row;
  }

  async update(
    organizationId: string,
    id: string,
    actorUserId: string,
    dto: UpdateWorkforcePositionDto,
  ) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const existing = await this.prisma.workforcePosition.findFirst({
      where: {
        id,
        orgUnit: { workforceScopeId: link.workforceScopeId },
      },
    });
    if (!existing) throw new NotFoundException("Position not found");
    if (dto.totalSlots != null && dto.totalSlots < existing.totalSlots) {
      const used = await this.prisma.workforceEmployment.count({
        where: {
          positionId: id,
          status: WorkforceEmploymentStatus.ACTIVE,
        },
      });
      if (used > dto.totalSlots) {
        throw new BadRequestException("totalSlots below active employments");
      }
    }
    if (dto.jobId) {
      await this.assertJobInScope(dto.jobId, link.workforceScopeId);
    }
    if (dto.parentPositionId !== undefined && dto.parentPositionId) {
      await this.assertParentInScope(
        dto.parentPositionId,
        link.workforceScopeId,
        id,
      );
    }
    const row = await this.prisma.workforcePosition.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code?.trim() || null } : {}),
        ...(dto.totalSlots != null ? { totalSlots: dto.totalSlots } : {}),
        ...(dto.leadership !== undefined ? { leadership: dto.leadership === true } : {}),
        ...(dto.tariffAzn !== undefined ? { tariffAzn: money(dto.tariffAzn) } : {}),
        ...(dto.defaultWorkRegime !== undefined
          ? { defaultWorkRegime: dto.defaultWorkRegime ?? null }
          : {}),
        ...(dto.weeklyHours !== undefined ? { weeklyHours: money(dto.weeklyHours) } : {}),
        ...(dto.jobId !== undefined ? { jobId: dto.jobId } : {}),
        ...(dto.parentPositionId !== undefined
          ? { parentPositionId: dto.parentPositionId }
          : {}),
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "POSITION_UPDATED",
      entityType: "POSITION",
      entityId: id,
    });
    await this.emitUpsert(link.workforceScope.anchorOrganizationId, row);
    return row;
  }

  async assertSlotAvailable(positionId: string): Promise<void> {
    const pos = await this.prisma.workforcePosition.findUnique({
      where: { id: positionId },
    });
    if (!pos || pos.status !== OrgUnitStatus.ACTIVE) {
      throw new BadRequestException("Position not available");
    }
    const used = await this.prisma.workforceEmployment.count({
      where: {
        positionId,
        status: WorkforceEmploymentStatus.ACTIVE,
      },
    });
    if (used >= pos.totalSlots) {
      throw new BadRequestException({
        code: "POSITION_SLOTS_FULL",
        message: "No vacant slots on this position",
      });
    }
  }

  private async assertJobInScope(jobId: string, workforceScopeId: string) {
    const job = await this.prisma.workforceJob.findFirst({
      where: { id: jobId, workforceScopeId, status: OrgUnitStatus.ACTIVE },
    });
    if (!job) throw new BadRequestException("Job not found in scope");
  }

  private async assertParentInScope(
    parentId: string,
    workforceScopeId: string,
    selfId: string | null,
  ) {
    if (selfId && parentId === selfId) {
      throw new BadRequestException("Position cannot be its own parent");
    }
    const parent = await this.prisma.workforcePosition.findFirst({
      where: {
        id: parentId,
        orgUnit: { workforceScopeId },
        status: OrgUnitStatus.ACTIVE,
      },
      select: { id: true, parentPositionId: true },
    });
    if (!parent) throw new BadRequestException("Parent position not found");
    if (!selfId) return;
    let cur: string | null = parent.parentPositionId;
    for (let i = 0; i < 64 && cur; i += 1) {
      if (cur === selfId) {
        throw new BadRequestException("Position parent cycle");
      }
      const next = await this.prisma.workforcePosition.findUnique({
        where: { id: cur },
        select: { parentPositionId: true },
      });
      cur = next?.parentPositionId ?? null;
    }
  }

  private async emitUpsert(
    anchorOrganizationId: string,
    row: {
      id: string;
      orgUnitId: string;
      name: string;
      code: string | null;
      totalSlots: number;
      jobId?: string | null;
      parentPositionId?: string | null;
    },
  ) {
    await this.satelliteEvents.enqueue({
      type: WORKFORCE_POSITION_UPSERTED,
      organizationId: anchorOrganizationId,
      correlationId: `${row.id}:UPSERT:${Date.now()}`,
      occurredAt: new Date().toISOString(),
      payload: {
        cpPositionId: row.id,
        cpOrgUnitId: row.orgUnitId,
        organizationId: anchorOrganizationId,
        name: row.name,
        code: row.code ?? undefined,
        totalSlots: row.totalSlots,
        jobId: row.jobId ?? undefined,
        parentPositionId: row.parentPositionId ?? undefined,
      },
    });
  }
}

function money(value: number | null | undefined): Prisma.Decimal | null {
  if (value == null || !(value > 0)) return null;
  return new Prisma.Decimal(value);
}
