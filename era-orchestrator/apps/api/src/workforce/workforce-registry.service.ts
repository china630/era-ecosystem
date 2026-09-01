import { Injectable } from "@nestjs/common";
import {
  isSatelliteStaffDeactivated,
  isSatelliteStaffProvisioned,
  satelliteStaffDeactivatedSchema,
  satelliteStaffProvisionedSchema,
} from "@era/contracts";
import { WorkforceAssignmentStatus } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WorkforceRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFromEvent(event: unknown): Promise<void> {
    if (isSatelliteStaffProvisioned(event)) {
      const parsed = satelliteStaffProvisionedSchema.parse(event);
      const p = parsed.payload;
      if (!parsed.globalPersonId) return;
      const cpEmploymentId = p.cpEmploymentId;
      await this.prisma.workforceAssignment.upsert({
        where: {
          organizationId_satelliteKey_cpEmploymentId: {
            organizationId: parsed.organizationId,
            satelliteKey: p.satelliteKey,
            cpEmploymentId,
          },
        },
        create: {
          globalPersonId: parsed.globalPersonId,
          organizationId: parsed.organizationId,
          satelliteKey: p.satelliteKey,
          cpEmploymentId,
          financeEmployeeId: p.financeEmployeeId ?? null,
          role: p.satelliteRole,
          status: WorkforceAssignmentStatus.ACTIVE,
        },
        update: {
          globalPersonId: parsed.globalPersonId,
          role: p.satelliteRole,
          status: WorkforceAssignmentStatus.ACTIVE,
          financeEmployeeId: p.financeEmployeeId ?? undefined,
        },
      });
      return;
    }

    if (isSatelliteStaffDeactivated(event)) {
      const parsed = satelliteStaffDeactivatedSchema.parse(event);
      const p = parsed.payload;
      await this.prisma.workforceAssignment.updateMany({
        where: {
          organizationId: parsed.organizationId,
          satelliteKey: p.satelliteKey,
          cpEmploymentId: p.cpEmploymentId,
        },
        data: {
          status: WorkforceAssignmentStatus.INACTIVE,
          satelliteUserId: p.satelliteUserId ?? undefined,
        },
      });
    }
  }

  async listForOwner(ownerUserId: string) {
    const orgs = await this.prisma.organizationMembership.findMany({
      where: { userId: ownerUserId, deletedAt: null },
      select: { organizationId: true, organization: { select: { name: true } } },
    });
    const orgIds = orgs.map((o) => o.organizationId);
    const assignments = await this.prisma.workforceAssignment.findMany({
      where: {
        organizationId: { in: orgIds },
        status: WorkforceAssignmentStatus.ACTIVE,
      },
      orderBy: [{ organizationId: "asc" }, { satelliteKey: "asc" }],
    });
    const orgNameById = Object.fromEntries(
      orgs.map((o) => [o.organizationId, o.organization.name]),
    );
    return assignments.map((a) => ({
      globalPersonId: a.globalPersonId,
      organizationId: a.organizationId,
      organizationName: orgNameById[a.organizationId] ?? a.organizationId,
      satelliteKey: a.satelliteKey,
      satelliteUserId: a.satelliteUserId,
      cpEmploymentId: a.cpEmploymentId,
      financeEmployeeId: a.financeEmployeeId,
      role: a.role,
      status: a.status,
    }));
  }

  async listForOrganization(organizationId: string) {
    return this.prisma.workforceAssignment.findMany({
      where: { organizationId, status: WorkforceAssignmentStatus.ACTIVE },
      orderBy: { satelliteKey: "asc" },
    });
  }

  async patchSatelliteUserId(
    organizationId: string,
    satelliteKey: string,
    cpEmploymentId: string,
    satelliteUserId: string,
  ): Promise<void> {
    await this.prisma.workforceAssignment.updateMany({
      where: { organizationId, satelliteKey, cpEmploymentId },
      data: { satelliteUserId },
    });
    await this.prisma.workforceRoleBinding.updateMany({
      where: {
        employmentId: cpEmploymentId,
        satelliteKey,
        status: "ACTIVE",
      },
      data: {
        satelliteUserId,
        provisionState: "APPLIED",
        lastProvisionError: null,
        lastProvisionAt: new Date(),
      },
    });
  }

  async markProvisionPending(
    employmentId: string,
    satelliteKey: string,
    roleBindingId?: string,
  ): Promise<void> {
    await this.prisma.workforceRoleBinding.updateMany({
      where: roleBindingId
        ? { id: roleBindingId }
        : { employmentId, satelliteKey, status: "ACTIVE" },
      data: {
        provisionState: "PENDING",
        lastProvisionError: null,
        lastProvisionAt: new Date(),
      },
    });
  }

  async markProvisionFailed(
    employmentId: string,
    satelliteKey: string,
    errorCode: string,
    roleBindingId?: string,
  ): Promise<void> {
    await this.prisma.workforceRoleBinding.updateMany({
      where: roleBindingId
        ? { id: roleBindingId }
        : { employmentId, satelliteKey, status: "ACTIVE" },
      data: {
        provisionState: "FAILED",
        lastProvisionError: errorCode.slice(0, 200),
        lastProvisionAt: new Date(),
      },
    });
  }

  async markMissingSatelliteUserId(bindingId: string): Promise<void> {
    await this.prisma.workforceRoleBinding.update({
      where: { id: bindingId },
      data: {
        provisionState: "FAILED",
        lastProvisionError: "MISSING_SATELLITE_USER_ID",
        lastProvisionAt: new Date(),
      },
    });
  }
}
