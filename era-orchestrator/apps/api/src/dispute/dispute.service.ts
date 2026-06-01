import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  DisputeSeverity,
  DisputeStatus,
  SecurityMode,
  UserRole,
} from "@era365/database";
import { ControlPlanePrismaService } from "../prisma/control-plane-prisma.service";

const DISPUTE_COUNTER_CLAIM_JWT_TYP = "dispute_counter_claim";

@Injectable()
export class DisputeService {
  constructor(
    private readonly prisma: ControlPlanePrismaService,
    private readonly jwt: JwtService,
  ) {}

  private issueCounterClaimToken(params: {
    disputeId: string;
    organizationId: string;
    incumbentUserId: string;
  }): Promise<string> {
    return this.jwt.signAsync(
      {
        typ: DISPUTE_COUNTER_CLAIM_JWT_TYP,
        disputeId: params.disputeId,
        organizationId: params.organizationId,
        sub: params.incumbentUserId,
      },
      { expiresIn: "14d" },
    );
  }

  private async verifyCounterClaimToken(token: string) {
    try {
      const p = await this.jwt.verifyAsync<{
        typ?: string;
        disputeId?: string;
        organizationId?: string;
        sub?: string;
      }>(token);
      if (
        p.typ !== DISPUTE_COUNTER_CLAIM_JWT_TYP ||
        !p.disputeId ||
        !p.organizationId ||
        !p.sub
      ) {
        throw new ForbiddenException("Invalid counter-claim token");
      }
      return {
        disputeId: p.disputeId,
        organizationId: p.organizationId,
        incumbentUserId: p.sub,
      };
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      throw new ForbiddenException("Invalid counter-claim token");
    }
  }

  async openDispute(params: {
    organizationId: string;
    claimantUserId: string;
    incumbentUserId: string;
    evidenceKeys?: string[];
    severity?: DisputeSeverity;
  }) {
    const dispute = await this.prisma.$transaction(async (tx) => {
      const d = await tx.ownershipDispute.create({
        data: {
          organizationId: params.organizationId,
          claimantUserId: params.claimantUserId,
          incumbentUserId: params.incumbentUserId,
          evidenceKeys: params.evidenceKeys ?? [],
          severity: params.severity ?? DisputeSeverity.SOFT,
          status: DisputeStatus.EVIDENCE_REQUIRED,
        },
      });
      await tx.organizationSecurityState.upsert({
        where: { organizationId: params.organizationId },
        create: {
          organizationId: params.organizationId,
          mode: SecurityMode.DISPUTE,
          activeDisputeId: d.id,
        },
        update: {
          mode: SecurityMode.DISPUTE,
          activeDisputeId: d.id,
        },
      });
      return d;
    });
    const counterClaimToken = await this.issueCounterClaimToken({
      disputeId: dispute.id,
      organizationId: params.organizationId,
      incumbentUserId: params.incumbentUserId,
    });
    return { dispute, counterClaimToken };
  }

