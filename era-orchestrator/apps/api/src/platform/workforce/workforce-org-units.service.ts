import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  WORKFORCE_ORG_UNIT_ARCHIVED,
  WORKFORCE_ORG_UNIT_UPSERTED,
} from "@era/contracts";
import { OrgUnitStatus } from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { SatelliteEventsService } from "../../satellite-events/satellite-events.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import type { CreateOrgUnitDto, UpdateOrgUnitDto } from "./dto/workforce-org.dto";

@Injectable()
export class WorkforceOrgUnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly scope: WorkforceScopeService,
    private readonly audit: WorkforceAuditService,
    private readonly satelliteEvents: SatelliteEventsService,
  ) {}

  async list(organizationId: string, flat = true) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const units = await this.prisma.orgUnit.findMany({
      where: { workforceScopeId: link.workforceScopeId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { employments: true, positions: true } } },
    });
    if (flat) return { items: units, scope: link.workforceScope };
    return { tree: buildTree(units), scope: link.workforceScope };
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateOrgUnitDto,
  ) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    if (dto.parentId) {
      await this.assertUnitInScope(dto.parentId, link.workforceScopeId);
      await this.assertNoCycle(dto.parentId, null);
    }
    const row = await this.prisma.orgUnit.create({
      data: {
        workforceScopeId: link.workforceScopeId,
        parentId: dto.parentId ?? null,
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ORG_UNIT_CREATED",
      entityType: "ORG_UNIT",
      entityId: row.id,
    });
    await this.emitUpsert(link.workforceScope, row);
    return row;
  }

  async update(
    organizationId: string,
    id: string,
    actorUserId: string,
    dto: UpdateOrgUnitDto,
  ) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const existing = await this.getInScope(id, link.workforceScopeId);
    if (dto.parentId !== undefined && dto.parentId !== existing.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException("OrgUnit cannot be its own parent");
      }
      if (dto.parentId) {
        await this.assertUnitInScope(dto.parentId, link.workforceScopeId);
        await this.assertNoCycle(dto.parentId, id);
      }
    }
    const row = await this.prisma.orgUnit.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code?.trim() || null } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.managerEmploymentId !== undefined
          ? { managerEmploymentId: dto.managerEmploymentId }
          : {}),
        ...(dto.managerUserId !== undefined
          ? { managerUserId: dto.managerUserId }
          : {}),
        ...(dto.sortOrder != null ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ORG_UNIT_UPDATED",
      entityType: "ORG_UNIT",
      entityId: id,
      payload: dto as Record<string, unknown>,
    });
    await this.emitUpsert(link.workforceScope, row);
    return row;
  }

  async archive(organizationId: string, id: string, actorUserId: string) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const existing = await this.getInScope(id, link.workforceScopeId);
    const activeEmployments = await this.prisma.workforceEmployment.count({
      where: { orgUnitId: id, status: "ACTIVE" },
    });
    if (activeEmployments > 0) {
      throw new BadRequestException(
        "Cannot archive OrgUnit with active employments",
      );
    }
    const row = await this.prisma.orgUnit.update({
      where: { id },
      data: { status: OrgUnitStatus.ARCHIVED },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ORG_UNIT_ARCHIVED",
      entityType: "ORG_UNIT",
      entityId: id,
    });
    const parent = existing.parentId
      ? await this.prisma.orgUnit.findUnique({ where: { id: existing.parentId } })
      : null;
    await this.satelliteEvents.enqueue({
      type: WORKFORCE_ORG_UNIT_ARCHIVED,
      organizationId: link.workforceScope.anchorOrganizationId,
      correlationId: `${id}:ARCHIVED:${Date.now()}`,
      occurredAt: new Date().toISOString(),
      payload: {
        cpOrgUnitId: id,
        workforceScopeId: link.workforceScopeId,
        anchorOrganizationId: link.workforceScope.anchorOrganizationId,
        parentCpOrgUnitId: parent?.id,
        name: row.name,
        code: row.code ?? undefined,
        costCenterCode: row.code ?? id.slice(0, 8),
        managerEmploymentId: row.managerEmploymentId ?? undefined,
      },
    });
    return row;
  }

  async collectSubtreeIds(orgUnitId: string): Promise<string[]> {
    const all = await this.prisma.orgUnit.findMany({
      where: { status: OrgUnitStatus.ACTIVE },
      select: { id: true, parentId: true },
    });
    const byParent = new Map<string | null, string[]>();
    for (const u of all) {
      const key = u.parentId;
      const arr = byParent.get(key) ?? [];
      arr.push(u.id);
      byParent.set(key, arr);
    }
    const out: string[] = [];
    const stack = [orgUnitId];
    while (stack.length) {
      const cur = stack.pop()!;
      out.push(cur);
      for (const child of byParent.get(cur) ?? []) stack.push(child);
    }
    return out;
  }

  private async getInScope(id: string, scopeId: string) {
    const row = await this.prisma.orgUnit.findFirst({
      where: { id, workforceScopeId: scopeId },
    });
    if (!row) throw new NotFoundException("OrgUnit not found");
    return row;
  }

  private async assertUnitInScope(id: string, scopeId: string) {
    await this.getInScope(id, scopeId);
  }

  private async assertNoCycle(newParentId: string, excludeId: string | null) {
    let cur: string | null = newParentId;
    const seen = new Set<string>();
    while (cur) {
      if (excludeId && cur === excludeId) {
        throw new BadRequestException("OrgUnit tree cycle detected");
      }
      if (seen.has(cur)) {
        throw new BadRequestException("OrgUnit tree cycle detected");
      }
      seen.add(cur);
      const node: { parentId: string | null } | null =
        await this.prisma.orgUnit.findUnique({
          where: { id: cur },
          select: { parentId: true },
        });
      cur = node?.parentId ?? null;
    }
  }

  private async emitUpsert(
    scope: { id: string; anchorOrganizationId: string },
    row: {
      id: string;
      parentId: string | null;
      name: string;
      code: string | null;
      managerEmploymentId: string | null;
    },
  ) {
    await this.satelliteEvents.enqueue({
      type: WORKFORCE_ORG_UNIT_UPSERTED,
      organizationId: scope.anchorOrganizationId,
      correlationId: `${row.id}:UPSERT:${Date.now()}`,
      occurredAt: new Date().toISOString(),
      payload: {
        cpOrgUnitId: row.id,
        workforceScopeId: scope.id,
        anchorOrganizationId: scope.anchorOrganizationId,
        parentCpOrgUnitId: row.parentId ?? undefined,
        name: row.name,
        code: row.code ?? undefined,
        costCenterCode: row.code ?? row.id.slice(0, 8),
        managerEmploymentId: row.managerEmploymentId ?? undefined,
      },
    });
  }
}

function buildTree(
  units: Array<{
    id: string;
    parentId: string | null;
    name: string;
    code: string | null;
    status: OrgUnitStatus;
    sortOrder: number;
    _count: { employments: number; positions: number };
  }>,
) {
  type Node = (typeof units)[0] & { children: Node[] };
  const byId = new Map<string, Node>();
  for (const u of units) byId.set(u.id, { ...u, children: [] });
  const roots: Node[] = [];
  for (const u of units) {
    const node = byId.get(u.id)!;
    if (u.parentId && byId.has(u.parentId)) {
      byId.get(u.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
