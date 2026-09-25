import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OrgOperatingMode,
  UserRole,
  WorkforceEmploymentStatus,
} from "@era365/database";
import { MdmService } from "../../mdm/mdm.service";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceEmploymentsService } from "./workforce-employments.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import {
  isWorkforceFinQuery,
  personMatchesNameQuery,
} from "./workforce-person-search.util";
import { staffCodeFromEmployment } from "./workforce-staff-login";

const HR_ROLES: UserRole[] = [UserRole.OWNER, UserRole.HR_MANAGER];

export type VisibleHrOrg = {
  organizationId: string;
  organizationName: string;
  operatingMode: OrgOperatingMode;
};

@Injectable()
export class WorkforceHoldingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly employments: WorkforceEmploymentsService,
    private readonly mdm: MdmService,
  ) {}

  /**
   * Intersection: holding composition ∩ user's OWNER/HR_MANAGER org memberships.
   * Holding VIEWER alone → ForbiddenException (no PII).
   */
  async resolveVisibleHrOrgs(
    userId: string,
    holdingId: string,
  ): Promise<{ holding: { id: string; name: string }; orgs: VisibleHrOrg[] }> {
    const holding = await this.prisma.holding.findFirst({
      where: {
        id: holdingId,
        isDeleted: false,
        OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
      },
      include: {
        organizations: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            operatingMode: true,
            ownerId: true,
          },
        },
      },
    });
    if (!holding) {
      throw new NotFoundException("Holding not found or access denied");
    }

    // Evrostar: employers are STANDALONE; skip DEPARTMENT children as "second employer".
    const holdingOrgIds = holding.organizations
      .filter((o) => o.operatingMode === OrgOperatingMode.STANDALONE)
      .map((o) => o.id);

    if (!holdingOrgIds.length) {
      throw new ForbiddenException({
        code: "HOLDING_HR_NO_STANDALONE",
        message: "Holding has no STANDALONE organizations for federated HR",
      });
    }

    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
        organizationId: { in: holdingOrgIds },
        deletedAt: null,
        OR: [
          { role: { in: HR_ROLES } },
          { organization: { ownerId: userId } },
        ],
      },
      include: {
        organization: { select: { id: true, name: true, operatingMode: true } },
      },
    });

    const byId = new Map<string, VisibleHrOrg>();
    for (const m of memberships) {
      byId.set(m.organization.id, {
        organizationId: m.organization.id,
        organizationName: m.organization.name,
        operatingMode: m.organization.operatingMode,
      });
    }
    for (const o of holding.organizations) {
      if (o.operatingMode !== OrgOperatingMode.STANDALONE) continue;
      if (o.ownerId === userId && !byId.has(o.id)) {
        byId.set(o.id, {
          organizationId: o.id,
          organizationName: o.name,
          operatingMode: o.operatingMode,
        });
      }
    }

    const orgs = [...byId.values()];
    if (!orgs.length) {
      throw new ForbiddenException({
        code: "HOLDING_HR_FORBIDDEN",
        message:
          "Federated HR requires OWNER or HR_MANAGER membership on at least one holding organization",
      });
    }

    return {
      holding: { id: holding.id, name: holding.name },
      orgs,
    };
  }

  async directory(
    userId: string,
    activeOrganizationId: string,
    holdingId: string,
    opts?: {
      page?: number;
      pageSize?: number;
      status?: WorkforceEmploymentStatus;
      organizationId?: string;
      q?: string;
    },
  ) {
    const { holding, orgs } = await this.resolveVisibleHrOrgs(
      userId,
      holdingId,
    );
    const visibleIds = orgs.map((o) => o.organizationId);
    const hubOrder = visibleIds.includes(activeOrganizationId)
      ? [activeOrganizationId, ...visibleIds.filter((id) => id !== activeOrganizationId)]
      : visibleIds;
    let hubOrgId: string | null = null;
    for (const id of hubOrder) {
      if (await this.entitlement.hasWorkforceHub(id)) {
        hubOrgId = id;
        break;
      }
    }
    await this.entitlement.assertWorkforceHub(hubOrgId ?? hubOrder[0]!);
    const orgFilter = opts?.organizationId?.trim();
    if (orgFilter && !visibleIds.includes(orgFilter)) {
      throw new ForbiddenException({
        code: "HOLDING_HR_ORG_NOT_VISIBLE",
        message: "Organization is not in your federated HR intersection",
      });
    }
    const scopedOrgIds = orgFilter ? [orgFilter] : visibleIds;

    const page = Math.max(1, opts?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 40));

    const employments = await this.prisma.workforceEmployment.findMany({
      where: {
        organizationId: { in: scopedOrgIds },
        ...(opts?.status ? { status: opts.status } : {}),
      },
      include: {
        orgUnit: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: [{ hireDate: "desc" }, { createdAt: "desc" }],
    });

    // Group by person
    const byPerson = new Map<string, typeof employments>();
    for (const e of employments) {
      const list = byPerson.get(e.globalPersonId) ?? [];
      list.push(e);
      byPerson.set(e.globalPersonId, list);
    }

    let personIds = [...byPerson.keys()];

    // Optional q: FIN exact (blind index) or name substring — never UUID / staffCode / mask
    const qRaw = opts?.q?.trim() ?? "";
    if (qRaw) {
      if (isWorkforceFinQuery(qRaw)) {
        const finPersonId = await this.mdm.findPersonIdByFin(qRaw);
        personIds = finPersonId && byPerson.has(finPersonId) ? [finPersonId] : [];
      } else if (qRaw.length >= 2) {
        const personsPreview = await this.mergePersonProfiles(
          scopedOrgIds,
          personIds,
        );
        const qLower = qRaw.toLowerCase();
        personIds = personIds.filter((pid) =>
          personMatchesNameQuery(personsPreview[pid], qLower),
        );
      }
      // 1-char non-FIN q is ignored (keep full directory) — do not empty the list.
    }

    personIds.sort((a, b) => a.localeCompare(b));
    const total = personIds.length;
    const pageIds = personIds.slice((page - 1) * pageSize, page * pageSize);

    const persons = await this.mergePersonProfiles(scopedOrgIds, pageIds);

    const items = pageIds.map((globalPersonId) => {
      const rows = byPerson.get(globalPersonId) ?? [];
      return {
        globalPersonId,
        displayName: persons[globalPersonId]?.displayName ?? null,
        employments: rows.map((e) => ({
          organizationId: e.organizationId,
          orgName: e.organization.name,
          employmentId: e.id,
          status: e.status,
          staffCode: staffCodeFromEmployment(e.id),
          hireDate: e.hireDate,
          orgUnit: e.orgUnit,
          position: e.position,
        })),
      };
    });

    return {
      holding,
      visibleOrgs: orgs,
      items,
      total,
      page,
      pageSize,
      persons,
    };
  }

  /**
   * HR memberships on STANDALONE orgs (no holding required).
   * Dual-VÖEN banner when the operator has not created a Holding yet.
   */
  async resolveVisibleHrOrgsFromMemberships(
    userId: string,
  ): Promise<{ holding: null; orgs: VisibleHrOrg[] }> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
        deletedAt: null,
        organization: {
          deletedAt: null,
          operatingMode: OrgOperatingMode.STANDALONE,
        },
        OR: [
          { role: { in: HR_ROLES } },
          { organization: { ownerId: userId } },
        ],
      },
      include: {
        organization: { select: { id: true, name: true, operatingMode: true } },
      },
    });
    if (!memberships.length) {
      throw new ForbiddenException({
        code: "HOLDING_HR_FORBIDDEN",
        message:
          "Federated HR requires OWNER or HR_MANAGER membership on at least one STANDALONE organization",
      });
    }
    const orgs: VisibleHrOrg[] = memberships.map((m) => ({
      organizationId: m.organization.id,
      organizationName: m.organization.name,
      operatingMode: m.organization.operatingMode,
    }));
    return { holding: null, orgs };
  }

  async personEmployments(
    userId: string,
    activeOrganizationId: string,
    holdingId: string | null,
    globalPersonId: string,
  ) {
    const { holding, orgs } = holdingId
      ? await this.resolveVisibleHrOrgs(userId, holdingId)
      : await this.resolveVisibleHrOrgsFromMemberships(userId);
    const visibleIds = orgs.map((o) => o.organizationId);
    const hubOrder = visibleIds.includes(activeOrganizationId)
      ? [activeOrganizationId, ...visibleIds.filter((id) => id !== activeOrganizationId)]
      : visibleIds;
    let hubOrgId: string | null = null;
    for (const id of hubOrder) {
      if (await this.entitlement.hasWorkforceHub(id)) {
        hubOrgId = id;
        break;
      }
    }
    await this.entitlement.assertWorkforceHub(hubOrgId ?? hubOrder[0]!);

    const rows = await this.prisma.workforceEmployment.findMany({
      where: {
        globalPersonId,
        organizationId: { in: visibleIds },
      },
      include: {
        orgUnit: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        roleBindings: {
          where: { status: "ACTIVE" },
          select: {
            satelliteKey: true,
            satelliteRole: true,
            provisionState: true,
          },
        },
      },
      orderBy: [{ organizationId: "asc" }, { hireDate: "desc" }],
    });

    const persons = await this.mergePersonProfiles(visibleIds, [
      globalPersonId,
    ]);

    return {
      holding,
      visibleOrgs: orgs,
      globalPersonId,
      person: persons[globalPersonId] ?? null,
      employments: rows.map((e) => ({
        organizationId: e.organizationId,
        orgName: e.organization.name,
        employmentId: e.id,
        status: e.status,
        staffCode: staffCodeFromEmployment(e.id),
        hireDate: e.hireDate,
        orgUnit: e.orgUnit,
        position: e.position,
        roleBindings: e.roleBindings,
      })),
    };
  }

  /** Visible org ids for audit union (same AC as directory). */
  async resolveVisibleOrgIdsForAudit(
    userId: string,
    holdingId: string,
  ): Promise<string[]> {
    const { orgs } = await this.resolveVisibleHrOrgs(userId, holdingId);
    return orgs.map((o) => o.organizationId);
  }

  private async mergePersonProfiles(
    organizationIds: string[],
    globalPersonIds: string[],
  ) {
    const merged: Awaited<
      ReturnType<WorkforceEmploymentsService["resolvePersonProfiles"]>
    > = {};
    for (const orgId of organizationIds) {
      const batch = await this.employments.resolvePersonProfiles(
        orgId,
        globalPersonIds,
      );
      for (const [pid, profile] of Object.entries(batch)) {
        const prev = merged[pid];
        if (!prev || (prev.accessDenied && !profile.accessDenied)) {
          merged[pid] = profile;
        }
      }
    }
    return merged;
  }
}
