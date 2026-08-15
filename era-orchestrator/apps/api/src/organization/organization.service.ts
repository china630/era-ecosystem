import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AccessRequestStatus,
  InviteStatus,
  UserRole,
} from "@era365/database";
import { ControlPlanePrismaService } from "../prisma/control-plane-prisma.service";
import { blindIndexForVoen } from "../common/utils/voen-blind-index";

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: ControlPlanePrismaService,
    private readonly config: ConfigService,
  ) {}

  private blindIndex(taxId: string): string {
    return blindIndexForVoen(
      taxId,
      this.config.get<string>("PII_BLIND_INDEX_KEY"),
    );
  }

  async requestJoinByTaxId(
    userId: string,
    taxId: string,
    message?: string,
  ) {
    const normalized = taxId.trim();
    if (!normalized) {
      throw new BadRequestException("taxId required");
    }
    const org = await this.prisma.organization.findFirst({
      where: { taxIdBlindIndex: this.blindIndex(normalized) },
    });
    if (!org) {
      throw new NotFoundException("Organization not found for this VÖEN");
    }
    const existing = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: org.id },
      },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException("Already a member of this organization");
    }
    const pending = await this.prisma.accessRequest.findFirst({
      where: {
        organizationId: org.id,
        requesterId: userId,
        status: AccessRequestStatus.PENDING,
        deletedAt: null,
      },
    });
    if (pending) {
      throw new ConflictException("Access request already pending");
    }
    return this.prisma.accessRequest.create({
      data: {
        organizationId: org.id,
        requesterId: userId,
        message: message?.trim() || null,
      },
    });
  }

  async listPendingAccessRequests(organizationId: string) {
    const rows = await this.prisma.accessRequest.findMany({
      where: {
        organizationId,
        status: AccessRequestStatus.PENDING,
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });
    const requesterIds = [...new Set(rows.map((r) => r.requesterId))];
    const users =
      requesterIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: requesterIds } },
            select: { id: true, email: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({
      ...r,
      requester: userMap.get(r.requesterId) ?? null,
    }));
  }

  async decideAccessRequest(
    organizationId: string,
    requestId: string,
    actorUserId: string,
    actorRole: UserRole,
    accept: boolean,
    assignRole: UserRole = UserRole.USER,
  ) {
    if (actorRole !== UserRole.OWNER && actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
    const req = await this.prisma.accessRequest.findFirst({
      where: { id: requestId, organizationId, deletedAt: null },
    });
    if (!req || req.status !== AccessRequestStatus.PENDING) {
      throw new NotFoundException("Request not found");
    }
    await this.prisma.$transaction(async (tx) => {
      if (accept) {
        await tx.organizationMembership.upsert({
          where: {
            userId_organizationId: {
              userId: req.requesterId,
              organizationId,
            },
          },
          create: {
            userId: req.requesterId,
            organizationId,
            role: assignRole,
          },
          update: { role: assignRole, deletedAt: null },
        });
        await tx.accessRequest.update({
          where: { id: requestId },
          data: {
            status: AccessRequestStatus.ACCEPTED,
            decidedAt: new Date(),
            decidedByUserId: actorUserId,
          },
        });
      } else {
        await tx.accessRequest.update({
          where: { id: requestId },
          data: {
            status: AccessRequestStatus.DECLINED,
            decidedAt: new Date(),
            decidedByUserId: actorUserId,
          },
        });
      }
    });
    return { ok: true, requestId, accepted: accept };
  }

  async transferOwnership(
    currentUserId: string,
    organizationId: string,
    newOwnerUserId: string,
  ) {
    if (newOwnerUserId === currentUserId) {
      throw new BadRequestException(
        "newOwnerUserId must differ from current user",
      );
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException("Organization not found");
    if (org.ownerId !== currentUserId) {
      throw new ForbiddenException("Only the organization owner may transfer");
    }

    const security = await this.prisma.organizationSecurityState.findUnique({
      where: { organizationId },
    });
    if (
      security &&
      (security.mode === "DISPUTE" || security.mode === "ROLLBACK_IN_PROGRESS")
    ) {
      throw new ForbiddenException("Organization frozen due to ownership dispute");
    }

    const newMembership = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: newOwnerUserId,
          organizationId,
        },
      },
    });
    if (!newMembership || newMembership.deletedAt) {
      throw new NotFoundException(
        "New owner must already be a member of this organization",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { ownerId: newOwnerUserId },
      });
      await tx.organizationMembership.update({
        where: {
          userId_organizationId: {
            userId: currentUserId,
            organizationId,
          },
        },
        data: { role: UserRole.ADMIN },
      });
      await tx.organizationMembership.update({
        where: {
          userId_organizationId: {
            userId: newOwnerUserId,
            organizationId,
          },
        },
        data: { role: UserRole.OWNER },
      });
    });

    return { organizationId, ownerId: newOwnerUserId };
  }

  async listDepartments(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, operatingMode: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    if (org.operatingMode === "DEPARTMENT") {
      throw new BadRequestException("Department orgs have no child departments");
    }

    const [departments, endpoints] = await Promise.all([
      this.prisma.organization.findMany({
        where: { parentOrgId: organizationId },
        select: {
          id: true,
          name: true,
          operatingMode: true,
          parentOrgId: true,
          revenueRouting: true,
          fiscalRouting: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.satelliteEndpoint.findMany({
        where: { organizationId },
        select: {
          satelliteKey: true,
          baseUrl: true,
          enabled: true,
          updatedAt: true,
        },
      }),
    ]);

    return { departments, satelliteEndpoints: endpoints };
  }

  /**
   * Invitations addressed to a user's email that are still pending. Used by the
   * onboarding screen so an invited accountant (with no company of their own)
   * can join without registering a new organization.
   */
  async listPendingInvitesForEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return [];
    const invites = await this.prisma.organizationInvite.findMany({
      where: {
        email: normalized,
        status: InviteStatus.PENDING,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (invites.length === 0) return [];
    const orgIds = [...new Set(invites.map((i) => i.organizationId))];
    const orgs = await this.prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true },
    });
    const orgName = new Map(orgs.map((o) => [o.id, o.name]));
    return invites.map((i) => ({
      id: i.id,
      organizationId: i.organizationId,
      organizationName: orgName.get(i.organizationId) ?? null,
      role: i.role,
      createdAt: i.createdAt,
    }));
  }

  /**
   * Accept an invitation addressed to the current user's email and create the
   * membership. Uses an optimistic PENDING->ACCEPTED guard so a double-click
   * cannot create two memberships.
   */
  async acceptInvite(userId: string, email: string, inviteId: string) {
    const normalized = email.trim().toLowerCase();
    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.organizationInvite.findFirst({
        where: { id: inviteId, email: normalized, deletedAt: null },
      });
      if (!invite) {
        throw new NotFoundException("Invitation not found");
      }
      if (invite.status !== InviteStatus.PENDING) {
        throw new ConflictException("Invitation is no longer pending");
      }
      const reserved = await tx.organizationInvite.updateMany({
        where: { id: invite.id, status: InviteStatus.PENDING },
        data: { status: InviteStatus.ACCEPTED, decidedAt: new Date() },
      });
      if (reserved.count === 0) {
        throw new ConflictException("Invitation is no longer pending");
      }
      await tx.organizationMembership.upsert({
        where: {
          userId_organizationId: {
            userId,
            organizationId: invite.organizationId,
          },
        },
        create: {
          userId,
          organizationId: invite.organizationId,
          role: invite.role,
        },
        update: { role: invite.role, deletedAt: null },
      });
      return { ok: true, organizationId: invite.organizationId };
    });
  }

  /** Active members of an organization with their user email + role. */
  async listMembers(organizationId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { joinedAt: "asc" },
    });
    const userIds = [...new Set(memberships.map((m) => m.userId))];
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true },
          })
        : [];
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return memberships.map((m) => ({
      userId: m.userId,
      email: userMap.get(m.userId)?.email ?? null,
      role: m.role,
      isOwner: org?.ownerId === m.userId,
      joinedAt: m.joinedAt,
    }));
  }

  /** Pending invitations sent for an organization. */
  async listOrgInvites(organizationId: string) {
    return this.prisma.organizationInvite.findMany({
      where: {
        organizationId,
        status: InviteStatus.PENDING,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, createdAt: true },
    });
  }

  /** Create (or reuse) a pending invitation for an email + role. */
  async createInvite(
    organizationId: string,
    invitedByUserId: string,
    email: string,
    role: UserRole,
  ) {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      throw new BadRequestException("Valid email required");
    }
    const existingMember = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        user: { email: normalized },
      },
    });
    if (existingMember) {
      throw new ConflictException("User is already a member");
    }
    const pending = await this.prisma.organizationInvite.findFirst({
      where: {
        organizationId,
        email: normalized,
        status: InviteStatus.PENDING,
        deletedAt: null,
      },
    });
    if (pending) {
      return this.prisma.organizationInvite.update({
        where: { id: pending.id },
        data: { role, invitedByUserId },
        select: { id: true, email: true, role: true, createdAt: true },
      });
    }
    return this.prisma.organizationInvite.create({
      data: { organizationId, email: normalized, role, invitedByUserId },
      select: { id: true, email: true, role: true, createdAt: true },
    });
  }

  /** Soft-cancel a pending invitation. */
  async revokeInvite(organizationId: string, inviteId: string) {
    const invite = await this.prisma.organizationInvite.findFirst({
      where: { id: inviteId, organizationId, deletedAt: null },
    });
    if (!invite) {
      throw new NotFoundException("Invitation not found");
    }
    await this.prisma.organizationInvite.update({
      where: { id: invite.id },
      data: { status: InviteStatus.DECLINED, deletedAt: new Date() },
    });
    return { ok: true };
  }
}
