import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  defaultRoleForSatellite,
  isValidSatelliteRole,
  NAFTA_POSITION_ROLE_SEED,
} from "@era/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import { WorkforceAuditService } from "./workforce-audit.service";

@Injectable()
export class WorkforceRoleTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: WorkforceScopeService,
    private readonly audit: WorkforceAuditService,
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
    const role = data.satelliteRole.trim().toUpperCase();
    if (!isValidSatelliteRole(data.satelliteKey, role)) {
      throw new BadRequestException(`Invalid role ${role} for ${data.satelliteKey}`);
    }
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
  ): Promise<string> {
    const tmpl = await this.prisma.satelliteRoleTemplate.findFirst({
      where: { positionId, satelliteKey, isDefault: true },
      orderBy: { updatedAt: "desc" },
    });
    if (tmpl) return tmpl.satelliteRole;
    const position = await this.prisma.workforcePosition.findUnique({
      where: { id: positionId },
    });
    const name = position?.name.toLowerCase() ?? "";
    for (const seed of NAFTA_POSITION_ROLE_SEED) {
      if (
        seed.satelliteKey === satelliteKey &&
        name.includes(seed.positionNamePattern.toLowerCase())
      ) {
        return seed.satelliteRole;
      }
    }
    return defaultRoleForSatellite(satelliteKey);
  }

  async seedDefaultsForPosition(
    workforceScopeId: string,
    positionId: string,
    positionName: string,
  ) {
    const name = positionName.toLowerCase();
    for (const seed of NAFTA_POSITION_ROLE_SEED) {
      if (!name.includes(seed.positionNamePattern.toLowerCase())) continue;
      await this.prisma.satelliteRoleTemplate.upsert({
        where: {
          positionId_satelliteKey_satelliteRole: {
            positionId,
            satelliteKey: seed.satelliteKey,
            satelliteRole: seed.satelliteRole,
          },
        },
        create: {
          workforceScopeId,
          positionId,
          satelliteKey: seed.satelliteKey,
          satelliteRole: seed.satelliteRole,
          isDefault: true,
        },
        update: { isDefault: true },
      });
    }
  }
}
