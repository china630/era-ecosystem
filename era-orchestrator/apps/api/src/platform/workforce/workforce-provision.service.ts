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
  WORKFORCE_OPERATIONAL_SATELLITE_KEYS,
  isValidSatelliteRole,
} from "@era/contracts";
import {
  RoleBindingSource,
  RoleBindingStatus,
  WorkforceEmploymentStatus,
} from "@era365/database";
import { randomUUID } from "crypto";
import { MdmService } from "../../mdm/mdm.service";
import { composePersonFullName } from "../../mdm/mdm-person-name";
import { PrismaService } from "../../prisma/prisma.service";
import { SatelliteEventsService } from "../../satellite-events/satellite-events.service";
import { SubscriptionAccessService } from "../../subscription/subscription-access.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforcePositionsService } from "./workforce-positions.service";
import { WorkforceRoleTemplateService } from "./workforce-role-template.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import { WorkforceSeatService } from "./workforce-seat.service";
import { filterEntitledSatellites, shouldAllocateNewSeat } from "./workforce-satellite-keys";
import {
  assertSatelliteLoginAvailable,
  normalizeSatelliteStaffLogin,
  normalizeSatelliteStaffPin,
  resolveSatelliteStaffLogin,
  resolveSatelliteStaffPin,
  staffCodeFromEmployment,
} from "./workforce-staff-login";

function parseDateOnly(iso: string): Date {
  const d = iso.slice(0, 10);
  return new Date(`${d}T00:00:00.000Z`);
}

function provisionDisplayName(
  profile: {
    fullName?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
  },
  fallbackId: string,
): string {
  const composed = composePersonFullName(
    profile.firstName,
    profile.middleName,
    profile.lastName,
  );
  return (
    composed ||
    (typeof profile.fullName === "string" && profile.fullName.trim()) ||
    fallbackId.slice(0, 8)
  );
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
    const fullName = provisionDisplayName(profile, globalPersonId);

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

    const position = await this.prisma.workforcePosition.findUnique({
      where: { id: dto.positionId },
      include: { orgUnit: true },
    });
    if (!position) throw new NotFoundException("Position not found");

    const entitledKeys = await this.resolveEntitledSatellites(
      organizationId,
      dto.satelliteKeys,
    );
    const existingSeat = await this.prisma.workforceSeatAllocation.findFirst({
      where: {
        workforceScopeId: link.workforceScopeId,
        globalPersonId,
        status: RoleBindingStatus.ACTIVE,
      },
    });
    const needsNewSeat = shouldAllocateNewSeat(entitledKeys, Boolean(existingSeat));
    if (needsNewSeat) {
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
      const resolvedLogin = resolveSatelliteStaffLogin(row.id, null, dto.login);
      const resolvedPin = resolveSatelliteStaffPin(null, dto.pin);
      await assertSatelliteLoginAvailable(tx, organizationId, resolvedLogin);
      await tx.workforceEmployment.update({
        where: { id: row.id },
        data: {
          satelliteStaffLogin: resolvedLogin,
          satelliteStaffPin: resolvedPin,
        },
      });
      if (needsNewSeat) {
        await tx.workforceSeatAllocation.create({
          data: {
            workforceScopeId: link.workforceScopeId,
            globalPersonId,
            employmentId: row.id,
            status: RoleBindingStatus.ACTIVE,
          },
        });
      }
      return {
        ...row,
        satelliteStaffLogin: resolvedLogin,
        satelliteStaffPin: resolvedPin,
      };
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
      if (!b.satelliteUserId) {
        await this.prisma.workforceRoleBinding.update({
          where: { id: b.id },
          data: {
            provisionState: "FAILED",
            lastProvisionError: "MISSING_SATELLITE_USER_ID",
            lastProvisionAt: new Date(),
          },
        });
      }
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
    opts?: { login?: string; pin?: string },
  ) {
    const employment = await this.prisma.workforceEmployment.findFirst({
      where: { id: employmentId, organizationId, status: WorkforceEmploymentStatus.ACTIVE },
      include: { orgUnit: true, position: true },
    });
    if (!employment) throw new NotFoundException("Active employment not found");

    const bindings = await this.prisma.workforceRoleBinding.findMany({
      where: { employmentId, status: RoleBindingStatus.ACTIVE },
    });

    const loginOverride = normalizeSatelliteStaffLogin(opts?.login);
    const pinOverride = normalizeSatelliteStaffPin(opts?.pin);
    if ((loginOverride || pinOverride) && bindings.length === 0) {
      throw new BadRequestException({
        code: "LOGIN_REQUIRES_BINDING",
        message: "Cannot save satellite login without an active role binding",
      });
    }

    let cpSaved = false;
    if (loginOverride || pinOverride) {
      if (loginOverride) {
        await assertSatelliteLoginAvailable(
          this.prisma,
          organizationId,
          loginOverride,
          employmentId,
        );
      }
      await this.prisma.workforceEmployment.update({
        where: { id: employmentId },
        data: {
          ...(loginOverride ? { satelliteStaffLogin: loginOverride } : {}),
          ...(pinOverride ? { satelliteStaffPin: pinOverride } : {}),
        },
      });
      employment.satelliteStaffLogin =
        loginOverride ?? employment.satelliteStaffLogin;
      employment.satelliteStaffPin =
        pinOverride ?? employment.satelliteStaffPin;
      cpSaved = true;
    }

    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const profile = await this.mdm.getPersonOpsProfile(
      employment.globalPersonId,
      organizationId,
    );
    const fullName = provisionDisplayName(profile, employment.globalPersonId);

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
    return { reprovisioned: bindings.length, cpSaved };
  }

  private async emitProvisioned(args: {
    organizationId: string;
    globalPersonId: string;
    employment: {
      id: string;
      financeEmployeeId: string | null;
      orgUnit: { name: string };
      satelliteStaffLogin?: string | null;
      satelliteStaffPin?: string | null;
    };
    binding: { id: string; satelliteKey: string; satelliteRole: string };
    fullName: string;
    pin?: string;
    login?: string;
    position: { name: string };
  }) {
    const staffCode = staffCodeFromEmployment(args.employment.id);
    const login = resolveSatelliteStaffLogin(
      args.employment.id,
      args.employment.satelliteStaffLogin,
      args.login,
    );
    const pin = resolveSatelliteStaffPin(
      args.employment.satelliteStaffPin,
      args.pin,
    );
    await this.prisma.workforceRoleBinding.update({
      where: { id: args.binding.id },
      data: {
        provisionState: "PENDING",
        lastProvisionError: null,
        lastProvisionAt: new Date(),
      },
    });
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
        pin,
        login,
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
    const industryKeys = [...WORKFORCE_OPERATIONAL_SATELLITE_KEYS];
    const entitled: string[] = [];
    for (const key of industryKeys) {
      if (await this.subscriptionAccess.hasModule(organizationId, key)) {
        entitled.push(key);
      }
    }
    return filterEntitledSatellites(entitled, requested);
  }
}
