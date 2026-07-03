import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { RoleBindingStatus, TariffTier } from "@era365/database";
import { TARIFF_TIER_LIMITS } from "../../billing/tariff-limits";
import { resolveOrganizationUuid } from "../../common/organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";

const DEFAULT_SEAT_LIMIT = Number(process.env.WORKFORCE_SEATS_DEFAULT ?? "500");

@Injectable()
export class WorkforceSeatService {
  constructor(private readonly prisma: PrismaService) {}

  private async seatLimitForOrg(organizationId: string): Promise<number> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return DEFAULT_SEAT_LIMIT;
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId: orgId },
      select: { currentTier: true },
    });
    const tier = sub?.currentTier ?? TariffTier.TIER_0;
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
    if (used >= limit) {
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

    if (usage.used >= usage.limit) {
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
