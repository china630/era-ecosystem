import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WORKFORCE_POSITION_UPSERTED } from "@era/contracts";
import { OrgUnitStatus, WorkforceEmploymentStatus } from "@era365/database";
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
    const row = await this.prisma.workforcePosition.create({
      data: {
        orgUnitId: dto.orgUnitId,
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
        totalSlots: dto.totalSlots ?? 1,
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
    const row = await this.prisma.workforcePosition.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code?.trim() || null } : {}),
        ...(dto.totalSlots != null ? { totalSlots: dto.totalSlots } : {}),
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

  private async emitUpsert(
    anchorOrganizationId: string,
    row: { id: string; orgUnitId: string; name: string; code: string | null; totalSlots: number },
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
      },
    });
  }
}
