import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  SATELLITE_STAFF_DEACTIVATED,
  SATELLITE_STAFF_PROVISIONED,
  WORKFORCE_EMPLOYMENT_HIRED,
  WORKFORCE_EMPLOYMENT_TERMINATED,
  isValidSatelliteRole,
} from "@era/contracts";
import {
  RoleBindingSource,
  RoleBindingStatus,
  WorkforceEmploymentStatus,
} from "@era365/database";
import { randomUUID } from "crypto";
import { MdmService } from "../../mdm/mdm.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SatelliteEventsService } from "../../satellite-events/satellite-events.service";
import { SubscriptionAccessService } from "../../subscription/subscription-access.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforcePositionsService } from "./workforce-positions.service";
import { WorkforceRoleTemplateService } from "./workforce-role-template.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import { WorkforceSeatService } from "./workforce-seat.service";

function parseDateOnly(iso: string): Date {
  const d = iso.slice(0, 10);
  return new Date(`${d}T00:00:00.000Z`);
}

function staffCodeFromEmployment(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

@Injectable()
export class WorkforceProvisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mdm: MdmService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly scope: WorkforceScopeService,
    private readonly positions: WorkforcePositionsService,
    private readonly templates: WorkforceRoleTemplateService,
    private readonly seats: WorkforceSeatService,
    private readonly audit: WorkforceAuditService,
    private readonly satelliteEvents: SatelliteEventsService,
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async hire(
    organizationId: string,
    actorUserId: string,
    dto: {
      globalPersonId: string;
      hireDate: string;
      orgUnitId: string;
      positionId: string;
      satelliteKeys?: string[];
      pin?: string;
      login?: string;
      commercialOrganizationId?: string;
    },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const globalPersonId = dto.globalPersonId.trim();
    const profile = await this.mdm.getPersonOpsProfile(globalPersonId, organizationId);
    const fullName =
      (typeof profile.fullName === "string" && profile.fullName.trim()) ||
      globalPersonId.slice(0, 8);

    await this.mdm.ensureWorkforceAccessGrant(globalPersonId, organizationId);

    const unit = await this.prisma.orgUnit.findFirst({
      where: {
        id: dto.orgUnitId,
        workforceScopeId: link.workforceScopeId,
        status: "ACTIVE",
      },
    });
    if (!unit) throw new BadRequestException("Invalid orgUnitId");

    await this.positions.assertSlotAvailable(dto.positionId);
    try {
      await this.seats.assertSeatAvailable(
        link.workforceScopeId,
        globalPersonId,
        organizationId,
      );
    } catch (err) {
      await this.audit.log({
        organizationId,
        workforceScopeId: link.workforceScopeId,
        actorUserId,
        action: "SEAT_DENY",
        entityType: "EMPLOYMENT",
        entityId: globalPersonId,
        globalPersonId,
        payload: {
          code:
            err instanceof BadRequestException
              ? (err.getResponse() as { code?: string })?.code
              : "WORKFORCE_SEATS_FULL",
        },
      });
      throw err;
    }

    const position = await this.prisma.workforcePosition.findUnique({
      where: { id: dto.positionId },
      include: { orgUnit: true },
    });
    if (!position) throw new NotFoundException("Position not found");

    const entitledKeys = await this.resolveEntitledSatellites(
      organizationId,
      dto.satelliteKeys,
    );
    if (entitledKeys.length === 0) {
      throw new BadRequestException("No entitled satellites selected for provision");
    }

    const hireDate = parseDateOnly(dto.hireDate);
    const employment = await this.prisma.$transaction(async (tx) => {
      const row = await tx.workforceEmployment.create({
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
        },
        include: { orgUnit: true, position: true },
      });
      await tx.workforceSeatAllocation.create({
        data: {
          workforceScopeId: link.workforceScopeId,
          globalPersonId,
          employmentId: row.id,
          status: RoleBindingStatus.ACTIVE,
        },
      });
      return row;
    });

    const bindings = [];
    for (const satelliteKey of entitledKeys) {
      const satelliteRole = await this.templates.resolveRole(
        dto.positionId,
        satelliteKey,
      );
      const binding = await this.prisma.workforceRoleBinding.create({
        data: {
          employmentId: employment.id,
          satelliteKey,
          satelliteRole,
          source: RoleBindingSource.HIRE_DEFAULT,
          status: RoleBindingStatus.ACTIVE,
        },
      });
      bindings.push(binding);
      await this.emitProvisioned({
        organizationId: link.workforceScope.anchorOrganizationId,
        globalPersonId,
        employment,
        binding,
        fullName,
        pin: dto.pin,
        login: dto.login,
        position,
      });
    }

    await this.audit.log({
      organizationId,
      workforceScopeId: link.workforceScopeId,
      actorUserId,
      action: "HIRE",
      entityType: "EMPLOYMENT",
      entityId: employment.id,
      globalPersonId,
      cpEmploymentId: employment.id,
      payload: { satelliteKeys: entitledKeys, globalPersonId },
    });

    await this.satelliteEvents.enqueue({
      type: WORKFORCE_EMPLOYMENT_HIRED,
      organizationId: link.workforceScope.anchorOrganizationId,
      correlationId: `${employment.id}:HIRED:${Date.now()}`,
      occurredAt: new Date().toISOString(),
      globalPersonId,
      payload: {
        cpEmploymentId: employment.id,
        organizationId: link.workforceScope.anchorOrganizationId,
        globalPersonId,
        orgUnitId: dto.orgUnitId,
        positionId: dto.positionId,
        hireDate: dto.hireDate.slice(0, 10),
        fullName,
        positionTitle: position.name,
        orgUnitName: unit.name,
      },
    });

    return { employment, bindings };
  }

  async terminate(organizationId: string, employmentId: string, actorUserId: string) {
    const employment = await this.prisma.workforceEmployment.findFirst({
      where: { id: employmentId, organizationId },
      include: { orgUnit: true, position: true },
    });
    if (!employment) throw new NotFoundException("Employment not found");
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);

    const bindings = await this.prisma.workforceRoleBinding.findMany({
      where: { employmentId, status: RoleBindingStatus.ACTIVE },
    });

    await this.prisma.workforceEmployment.update({
      where: { id: employmentId },
      data: { status: WorkforceEmploymentStatus.TERMINATED },
    });
    await this.seats.releaseSeat(employmentId);
    await this.prisma.workforceRoleBinding.updateMany({
      where: { employmentId, status: RoleBindingStatus.ACTIVE },
      data: { status: RoleBindingStatus.REVOKED },
    });

    const staffCode = staffCodeFromEmployment(employmentId);
    for (const b of bindings) {
      await this.satelliteEvents.enqueue({
        type: SATELLITE_STAFF_DEACTIVATED,
        organizationId: link.workforceScope.anchorOrganizationId,
        correlationId: randomUUID(),
        occurredAt: new Date().toISOString(),
        globalPersonId: employment.globalPersonId,
        payload: {
          cpEmploymentId: employmentId,
          ...(employment.financeEmployeeId
            ? { financeEmployeeId: employment.financeEmployeeId }
            : {}),
          satelliteKey: b.satelliteKey,
          staffCode,
          roleBindingId: b.id,
          ...(b.satelliteUserId ? { satelliteUserId: b.satelliteUserId } : {}),
        },
      });
    }

    await this.satelliteEvents.enqueue({
      type: WORKFORCE_EMPLOYMENT_TERMINATED,
      organizationId: link.workforceScope.anchorOrganizationId,
      correlationId: `${employmentId}:TERMINATED:${Date.now()}`,
      occurredAt: new Date().toISOString(),
      globalPersonId: employment.globalPersonId,
      payload: {
        cpEmploymentId: employmentId,
        organizationId: link.workforceScope.anchorOrganizationId,
        globalPersonId: employment.globalPersonId,
        ...(employment.financeEmployeeId
          ? { financeEmployeeId: employment.financeEmployeeId }
          : {}),
      },
    });

    await this.audit.log({
      organizationId,
      actorUserId,
      action: "TERMINATE",
      entityType: "EMPLOYMENT",
      entityId: employmentId,
    });

    return { ok: true };
  }

  async reprovision(
    organizationId: string,
    employmentId: string,
    actorUserId: string,
  ) {
    const employment = await this.prisma.workforceEmployment.findFirst({
      where: { id: employmentId, organizationId, status: WorkforceEmploymentStatus.ACTIVE },
      include: { orgUnit: true, position: true },
    });
    if (!employment) throw new NotFoundException("Active employment not found");
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const profile = await this.mdm.getPersonOpsProfile(
      employment.globalPersonId,
      organizationId,
    );
    const fullName =
      (typeof profile.fullName === "string" && profile.fullName.trim()) ||
      employment.globalPersonId.slice(0, 8);

    const bindings = await this.prisma.workforceRoleBinding.findMany({
      where: { employmentId, status: RoleBindingStatus.ACTIVE },
    });
    for (const binding of bindings) {
      await this.emitProvisioned({
        organizationId: link.workforceScope.anchorOrganizationId,
        globalPersonId: employment.globalPersonId,
        employment,
        binding,
        fullName,
        position: employment.position,
      });
    }
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "REPROVISION",
      entityType: "EMPLOYMENT",
      entityId: employmentId,
    });
    return { reprovisioned: bindings.length };
  }

  private async emitProvisioned(args: {
    organizationId: string;
    globalPersonId: string;
    employment: {
      id: string;
      financeEmployeeId: string | null;
      orgUnit: { name: string };
    };
    binding: { id: string; satelliteKey: string; satelliteRole: string };
    fullName: string;
    pin?: string;
    login?: string;
    position: { name: string };
  }) {
    const staffCode = staffCodeFromEmployment(args.employment.id);
    await this.satelliteEvents.enqueue({
      type: SATELLITE_STAFF_PROVISIONED,
      organizationId: args.organizationId,
      correlationId: randomUUID(),
      occurredAt: new Date().toISOString(),
      globalPersonId: args.globalPersonId,
      payload: {
        cpEmploymentId: args.employment.id,
        ...(args.employment.financeEmployeeId
          ? { financeEmployeeId: args.employment.financeEmployeeId }
          : {}),
        satelliteKey: args.binding.satelliteKey,
        satelliteRole: args.binding.satelliteRole,
        staffCode,
        fullName: args.fullName,
        pin: args.pin ?? "0000",
        login: args.login ?? `emp-${staffCode.toLowerCase()}`,
        positionTitle: args.position.name,
        orgUnitName: args.employment.orgUnit.name,
        roleBindingId: args.binding.id,
      },
    });
  }

  private async resolveEntitledSatellites(
    organizationId: string,
    requested?: string[],
  ): Promise<string[]> {
    const industryKeys = [
      "industry_clinic",
      "industry_hotel_pms",
      "industry_fnb_pos",
    ];
    const entitled: string[] = [];
    for (const key of industryKeys) {
      if (await this.subscriptionAccess.hasModule(organizationId, key)) {
        entitled.push(key);
      }
    }
    if (!requested?.length) return entitled;
    const set = new Set(requested.map((k) => k.trim()).filter(Boolean));
    return entitled.filter((k) => set.has(k));
  }
}
