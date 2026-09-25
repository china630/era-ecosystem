import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrgCommercialLinkMode } from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";

@Injectable()
export class WorkforceScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
  ) {}

  async resolveScopeForCommercialOrg(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    let link = await this.prisma.orgUnitCommercialLink.findUnique({
      where: { organizationId },
      include: {
        workforceScope: true,
        orgUnit: true,
      },
    });
    if (!link) {
      await this.bootstrap(organizationId);
      link = await this.prisma.orgUnitCommercialLink.findUnique({
        where: { organizationId },
        include: {
          workforceScope: true,
          orgUnit: true,
        },
      });
    }
    if (!link) {
      throw new NotFoundException(
        "Workforce scope not bootstrapped for this organization",
      );
    }
    return link;
  }

  async bootstrap(
    organizationId: string,
    _actorUserId?: string,
    displayName?: string,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const anchorId = org.parentOrgId ?? org.id;
    const anchor = await this.prisma.organization.findUnique({
      where: { id: anchorId },
    });
    if (!anchor) throw new NotFoundException("Anchor organization not found");

    const existing = await this.prisma.workforceScope.findUnique({
      where: { anchorOrganizationId: anchorId },
    });
    if (existing) {
      await this.ensureCommercialLink(organizationId, existing.id);
      return { scope: existing, created: false, rootOrgUnitId: null };
    }

    const scopeName = displayName?.trim() || anchor.name || "Workforce";
    const result = await this.prisma.$transaction(async (tx) => {
      const scope = await tx.workforceScope.create({
        data: {
          anchorOrganizationId: anchorId,
          name: scopeName,
        },
      });
      await tx.orgUnitCommercialLink.create({
        data: {
          organizationId: anchorId,
          workforceScopeId: scope.id,
          linkMode: OrgCommercialLinkMode.SCOPE_ROOT,
        },
      });
      if (organizationId !== anchorId) {
        await tx.orgUnitCommercialLink.upsert({
          where: { organizationId },
          create: {
            organizationId,
            workforceScopeId: scope.id,
            linkMode: OrgCommercialLinkMode.SCOPE_ROOT,
          },
          update: {},
        });
      }
      return { scope };
    });

    return { scope: result.scope, rootOrgUnitId: null, created: true };
  }

  private async ensureCommercialLink(
    organizationId: string,
    workforceScopeId: string,
  ) {
    await this.prisma.orgUnitCommercialLink.upsert({
      where: { organizationId },
      create: {
        organizationId,
        workforceScopeId,
        linkMode: OrgCommercialLinkMode.SCOPE_ROOT,
      },
      update: {},
    });
  }
}
