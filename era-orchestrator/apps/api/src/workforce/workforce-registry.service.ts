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
      await this.prisma.workforceAssignment.upsert({
        where: {
          organizationId_satelliteKey_financeEmployeeId: {
            organizationId: parsed.organizationId,
            satelliteKey: p.satelliteKey,
            financeEmployeeId: p.financeEmployeeId,
          },
        },
        create: {
          globalPersonId: parsed.globalPersonId,
          organizationId: parsed.organizationId,
          satelliteKey: p.satelliteKey,
          financeEmployeeId: p.financeEmployeeId,
          role: p.satelliteRole,
          status: WorkforceAssignmentStatus.ACTIVE,
        },
        update: {
          globalPersonId: parsed.globalPersonId,
          role: p.satelliteRole,
          status: WorkforceAssignmentStatus.ACTIVE,
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
          financeEmployeeId: p.financeEmployeeId,
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
      where: { organizationId: { in: orgIds }, status: WorkforceAssignmentStatus.ACTIVE },
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
}
