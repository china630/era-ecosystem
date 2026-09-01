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
        take: 20,
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
        take: 20,
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

  async listBindings(
    organizationId: string,
    page = 1,
    pageSize = 50,
    filters?: {
      search?: string;
      orgUnitId?: string;
      positionId?: string;
      satelliteKey?: string;
      role?: string;
      provisionState?: string;
    },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const skip = (page - 1) * pageSize;
    const where: Prisma.WorkforceRoleBindingWhereInput = {
      status: "ACTIVE",
      employment: { organizationId },
    };
    if (filters?.satelliteKey?.trim()) {
      where.satelliteKey = filters.satelliteKey.trim();
    }
    if (filters?.role?.trim()) {
      where.satelliteRole = filters.role.trim();
    }
    if (filters?.provisionState?.trim()) {
      where.provisionState = filters.provisionState.trim() as
        | "PENDING"
        | "APPLIED"
        | "FAILED";
    }
    const employmentWhere: Prisma.WorkforceEmploymentWhereInput = {
      organizationId,
    };
    if (filters?.orgUnitId?.trim()) {
      employmentWhere.orgUnitId = filters.orgUnitId.trim();
    }
    if (filters?.positionId?.trim()) {
      employmentWhere.positionId = filters.positionId.trim();
    }
    const search = filters?.search?.trim();
    if (search && search.length >= 1) {
      where.OR = [
        { satelliteRole: { contains: search, mode: "insensitive" } },
        { satelliteKey: { contains: search, mode: "insensitive" } },
        {
          employment: {
            orgUnit: { name: { contains: search, mode: "insensitive" } },
          },
        },
        {
          employment: {
            position: { name: { contains: search, mode: "insensitive" } },
          },
        },
      ];
    }
    where.employment = employmentWhere;

    const [items, total] = await Promise.all([
      this.prisma.workforceRoleBinding.findMany({
        where,
        include: {
          employment: { include: { orgUnit: true, position: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.workforceRoleBinding.count({ where }),
    ]);
    return { items, total, page, pageSize };
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
