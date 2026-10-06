import { Injectable } from "@nestjs/common";
import { Prisma } from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceEmploymentsService } from "./workforce-employments.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import { WorkforceSeatService } from "./workforce-seat.service";
import { WorkforceSatelliteRoleCatalogService } from "./workforce-satellite-role-catalog.service";

@Injectable()
export class WorkforceSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly scope: WorkforceScopeService,
    private readonly seats: WorkforceSeatService,
    private readonly employments: WorkforceEmploymentsService,
    private readonly catalog: WorkforceSatelliteRoleCatalogService,
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
    const personIds = items
      .map((row) => row.employment.globalPersonId)
      .filter(Boolean);
    const persons = await this.employments.resolvePersonProfiles(
      organizationId,
      personIds,
    );
    return { items, total, page, pageSize, persons };
  }

  async auditLog(
    organizationId: string,
    page = 1,
    pageSize = 50,
    filters?: {
      action?: string;
      globalPersonId?: string;
      cpEmploymentId?: string;
      /** When set, union audit across holding orgs visible to this HR user. */
      organizationIds?: string[];
    },
  ) {
    const scopedIds =
      filters?.organizationIds && filters.organizationIds.length > 0
        ? filters.organizationIds
        : [organizationId];
    // Entitlement: active JWT org must have workforce hub.
    await this.entitlement.assertWorkforceHub(organizationId);
    const skip = (page - 1) * pageSize;
    const where: Prisma.WorkforceAuditLogWhereInput = {
      organizationId: scopedIds.length === 1 ? scopedIds[0] : { in: scopedIds },
    };
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
    const actorUserIds = [
      ...new Set(
        items
          .map((row) => row.actorUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const globalPersonIds = [
      ...new Set(
        items
          .map((row) => row.globalPersonId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [users, persons] = await Promise.all([
      actorUserIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: actorUserIds } },
            select: { id: true, email: true },
          })
        : Promise.resolve([]),
      globalPersonIds.length > 0
        ? this.employments.resolvePersonProfiles(organizationId, globalPersonIds)
        : Promise.resolve({}),
    ]);
    const actors = Object.fromEntries(
      users.map((u) => [u.id, { email: u.email }]),
    );
    return {
      items,
      total,
      page,
      pageSize,
      organizationIds: scopedIds,
      persons,
      actors,
    };
  }

  /** Catalog rows plus the active staff already bound to each code. */
  async roleDirectory(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const catalog = await this.catalog.list(organizationId);
    const bindings = await this.prisma.workforceRoleBinding.findMany({
      where: {
        status: "ACTIVE",
        employment: { organizationId, status: "ACTIVE" },
      },
      include: {
        employment: { include: { orgUnit: true, position: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    type Holder = {
      employmentId: string;
      globalPersonId: string;
      positionName: string | null;
      orgUnitName: string | null;
      manual: boolean;
      provisionState: string;
    };
    const roles = new Map<
      string,
      {
        satelliteKey: string;
        code: string;
        name: string;
        active: boolean;
        inCatalog: boolean;
        holders: Holder[];
      }
    >();
    for (const row of catalog) {
      roles.set(`${row.satelliteKey}\0${row.code}`, {
        satelliteKey: row.satelliteKey,
        code: row.code,
        name: row.name,
        active: row.active,
        inCatalog: true,
        holders: [],
      });
    }
    for (const binding of bindings) {
      const key = `${binding.satelliteKey}\0${binding.satelliteRole}`;
      let role = roles.get(key);
      if (!role) {
        role = {
          satelliteKey: binding.satelliteKey,
          code: binding.satelliteRole,
          name: binding.satelliteRole,
          active: false,
          inCatalog: false,
          holders: [],
        };
        roles.set(key, role);
      }
      role.holders.push({
        employmentId: binding.employmentId,
        globalPersonId: binding.employment.globalPersonId,
        positionName: binding.employment.position?.name ?? null,
        orgUnitName: binding.employment.orgUnit?.name ?? null,
        manual: binding.source === "MANUAL_GRANT",
        provisionState: binding.provisionState,
      });
    }

    const personIds = [
      ...new Set(
        [...roles.values()].flatMap((role) =>
          role.holders.map((holder) => holder.globalPersonId),
        ),
      ),
    ];
    const persons =
      personIds.length > 0
        ? await this.employments.resolvePersonProfiles(organizationId, personIds)
        : {};
    return {
      roles: [...roles.values()].sort((a, b) =>
        a.satelliteKey === b.satelliteKey
          ? a.name.localeCompare(b.name, "en")
          : a.satelliteKey.localeCompare(b.satelliteKey),
      ),
      persons,
    };
  }
}
