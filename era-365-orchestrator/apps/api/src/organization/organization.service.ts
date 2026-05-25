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
}
