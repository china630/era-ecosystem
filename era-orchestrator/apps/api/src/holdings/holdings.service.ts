import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { HoldingAccessRole, InviteStatus, UserRole } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateHoldingDto,
  UpdateHoldingDto,
} from "./dto/holding.dto";

const REPORT_ROLES: HoldingAccessRole[] = [
  HoldingAccessRole.OWNER,
  HoldingAccessRole.ADMIN,
  HoldingAccessRole.ACCOUNTANT,
];

@Injectable()
export class HoldingsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCurrency(raw?: string): string {
    const c = raw?.trim().toUpperCase();
    return c === "USD" || c === "EUR" || c === "RUB" || c === "TRY" ? c : "AZN";
  }

  async createHolding(ownerUserId: string, dto: CreateHoldingDto) {
    return this.prisma.holding.create({
      data: {
        name: dto.name.trim(),
        ownerId: ownerUserId,
        baseCurrency: this.normalizeCurrency(dto.baseCurrency),
      },
      include: {
        organizations: { where: { deletedAt: null } },
      },
    });
  }

  async findAllHoldingsForUser(userId: string) {
    return this.prisma.holding.findMany({
      where: {
        isDeleted: false,
        OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
      },
      include: { organizations: { where: { deletedAt: null } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOneHoldingForAccess(userId: string, id: string) {
    const holding = await this.prisma.holding.findFirst({
      where: {
        id,
        isDeleted: false,
        OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
      },
      include: { organizations: { where: { deletedAt: null } } },
    });
    if (!holding) {
      throw new NotFoundException(`Holding with ID ${id} not found`);
    }
    return holding;
  }

  async updateHolding(ownerUserId: string, id: string, dto: UpdateHoldingDto) {
    await this.assertHoldingOwner(ownerUserId, id);
    try {
      return await this.prisma.holding.update({
        where: { id },
        data: {
          ...(dto.name != null && dto.name !== "" && { name: dto.name.trim() }),
          ...(dto.baseCurrency != null &&
            dto.baseCurrency !== "" && {
              baseCurrency: this.normalizeCurrency(dto.baseCurrency),
            }),
        },
        include: { organizations: { where: { deletedAt: null } } },
      });
    } catch {
      throw new NotFoundException(`Holding with ID ${id} not found`);
    }
  }

  async deleteHolding(ownerUserId: string, id: string) {
    await this.assertHoldingOwner(ownerUserId, id);
    try {
      return await this.prisma.holding.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
    } catch {
      throw new NotFoundException(`Holding with ID ${id} not found`);
    }
  }

  async addOrganizationToHolding(
    ownerUserId: string,
    holdingId: string,
    organizationId: string,
  ): Promise<{ organizationId: string; holdingId: string }> {
    await this.assertHoldingOwner(ownerUserId, holdingId);
    await this.assertUserIsOrganizationOwner(ownerUserId, organizationId);
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { holdingId },
      select: { id: true },
    });
    return { organizationId, holdingId };
  }

  async removeOrganizationFromHolding(
    ownerUserId: string,
    holdingId: string,
    organizationId: string,
  ): Promise<{ organizationId: string; holdingId: null }> {
    await this.assertHoldingOwner(ownerUserId, holdingId);
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, holdingId, deletedAt: null },
      select: { id: true },
    });
    if (!org) {
      throw new BadRequestException(
        "Organization is not linked to this holding",
      );
    }
    await this.assertUserIsOrganizationOwner(ownerUserId, organizationId);
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { holdingId: null },
      select: { id: true },
    });
    return { organizationId, holdingId: null };
  }

  async listMembers(ownerUserId: string, holdingId: string) {
    await this.assertHoldingOwner(ownerUserId, holdingId);
    return this.prisma.holdingMembership.findMany({
      where: { holdingId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstNameCipher: true,
            lastNameCipher: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async listMemberCandidates(ownerUserId: string, holdingId: string) {
    await this.assertHoldingOwner(ownerUserId, holdingId);
    const holding = await this.prisma.holding.findFirst({
      where: { id: holdingId, isDeleted: false },
      include: { organizations: { where: { deletedAt: null }, select: { id: true } } },
    });
    if (!holding) {
      throw new NotFoundException(`Holding with ID ${holdingId} not found`);
    }
    const orgIds = holding.organizations.map((o) => o.id);
    if (!orgIds.length) return [];
    const existing = await this.prisma.holdingMembership.findMany({
      where: { holdingId },
      select: { userId: true },
    });
    const skip = new Set(existing.map((m) => m.userId));
    skip.add(holding.ownerId);
    const rows = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId: { in: orgIds },
        deletedAt: null,
        userId: { notIn: [...skip] },
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });
    const byUser = new Map<string, { userId: string; email: string }>();
    for (const row of rows) {
      if (!byUser.has(row.userId)) {
        byUser.set(row.userId, { userId: row.user.id, email: row.user.email });
      }
    }
    return [...byUser.values()].sort((a, b) => a.email.localeCompare(b.email));
  }

  async addMember(
    ownerUserId: string,
    holdingId: string,
    userId: string | undefined,
    role: HoldingAccessRole,
    email?: string,
    preferredOrganizationId?: string | null,
  ) {
    await this.assertHoldingOwner(ownerUserId, holdingId);
    let resolvedUserId = userId?.trim() || "";
    if (!resolvedUserId && email?.trim()) {
      const normalized = email.trim().toLowerCase();
      const u = await this.prisma.user.findUnique({
        where: { email: normalized },
      });
      if (!u) {
        const holdingOrgs = await this.prisma.holding.findUnique({
          where: { id: holdingId },
          include: {
            organizations: {
              where: { deletedAt: null },
              select: { id: true },
            },
          },
        });
        const orgIds = holdingOrgs?.organizations.map((o) => o.id) ?? [];
        const orgId =
          (preferredOrganizationId && orgIds.includes(preferredOrganizationId)
            ? preferredOrganizationId
            : orgIds[0]) ?? null;
        if (!orgId) {
          throw new BadRequestException(
            "Attach an organization first, then invite this email from that company's team.",
          );
        }
        const pending = await this.prisma.organizationInvite.findFirst({
          where: {
            organizationId: orgId,
            email: normalized,
            status: InviteStatus.PENDING,
            deletedAt: null,
          },
        });
        if (!pending) {
          await this.prisma.organizationInvite.create({
            data: {
              organizationId: orgId,
              email: normalized,
              role: UserRole.USER,
              organizationRoleCode: UserRole.USER,
              invitedByUserId: ownerUserId,
            },
          });
        }
        return {
          invited: true,
          email: normalized,
          organizationId: orgId,
        };
      }
      resolvedUserId = u.id;
    }
    if (!resolvedUserId) {
      throw new BadRequestException("userId or email is required");
    }
    const h = await this.prisma.holding.findUniqueOrThrow({
      where: { id: holdingId },
    });
    if (resolvedUserId === h.ownerId) {
      throw new BadRequestException(
        "Owner already has full access; use another user",
      );
    }
    const u = await this.prisma.user.findUnique({ where: { id: resolvedUserId } });
    if (!u) throw new NotFoundException("User not found");
    try {
      return await this.prisma.holdingMembership.create({
        data: { userId: resolvedUserId, holdingId, role },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstNameCipher: true,
              lastNameCipher: true,
            },
          },
        },
      });
    } catch {
      throw new ConflictException("User is already a member of this holding");
    }
  }

  async updateMemberRole(
    ownerUserId: string,
    holdingId: string,
    memberUserId: string,
    role: HoldingAccessRole,
  ) {
    await this.assertHoldingOwner(ownerUserId, holdingId);
    const h = await this.prisma.holding.findUniqueOrThrow({
      where: { id: holdingId },
    });
    if (memberUserId === h.ownerId) {
      throw new BadRequestException("Cannot change role of the holding owner");
    }
    try {
      return await this.prisma.holdingMembership.update({
        where: {
          userId_holdingId: { userId: memberUserId, holdingId },
        },
        data: { role },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstNameCipher: true,
              lastNameCipher: true,
            },
          },
        },
      });
    } catch {
      throw new NotFoundException("Membership not found");
    }
  }

  async removeMember(
    ownerUserId: string,
    holdingId: string,
    memberUserId: string,
  ) {
    await this.assertHoldingOwner(ownerUserId, holdingId);
    const h = await this.prisma.holding.findUniqueOrThrow({
      where: { id: holdingId },
    });
    if (memberUserId === h.ownerId) {
      throw new BadRequestException("Cannot remove the holding owner");
    }
    try {
      await this.prisma.holdingMembership.delete({
        where: {
          userId_holdingId: { userId: memberUserId, holdingId },
        },
      });
      return { ok: true };
    } catch {
      throw new NotFoundException("Membership not found");
    }
  }

  /**
   * Internal S2S: holdings where the user may view consolidated reports
   * (owner or membership OWNER/ADMIN/ACCOUNTANT).
   */
  async listHoldingsForReportAccess(userId: string) {
    const holdings = await this.prisma.holding.findMany({
      where: {
        isDeleted: false,
        OR: [
          { ownerId: userId },
          {
            memberships: {
              some: { userId, role: { in: REPORT_ROLES } },
            },
          },
        ],
      },
      include: {
        organizations: {
          where: { deletedAt: null },
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return holdings.map((h) => this.toInternalHoldingDto(h, true));
  }

  /**
   * Internal S2S: one holding with composition + canViewReports for userId.
   * Returns null-shaped 404 when holding missing; Forbidden when no membership.
   */
  async getHoldingForUserInternal(userId: string, holdingId: string) {
    const holding = await this.prisma.holding.findFirst({
      where: { id: holdingId, isDeleted: false },
      include: {
        organizations: {
          where: { deletedAt: null },
          select: { id: true, name: true },
        },
        memberships: {
          where: { userId },
          select: { role: true },
        },
      },
    });
    if (!holding) {
      throw new NotFoundException(`Holding with ID ${holdingId} not found`);
    }

    const isOwner = holding.ownerId === userId;
    const memberRole = holding.memberships[0]?.role;
    const canViewReports =
      isOwner || (memberRole != null && REPORT_ROLES.includes(memberRole));
    const canRead =
      isOwner || memberRole != null;

    if (!canRead) {
      throw new ForbiddenException({
        code: "HOLDING_ACCESS_DENIED",
        message: "No access to this holding",
      });
    }

    return this.toInternalHoldingDto(holding, canViewReports);
  }

  /** Tree helper: all holdings + orgs for a user (any membership role). */
  async getHoldingsTreeForUser(userId: string) {
    const holdings = await this.findAllHoldingsForUser(userId);
    const holdingOrgIds = new Set(
      holdings.flatMap((h) => h.organizations.map((o) => o.id)),
    );
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId, deletedAt: null },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            holdingId: true,
            deletedAt: true,
          },
        },
      },
    });
    const freeOrganizations = memberships
      .filter(
        (m) =>
          m.organization.deletedAt == null &&
          !holdingOrgIds.has(m.organization.id) &&
          m.organization.holdingId == null,
      )
      .map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role,
      }));

    return {
      holdings: holdings.map((h) => ({
        id: h.id,
        name: h.name,
        baseCurrency: h.baseCurrency,
        organizations: h.organizations.map((o) => ({
          id: o.id,
          name: o.name,
        })),
      })),
      freeOrganizations,
    };
  }

  private toInternalHoldingDto(
    holding: {
      id: string;
      name: string;
      baseCurrency: string;
      organizations: { id: string; name: string }[];
    },
    canViewReports: boolean,
  ) {
    return {
      id: holding.id,
      name: holding.name,
      baseCurrency: holding.baseCurrency,
      organizationIds: holding.organizations.map((o) => o.id),
      organizations: holding.organizations,
      canViewReports,
    };
  }

  private async assertHoldingOwner(ownerUserId: string, holdingId: string) {
    const h = await this.prisma.holding.findFirst({
      where: { id: holdingId, ownerId: ownerUserId, isDeleted: false },
    });
    if (!h) {
      throw new NotFoundException(`Holding with ID ${holdingId} not found`);
    }
  }

  private async assertUserIsOrganizationOwner(
    userId: string,
    organizationId: string,
  ) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { ownerId: true },
    });
    if (!org) {
      throw new NotFoundException("Organization not found");
    }
    if (org.ownerId === userId) return;
    const m = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId,
        userId,
        role: UserRole.OWNER,
        deletedAt: null,
      },
    });
    if (!m) {
      throw new ForbiddenException(
        "Organization not found or you are not the organization owner",
      );
    }
  }
}
