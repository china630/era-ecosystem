import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WORKFORCE_EMPLOYMENT_TRANSFERRED } from "@era/contracts";
import { RoleBindingStatus, WorkforceEmploymentStatus } from "@era365/database";
import { MdmService } from "../../mdm/mdm.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SatelliteEventsService } from "../../satellite-events/satellite-events.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceOrgUnitsService } from "./workforce-org-units.service";
import { WorkforcePositionsService } from "./workforce-positions.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import type { CreateWorkforceEmploymentDto } from "./dto/workforce-employment.dto";
import type { TransferEmploymentDto } from "./dto/workforce-org.dto";

function parseDateOnly(iso: string): Date {
  const d = iso.slice(0, 10);
  return new Date(`${d}T00:00:00.000Z`);
}

/** List/detail payload for workspace Employments overflow (⋯ Reprovision) and satellite filter. */
const EMPLOYMENT_INCLUDE = {
  orgUnit: true,
  position: true,
  roleBindings: {
    where: { status: RoleBindingStatus.ACTIVE },
    select: { satelliteKey: true, satelliteRole: true },
  },
};

@Injectable()
export class WorkforceEmploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mdm: MdmService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly audit: WorkforceAuditService,
    private readonly scope: WorkforceScopeService,
    private readonly positions: WorkforcePositionsService,
    private readonly orgUnits: WorkforceOrgUnitsService,
    private readonly satelliteEvents: SatelliteEventsService,
  ) {}

  async list(
    organizationId: string,
    opts?: {
      status?: WorkforceEmploymentStatus;
      orgUnitId?: string;
      subtree?: boolean;
      orgUnitIds?: string[] | null;
    },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    let orgUnitFilter: { orgUnitId: { in: string[] } } | undefined;
    if (opts?.orgUnitIds != null) {
      if (opts.orgUnitIds.length === 0) return [];
      orgUnitFilter = { orgUnitId: { in: opts.orgUnitIds } };
    } else if (opts?.orgUnitId) {
      const ids = opts.subtree
        ? await this.orgUnits.collectSubtreeIds(opts.orgUnitId)
        : [opts.orgUnitId];
      orgUnitFilter = { orgUnitId: { in: ids } };
    }
    return this.prisma.workforceEmployment.findMany({
      where: {
        organizationId,
        ...(opts?.status ? { status: opts.status } : {}),
        ...(orgUnitFilter ?? {}),
      },
      include: EMPLOYMENT_INCLUDE,
      orderBy: [{ hireDate: "desc" }, { createdAt: "desc" }],
    });
  }

  async getOne(organizationId: string, id: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const row = await this.prisma.workforceEmployment.findFirst({
      where: { id, organizationId },
      include: EMPLOYMENT_INCLUDE,
    });
    if (!row) throw new NotFoundException("Employment not found");
    return row;
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateWorkforceEmploymentDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const globalPersonId = dto.globalPersonId.trim();
    await this.mdm.getPersonOpsProfile(globalPersonId, organizationId);

    const unit = await this.prisma.orgUnit.findFirst({
      where: {
        id: dto.orgUnitId,
        workforceScopeId: link.workforceScopeId,
        status: "ACTIVE",
      },
    });
    if (!unit) throw new BadRequestException("Invalid orgUnitId");

    await this.positions.assertSlotAvailable(dto.positionId);

    const hireDate = parseDateOnly(dto.hireDate);
    const row = await this.prisma.workforceEmployment.create({
      data: {
        organizationId,
        workforceScopeId: link.workforceScopeId,
        orgUnitId: dto.orgUnitId,
        positionId: dto.positionId,
        globalPersonId,
        hireDate,
        status: WorkforceEmploymentStatus.ACTIVE,
        commercialOrganizationId:
          dto.commercialOrganizationId?.trim() || organizationId,
        ...(dto.financeEmployeeId
          ? { financeEmployeeId: dto.financeEmployeeId }
          : {}),
      },
      include: { orgUnit: true, position: true },
    });

    await this.audit.log({
      organizationId,
      actorUserId,
      action: "EMPLOYMENT_CREATED",
      entityType: "EMPLOYMENT",
      entityId: row.id,
      payload: {
        globalPersonId,
        orgUnitId: dto.orgUnitId,
        positionId: dto.positionId,
      },
    });

    return row;
  }

  async transfer(
    organizationId: string,
    id: string,
    actorUserId: string,
    dto: TransferEmploymentDto,
  ) {
    const existing = await this.getOne(organizationId, id);
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);

    const unit = await this.prisma.orgUnit.findFirst({
      where: {
        id: dto.orgUnitId,
        workforceScopeId: link.workforceScopeId,
        status: "ACTIVE",
      },
    });
    if (!unit) throw new BadRequestException("Invalid orgUnitId");

    if (dto.positionId !== existing.positionId) {
      await this.positions.assertSlotAvailable(dto.positionId);
    }

    const updated = await this.prisma.workforceEmployment.update({
      where: { id },
      data: {
        orgUnitId: dto.orgUnitId,
        positionId: dto.positionId,
      },
      include: { orgUnit: true, position: true },
    });

    await this.audit.log({
      organizationId,
      actorUserId,
      action: "EMPLOYMENT_TRANSFERRED",
      entityType: "EMPLOYMENT",
      entityId: id,
      payload: dto as unknown as Record<string, unknown>,
    });

    await this.satelliteEvents.enqueue({
      type: WORKFORCE_EMPLOYMENT_TRANSFERRED,
      organizationId: link.workforceScope.anchorOrganizationId,
      correlationId: `${id}:TRANSFER:${Date.now()}`,
      occurredAt: new Date().toISOString(),
      globalPersonId: existing.globalPersonId,
      payload: {
        cpEmploymentId: id,
        organizationId: link.workforceScope.anchorOrganizationId,
        globalPersonId: existing.globalPersonId,
        ...(existing.financeEmployeeId
          ? { financeEmployeeId: existing.financeEmployeeId }
          : {}),
        fromOrgUnitId: existing.orgUnitId,
        toOrgUnitId: dto.orgUnitId,
        fromPositionId: existing.positionId,
        toPositionId: dto.positionId,
      },
    });

    return updated;
  }

  async resolvePersonProfiles(
    organizationId: string,
    globalPersonIds: string[],
  ): Promise<
    Record<
      string,
      {
        globalPersonId: string;
        displayName: string | null;
        finMasked: string | null;
        accessDenied: boolean;
        sex: string | null;
        birthDate: string | null;
      }
    >
  > {
    const profiles = await this.mdm.batchGetPersonOpsProfile(
      globalPersonIds,
      organizationId,
    );
    const out: Record<
      string,
      {
        globalPersonId: string;
        displayName: string | null;
        finMasked: string | null;
        accessDenied: boolean;
        sex: string | null;
        birthDate: string | null;
      }
    > = {};
    for (const [id, row] of Object.entries(profiles)) {
      out[id] = {
        globalPersonId: row.globalPersonId,
        displayName: row.displayName,
        finMasked: row.primaryIdentifierMasked,
        accessDenied: row.accessDenied,
        sex: row.sex,
        birthDate: row.birthDate,
      };
    }
    return out;
  }
}
