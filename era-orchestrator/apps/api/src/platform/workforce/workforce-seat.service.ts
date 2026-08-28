import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { RoleBindingStatus, TariffTier } from "@era365/database";
import { TARIFF_TIER_LIMITS } from "../../billing/tariff-limits";
import { resolveOrganizationUuid } from "../../common/organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { SystemConfigService } from "../../system-config/system-config.service";

const DEFAULT_SEAT_LIMIT = Number(process.env.WORKFORCE_SEATS_DEFAULT ?? "500");

/** Org JSON override (`Quota overrides`) or Super-admin Billing → Quotas `maxEmployees`. */
export function parseEmployeeCap(raw: unknown): number | null | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const v = "maxEmployees" in o ? o.maxEmployees : o.employees;
  if (v === null || v === "" || v === "∞") return null;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return Math.floor(v);
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

@Injectable()
export class WorkforceSeatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  /**
   * `null` = unlimited (empty / ∞ on Super-admin quotas).
   * Org `quotaOverrides` wins over the tier matrix.
   */
  private async seatLimitForOrg(organizationId: string): Promise<number | null> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return DEFAULT_SEAT_LIMIT;
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId: orgId },
      select: { currentTier: true, quotaOverrides: true },
    });
    const fromOrg = parseEmployeeCap(sub?.quotaOverrides);
    if (fromOrg !== undefined) return fromOrg;

    const tier = sub?.currentTier ?? TariffTier.TIER_0;
    try {
      const quotas = await this.systemConfig.getTierQuotas(tier);
      if (quotas.maxEmployees !== undefined) return quotas.maxEmployees;
    } catch {
      /* fall through to compiled defaults */
    }
    return TARIFF_TIER_LIMITS[tier].maxUsers ?? DEFAULT_SEAT_LIMIT;
  }

  async assertSeatAvailable(
    workforceScopeId: string,
    globalPersonId: string,
    organizationId?: string,
  ): Promise<void> {
    const existing = await this.prisma.workforceSeatAllocation.findFirst({
      where: {
        workforceScopeId,
        globalPersonId,
        status: RoleBindingStatus.ACTIVE,
      },
    });
    if (existing) {
      throw new BadRequestException({
        code: "WORKFORCE_SEAT_TAKEN",
        message: "Active seat already allocated for this person in scope",
      });
    }
    const used = await this.countUsed(workforceScopeId);
    const limit = organizationId
      ? await this.seatLimitForOrg(organizationId)
      : DEFAULT_SEAT_LIMIT;
    if (limit != null && used >= limit) {
      throw new BadRequestException({
        code: "WORKFORCE_SEATS_FULL",
        message: "Workforce seat quota exceeded",
      });
    }
  }

  async allocateSeat(
    workforceScopeId: string,
    globalPersonId: string,
    employmentId: string,
  ) {
    return this.prisma.workforceSeatAllocation.create({
      data: {
        workforceScopeId,
        globalPersonId,
        employmentId,
        status: RoleBindingStatus.ACTIVE,
      },
    });
  }

  async releaseSeat(employmentId: string) {
    await this.prisma.workforceSeatAllocation.updateMany({
      where: { employmentId, status: RoleBindingStatus.ACTIVE },
      data: { status: RoleBindingStatus.REVOKED },
    });
  }

  async countUsed(workforceScopeId: string): Promise<number> {
    return this.prisma.workforceSeatAllocation.count({
      where: { workforceScopeId, status: RoleBindingStatus.ACTIVE },
    });
  }

  seatLimit(): number {
    return DEFAULT_SEAT_LIMIT;
  }

  async getSeatUsage(workforceScopeId: string, organizationId: string) {
    const orgId = resolveOrganizationUuid(organizationId);
    const sub = orgId
      ? await this.prisma.organizationSubscription.findUnique({
          where: { organizationId: orgId },
          select: { currentTier: true },
        })
      : null;
    const tier = sub?.currentTier ?? TariffTier.TIER_0;
    const used = await this.countUsed(workforceScopeId);
    const limit = await this.seatLimitForOrg(organizationId);
    return {
      used,
      limit,
      tier,
      policy: "one_person_one_seat" as const,
    };
  }

  async checkSeatPolicy(
    organizationId: string,
    input: { globalPersonId?: string; cpEmploymentId?: string },
  ) {
    const link = await this.prisma.orgUnitCommercialLink.findUnique({
      where: { organizationId },
    });
    if (!link) {
      return {
        allowed: true,
        seatsUsed: 0,
        seatsLimit: await this.seatLimitForOrg(organizationId),
        policy: "one_person_one_seat" as const,
        message: "No workforce scope — allowed",
      };
    }

    const usage = await this.getSeatUsage(link.workforceScopeId, organizationId);
    let globalPersonId = input.globalPersonId?.trim();

    if (!globalPersonId && input.cpEmploymentId) {
      const emp = await this.prisma.workforceEmployment.findFirst({
        where: { id: input.cpEmploymentId, status: "ACTIVE" },
        select: { globalPersonId: true },
      });
      globalPersonId = emp?.globalPersonId;
    }

    if (globalPersonId) {
      const existing = await this.prisma.workforceSeatAllocation.findFirst({
        where: {
          workforceScopeId: link.workforceScopeId,
          globalPersonId,
          status: RoleBindingStatus.ACTIVE,
        },
      });
      if (existing) {
        return {
          allowed: true,
          seatsUsed: usage.used,
          seatsLimit: usage.limit,
          tier: usage.tier,
          policy: usage.policy,
        };
      }
    }

    if (usage.limit != null && usage.used >= usage.limit) {
      return {
        allowed: false,
        seatsUsed: usage.used,
        seatsLimit: usage.limit,
        tier: usage.tier,
        policy: usage.policy,
        message: "Workforce seat quota exceeded",
      };
    }

    return {
      allowed: true,
      seatsUsed: usage.used,
      seatsLimit: usage.limit,
      tier: usage.tier,
      policy: usage.policy,
    };
  }
}
