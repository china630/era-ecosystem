import { Injectable } from "@nestjs/common";
import { Prisma } from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import { WorkforceSeatService } from "./workforce-seat.service";

@Injectable()
export class WorkforceSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly scope: WorkforceScopeService,
    private readonly seats: WorkforceSeatService,
  ) {}

  async overview(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const seatUsage = await this.seats.getSeatUsage(
      link.workforceScopeId,
      organizationId,
    );
    const [employments, bindings, auditTail] = await Promise.all([
      this.prisma.workforceEmployment.findMany({
        where: { organizationId, status: "ACTIVE" },
        include: { orgUnit: true, position: true, roleBindings: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.prisma.workforceRoleBinding.findMany({
        where: {
          status: "ACTIVE",
          employment: { organizationId },
        },
        include: {
          employment: { include: { orgUnit: true, position: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
      this.prisma.workforceAuditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);
    return {
      scope: link.workforceScope,
      seats: {
        used: seatUsage.used,
        limit: seatUsage.limit,
        tier: seatUsage.tier,
        policy: seatUsage.policy,
      },
      employments,
      bindings,
      auditTail,
    };
  }

  async auditLog(
    organizationId: string,
    page = 1,
    pageSize = 50,
    filters?: {
      action?: string;
      globalPersonId?: string;
      cpEmploymentId?: string;
    },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const skip = (page - 1) * pageSize;
    const where: Prisma.WorkforceAuditLogWhereInput = { organizationId };
    if (filters?.action?.trim()) {
      where.action = filters.action.trim();
    }
    if (filters?.globalPersonId?.trim()) {
      where.globalPersonId = filters.globalPersonId.trim();
    }
    if (filters?.cpEmploymentId?.trim()) {
      where.cpEmploymentId = filters.cpEmploymentId.trim();
    }
    const [items, total] = await Promise.all([
      this.prisma.workforceAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.workforceAuditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