  async listForOrganization(organizationId: string) {
    return this.prisma.ownershipDispute.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getSecurityState(organizationId: string) {
    return (
      (await this.prisma.organizationSecurityState.findUnique({
        where: { organizationId },
      })) ?? { organizationId, mode: SecurityMode.NORMAL }
    );
  }

  async patchDisputeStatus(
    organizationId: string,
    disputeId: string,
    status: DisputeStatus,
  ) {
    const d = await this.prisma.ownershipDispute.findFirst({
      where: { id: disputeId, organizationId },
    });
    if (!d) throw new BadRequestException("Dispute not found");
    return this.prisma.ownershipDispute.update({
      where: { id: disputeId },
      data: { status },
    });
  }

  async executeTransfer(disputeId: string, executorUserId: string) {
    const dispute = await this.prisma.ownershipDispute.findUnique({
      where: { id: disputeId },
    });
    if (!dispute) throw new BadRequestException("Dispute not found");
    if (dispute.status !== DisputeStatus.APPROVED) {
      throw new BadRequestException("Dispute must be APPROVED");
    }

    const lockUntil = new Date();
    lockUntil.setUTCDate(lockUntil.getUTCDate() + 30);

    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: dispute.organizationId },
        data: { ownerId: dispute.claimantUserId },
      });
      await tx.organizationMembership.upsert({
        where: {
          userId_organizationId: {
            userId: dispute.claimantUserId,
            organizationId: dispute.organizationId,
          },
        },
        create: {
          userId: dispute.claimantUserId,
          organizationId: dispute.organizationId,
          role: UserRole.OWNER,
        },
        update: { role: UserRole.OWNER, deletedAt: null },
      });
      const incMembership = await tx.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: dispute.incumbentUserId,
            organizationId: dispute.organizationId,
          },
        },
      });
      if (incMembership) {
        if (dispute.severity === DisputeSeverity.HARD) {
          await tx.organizationMembership.delete({
            where: {
              userId_organizationId: {
                userId: dispute.incumbentUserId,
                organizationId: dispute.organizationId,
              },
            },
          });
        } else {
          await tx.organizationMembership.update({
            where: {
              userId_organizationId: {
                userId: dispute.incumbentUserId,
                organizationId: dispute.organizationId,
              },
            },
            data: { role: UserRole.ADMIN },
          });
        }
      }
      await tx.ownershipDispute.update({
        where: { id: disputeId },
        data: { status: DisputeStatus.EXECUTED, executedAt: new Date() },
      });
      await tx.organizationSecurityState.upsert({
        where: { organizationId: dispute.organizationId },
        create: {
          organizationId: dispute.organizationId,
          mode: SecurityMode.POST_TRANSFER_LOCK,
          lockUntil,
        },
        update: {
          mode: SecurityMode.POST_TRANSFER_LOCK,
          lockUntil,
          activeDisputeId: null,
        },
      });
    });

    return {
      disputeId,
      organizationId: dispute.organizationId,
      newOwnerId: dispute.claimantUserId,
      executedBy: executorUserId,
    };
  }

  async recordCounterClaim(disputeId: string, token: string, note: string) {
    const parsed = await this.verifyCounterClaimToken(token);
    if (parsed.disputeId !== disputeId) {
      throw new ForbiddenException("Token does not match dispute");
    }
    const d = await this.prisma.ownershipDispute.findUnique({
      where: { id: disputeId },
    });
    if (!d) throw new NotFoundException("Dispute not found");
    return this.prisma.ownershipDispute.update({
      where: { id: disputeId },
      data: {
        counterClaimNote: note.trim(),
        status: DisputeStatus.EVIDENCE_REVIEW,
      },
    });
  }

  async getPublicDisputeMeta(disputeId: string, token: string) {
    const parsed = await this.verifyCounterClaimToken(token);
    if (parsed.disputeId !== disputeId) {
      throw new ForbiddenException("Token does not match dispute");
    }
    const d = await this.prisma.ownershipDispute.findUnique({
      where: { id: disputeId },
    });
    if (!d) throw new NotFoundException("Dispute not found");
    return {
      id: d.id,
      organizationId: d.organizationId,
      status: d.status,
      severity: d.severity,
      createdAt: d.createdAt,
    };
  }

  async notifyIncumbent(disputeId: string) {
    const d = await this.prisma.ownershipDispute.findUnique({
      where: { id: disputeId },
    });
    if (!d) throw new BadRequestException("Dispute not found");
    const counterClaimToken = await this.issueCounterClaimToken({
      disputeId: d.id,
      organizationId: d.organizationId,
      incumbentUserId: d.incumbentUserId,
    });
    await this.prisma.ownershipDispute.update({
      where: { id: disputeId },
      data: { status: DisputeStatus.INCUMBENT_NOTIFIED },
    });
    return { counterClaimToken, disputeId };
  }
}
