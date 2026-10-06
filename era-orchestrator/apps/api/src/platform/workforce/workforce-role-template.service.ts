import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceSatelliteRoleCatalogService } from "./workforce-satellite-role-catalog.service";

@Injectable()
export class WorkforceRoleTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: WorkforceScopeService,
    private readonly audit: WorkforceAuditService,
    private readonly catalog: WorkforceSatelliteRoleCatalogService,
  ) {}

  async list(organizationId: string, positionId?: string) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    return this.prisma.satelliteRoleTemplate.findMany({
      where: {
        workforceScopeId: link.workforceScopeId,
        ...(positionId ? { positionId } : {}),
      },
      include: { position: { include: { orgUnit: true } } },
      orderBy: [{ positionId: "asc" }, { satelliteKey: "asc" }],
    });
  }

  async upsert(
    organizationId: string,
    actorUserId: string,
    data: {
      positionId: string;
      satelliteKey: string;
      satelliteRole: string;
      isDefault?: boolean;
    },
  ) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const role = await this.catalog.assertAssignable(
      organizationId,
      data.satelliteKey,
      data.satelliteRole,
    );
    const position = await this.prisma.workforcePosition.findFirst({
      where: {
        id: data.positionId,
        orgUnit: { workforceScopeId: link.workforceScopeId },
      },
    });
    if (!position) throw new NotFoundException("Position not found");

    const row = await this.prisma.satelliteRoleTemplate.upsert({
      where: {
        positionId_satelliteKey_satelliteRole: {
          positionId: data.positionId,
          satelliteKey: data.satelliteKey,
          satelliteRole: role,
        },
      },
      create: {
        workforceScopeId: link.workforceScopeId,
        positionId: data.positionId,
        satelliteKey: data.satelliteKey,
        satelliteRole: role,
        isDefault: data.isDefault ?? true,
      },
      update: { isDefault: data.isDefault ?? true },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ROLE_TEMPLATE_UPSERTED",
      entityType: "ROLE_TEMPLATE",
      entityId: row.id,
      payload: data as unknown as Record<string, unknown>,
    });
    return row;
  }

  async remove(organizationId: string, id: string, actorUserId: string) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const existing = await this.prisma.satelliteRoleTemplate.findFirst({
      where: { id, workforceScopeId: link.workforceScopeId },
    });
    if (!existing) throw new NotFoundException("Template not found");
    await this.prisma.satelliteRoleTemplate.delete({ where: { id } });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ROLE_TEMPLATE_REMOVED",
      entityType: "ROLE_TEMPLATE",
      entityId: id,
    });
  }

  async resolveRole(
    positionId: string,
    satelliteKey: string,
    organizationId: string,
  ): Promise<string> {
    const tmpl = await this.prisma.satelliteRoleTemplate.findFirst({
      where: { positionId, satelliteKey, isDefault: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!tmpl) {
      throw new BadRequestException({
        code: "SATELLITE_ROLE_UNSET",
        message: `No ${satelliteKey} role is set for this position`,
      });
    }
    return this.catalog.assertAssignable(
      organizationId,
      satelliteKey,
      tmpl.satelliteRole,
    );
  }

  async seedDefaultsForPosition(
    _workforceScopeId: string,
    _positionId: string,
    _positionName: string,
  ) {
    return;
  }
}
