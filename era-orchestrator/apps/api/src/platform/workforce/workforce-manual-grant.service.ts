import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { isValidSatelliteRole, SATELLITE_STAFF_DEACTIVATED } from "@era/contracts";
import { RoleBindingSource, RoleBindingStatus, WorkforceEmploymentStatus } from "@era365/database";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { SatelliteEventsService } from "../../satellite-events/satellite-events.service";
import { SubscriptionAccessService } from "../../subscription/subscription-access.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceProvisionService } from "./workforce-provision.service";
import { WorkforceScopeService } from "./workforce-scope.service";

@Injectable()
export class WorkforceManualGrantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly scope: WorkforceScopeService,
    private readonly audit: WorkforceAuditService,
    private readonly satelliteEvents: SatelliteEventsService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly provision: WorkforceProvisionService,
  ) {}

  async list(organizationId: string, employmentId?: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const employments = await this.prisma.workforceEmployment.findMany({
      where: {
        organizationId,
        ...(employmentId ? { id: employmentId } : {}),
      },
      select: { id: true },
    });
    const ids = employments.map((e) => e.id);
    return this.prisma.workforceManualGrant.findMany({
      where: { employmentId: { in: ids } },
      orderBy: { createdAt: "desc" },
    });
  }

  async grant(
    organizationId: string,
    actorUserId: string,
    dto: {
      employmentId: string;
      satelliteKey: string;
      satelliteRole: string;
      reason: string;
      expiresAt?: string;
    },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const role = dto.satelliteRole.trim().toUpperCase();
    if (!isValidSatelliteRole(dto.satelliteKey, role)) {
      throw new BadRequestException(`Invalid role for ${dto.satelliteKey}`);
    }
    if (!(await this.subscriptionAccess.hasModule(organizationId, dto.satelliteKey))) {
      throw new BadRequestException("Satellite not entitled");
    }
    const employment = await this.prisma.workforceEmployment.findFirst({
      where: {
        id: dto.employmentId,
        organizationId,
        status: WorkforceEmploymentStatus.ACTIVE,
      },
      include: { orgUnit: true, position: true },
    });
    if (!employment) throw new NotFoundException("Active employment not found");

    const grant = await this.prisma.workforceManualGrant.create({
      data: {
        employmentId: dto.employmentId,
        satelliteKey: dto.satelliteKey,
        satelliteRole: role,
        reason: dto.reason.trim(),
        grantedByUserId: actorUserId,
        ...(dto.expiresAt ? { expiresAt: new Date(dto.expiresAt) } : {}),
      },
    });

    const binding = await this.prisma.workforceRoleBinding.upsert({
      where: {
        employmentId_satelliteKey_satelliteRole: {
          employmentId: dto.employmentId,
          satelliteKey: dto.satelliteKey,
          satelliteRole: role,
        },
      },
      create: {
        employmentId: dto.employmentId,
        satelliteKey: dto.satelliteKey,
        satelliteRole: role,
        source: RoleBindingSource.MANUAL_GRANT,
        manualGrantId: grant.id,
        status: RoleBindingStatus.ACTIVE,
      },
      update: {
        source: RoleBindingSource.MANUAL_GRANT,
        manualGrantId: grant.id,
        status: RoleBindingStatus.ACTIVE,
      },
    });

    await this.audit.log({
      organizationId,
      actorUserId,
      action: "MANUAL_GRANT_CREATED",
      entityType: "MANUAL_GRANT",
      entityId: grant.id,
      payload: dto as Record<string, unknown>,
    });

    await this.provision.reprovision(organizationId, dto.employmentId, actorUserId);
    return { grant, binding };
  }

  async revoke(organizationId: string, grantId: string, actorUserId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const grant = await this.prisma.workforceManualGrant.findUnique({
      where: { id: grantId },
      include: { employment: true },
    });
    if (!grant || grant.employment.organizationId !== organizationId) {
      throw new NotFoundException("Grant not found");
    }
    if (grant.revokedAt) return { ok: true, alreadyRevoked: true };

    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    await this.prisma.workforceManualGrant.update({
      where: { id: grantId },
      data: { revokedAt: new Date() },
    });
    const binding = await this.prisma.workforceRoleBinding.findFirst({
      where: {
        employmentId: grant.employmentId,
        satelliteKey: grant.satelliteKey,
        satelliteRole: grant.satelliteRole,
        manualGrantId: grantId,
      },
    });
    if (binding) {
      await this.prisma.workforceRoleBinding.update({
        where: { id: binding.id },
        data: { status: RoleBindingStatus.REVOKED },
      });
      const staffCode = grant.employmentId.replace(/-/g, "").slice(0, 8).toUpperCase();
      await this.satelliteEvents.enqueue({
        type: SATELLITE_STAFF_DEACTIVATED,
        organizationId: link.workforceScope.anchorOrganizationId,
        correlationId: randomUUID(),
        occurredAt: new Date().toISOString(),
        globalPersonId: grant.employment.globalPersonId,
        payload: {
          cpEmploymentId: grant.employmentId,
          satelliteKey: grant.satelliteKey,
          staffCode,
          roleBindingId: binding.id,
          ...(binding.satelliteUserId ? { satelliteUserId: binding.satelliteUserId } : {}),
        },
      });
    }

    await this.audit.log({
      organizationId,
      actorUserId,
      action: "MANUAL_GRANT_REVOKED",
      entityType: "MANUAL_GRANT",
      entityId: grantId,
    });
    return { ok: true };
  }
}
