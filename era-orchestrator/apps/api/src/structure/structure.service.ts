import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CommercialOutletStatus, OrgOperatingMode } from "@era365/database";
import { AccessControlService } from "../access/access-control.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateCommercialOutletDto } from "./dto/structure-outlet.dto";
import type { UpdateCommercialOutletDto } from "./dto/structure-outlet.dto";

@Injectable()
export class StructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
  ) {}

  async assertMember(userId: string, organizationId: string): Promise<void> {
    const m = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
    });
    if (!m || m.deletedAt) {
      throw new ForbiddenException("Organization access denied");
    }
  }

  async assertOwner(userId: string, organizationId: string): Promise<void> {
    await this.access.assertOwnerForBilling(userId, organizationId);
  }

  private resolveTreeRootOrgId(org: {
    id: string;
    operatingMode: OrgOperatingMode;
    parentOrgId: string | null;
  }): string {
    if (org.operatingMode === OrgOperatingMode.DEPARTMENT && org.parentOrgId) {
      return org.parentOrgId;
    }
    return org.id;
  }

  async getTreeForOrganization(organizationId: string) {
    const rootOrg = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        operatingMode: true,
        parentOrgId: true,
        subscription: { select: { isBlocked: true } },
      },
    });
    if (!rootOrg) throw new NotFoundException("Organization not found");

    const rootId = this.resolveTreeRootOrgId(rootOrg);
    const [root, departments] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: rootId },
        select: {
          id: true,
          name: true,
          operatingMode: true,
          parentOrgId: true,
          subscription: { select: { isBlocked: true } },
        },
      }),
      this.prisma.organization.findMany({
        where: { parentOrgId: rootId },
        select: {
          id: true,
          name: true,
          operatingMode: true,
          parentOrgId: true,
          subscription: { select: { isBlocked: true } },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    if (!root) throw new NotFoundException("Root organization not found");

    const orgIds = [root.id, ...departments.map((d) => d.id)];
    const [entitlements, outlets] = await Promise.all([
      this.prisma.organizationSatelliteEntitlement.findMany({
        where: { organizationId: { in: orgIds } },
        include: { satellite: { select: { key: true, name: true } } },
      }),
      this.prisma.commercialOutlet.findMany({
        where: { organizationId: { in: orgIds } },
        orderBy: [{ satelliteKey: "asc" }, { code: "asc" }],
      }),
    ]);

    const blockedByOrg = new Map<string, boolean>();
    for (const id of orgIds) {
      const o =
        id === root.id
          ? root
          : departments.find((d) => d.id === id);
      blockedByOrg.set(id, o?.subscription?.isBlocked ?? false);
    }

    const mapOrgNode = (o: {
      id: string;
      name: string;
      operatingMode: OrgOperatingMode;
      parentOrgId: string | null;
      subscription: { isBlocked: boolean } | null;
    }) => {
      const orgBlocked = o.subscription?.isBlocked ?? false;
      const parentBlocked =
        o.parentOrgId != null
          ? (blockedByOrg.get(o.parentOrgId) ?? false)
          : false;
      const sats = entitlements
        .filter((e) => e.organizationId === o.id)
        .map((e) => {
          const satOutlets = outlets.filter(
            (out) =>
              out.organizationId === o.id &&
              out.satelliteKey === e.satelliteKey,
          );
          const satSuspended = e.suspendedAt != null;
          const inheritedOff = orgBlocked || parentBlocked;
          return {
            satelliteKey: e.satelliteKey,
            name: e.satellite.name,
            suspendedAt: e.suspendedAt,
            suspended: satSuspended,
            effectiveSuspended: inheritedOff || satSuspended,
            inheritedOffReason: inheritedOff ? "organization_blocked" : null,
            outlets: satOutlets.map((out) => ({
              id: out.id,
              code: out.code,
              name: out.name,
              status: out.status,
              effectiveSuspended:
                inheritedOff ||
                satSuspended ||
                out.status === CommercialOutletStatus.SUSPENDED,
            })),
          };
        });
      return {
        organizationId: o.id,
        name: o.name,
        operatingMode: o.operatingMode,
        parentOrgId: o.parentOrgId,
        isBlocked: orgBlocked,
        effectiveBlocked: orgBlocked || parentBlocked,
        inheritedOffReason: parentBlocked ? "parent_blocked" : null,
        satellites: sats,
      };
    };

    return {
      rootOrganizationId: root.id,
      activeOrganizationId: organizationId,
      organization: mapOrgNode(root),
      departments: departments.map(mapOrgNode),
    };
  }

  async setSatelliteSuspended(
    userId: string,
    organizationId: string,
    satelliteKey: string,
    suspend: boolean,
  ) {
    await this.assertOwner(userId, organizationId);
    const ent = await this.prisma.organizationSatelliteEntitlement.findUnique({
      where: {
        organizationId_satelliteKey: { organizationId, satelliteKey },
      },
    });
    if (!ent) {
      throw new NotFoundException("Satellite entitlement not found for org");
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.organizationSatelliteEntitlement.update({
        where: {
          organizationId_satelliteKey: { organizationId, satelliteKey },
        },
        data: { suspendedAt: suspend ? now : null },
      });
      await tx.satelliteEndpoint.updateMany({
        where: { organizationId, satelliteKey },
        data: { enabled: !suspend },
      });
    });
    return {
      organizationId,
      satelliteKey,
      suspended: suspend,
      suspendedAt: suspend ? now.toISOString() : null,
    };
  }

  async listOutlets(organizationId: string, satelliteKey?: string) {
    return this.prisma.commercialOutlet.findMany({
      where: {
        organizationId,
        ...(satelliteKey ? { satelliteKey } : {}),
      },
      orderBy: [{ satelliteKey: "asc" }, { code: "asc" }],
    });
  }

  async createOutlet(
    userId: string,
    organizationId: string,
    dto: CreateCommercialOutletDto,
  ) {
    await this.assertOwner(userId, organizationId);
    const ent = await this.prisma.organizationSatelliteEntitlement.findUnique({
      where: {
        organizationId_satelliteKey: {
          organizationId,
          satelliteKey: dto.satelliteKey,
        },
      },
    });
    if (!ent) {
      throw new BadRequestException(
        "Connect the satellite before registering outlets",
      );
    }
    if (ent.suspendedAt != null) {
      throw new BadRequestException({
        code: "SATELLITE_SUSPENDED",
        message: "Resume the satellite before registering outlets",
      });
    }
    return this.prisma.commercialOutlet.create({
      data: {
        organizationId,
        satelliteKey: dto.satelliteKey,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
      },
    });
  }

  /** Service-token upsert from satellite ops create (idempotent on org+sat+code). */
  async upsertOutletFromSatellite(input: {
    organizationId: string;
    satelliteKey: string;
    code: string;
    name: string;
  }) {
    const code = input.code.trim().toUpperCase();
    if (!code || !input.organizationId || !input.satelliteKey) {
      throw new BadRequestException("organizationId, satelliteKey, and code required");
    }
    return this.prisma.commercialOutlet.upsert({
      where: {
        organizationId_satelliteKey_code: {
          organizationId: input.organizationId,
          satelliteKey: input.satelliteKey,
          code,
        },
      },
      create: {
        organizationId: input.organizationId,
        satelliteKey: input.satelliteKey,
        code,
        name: input.name.trim() || code,
        status: CommercialOutletStatus.ACTIVE,
      },
      update: {
        name: input.name.trim() || code,
      },
    });
  }

  async updateOutlet(
    userId: string,
    organizationId: string,
    outletId: string,
    dto: UpdateCommercialOutletDto,
  ) {
    await this.assertOwner(userId, organizationId);
    const row = await this.prisma.commercialOutlet.findFirst({
      where: { id: outletId, organizationId },
    });
    if (!row) throw new NotFoundException("Outlet not found");
    return this.prisma.commercialOutlet.update({
      where: { id: outletId },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.status != null ? { status: dto.status } : {}),
      },
    });
  }

  async deleteOutlet(
    userId: string,
    organizationId: string,
    outletId: string,
  ) {
    await this.assertOwner(userId, organizationId);
    const row = await this.prisma.commercialOutlet.findFirst({
      where: { id: outletId, organizationId },
    });
    if (!row) throw new NotFoundException("Outlet not found");
    await this.prisma.commercialOutlet.delete({ where: { id: outletId } });
    return { deleted: true, id: outletId };
  }
}
