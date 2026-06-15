import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
// Kernel L1 — must not import from modules/* (see eslint.config.mjs + BOUNDARY.md).
import { AccountStatus, EodStatus, TxnStatus, TxnType } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { AuditService } from "../audit/audit.service";
import {
  assertBalancedLegs,
  mirrorLeg,
  validateLegShape,
} from "./posting-engine.validation";
import {
  ApprovePostingRequest,
  CONTROLLED_TXN_TYPES,
  PostingRequest,
  ReversePostingRequest,
} from "./posting-engine.types";
import { emitPostingCommitted } from "./posting-hooks.registry";

@Injectable()
export class PostingEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly audit: AuditService,
  ) {}

  async post(request: PostingRequest) {
    assertBalancedLegs(request.legs);

    const existing = await this.prisma.journalTransaction.findUnique({
      where: { idempotencyKey: request.idempotencyKey },
      include: { entries: true },
    });
    if (existing) return existing;

    const requiresApproval = CONTROLLED_TXN_TYPES.has(request.type) && !request.autoApprove;
    const initialStatus = requiresApproval ? TxnStatus.PENDING : TxnStatus.POSTED;
    const bookingDate = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const eodLock = await tx.eodRun.findFirst({
        where: { bankOrgId: this.bankOrg.bankOrgId, status: EodStatus.RUNNING },
      });
      if (eodLock) {
        throw new BadRequestException("Posting blocked while EOD is RUNNING");
      }

      for (const leg of request.legs) {
        if (leg.accountId) {
          await this.assertAccountCanDebit(tx, leg);
        }
      }

      const journalTxn = await tx.journalTransaction.create({
        data: {
          bankOrgId: this.bankOrg.bankOrgId,
          reference: request.reference,
          idempotencyKey: request.idempotencyKey,
          valueDate: request.valueDate,
          bookingDate,
          branchId: request.branchId,
          type: request.type,
          status: initialStatus,
          makerUserId: request.makerUserId,
          entries: {
            create: request.legs.map((leg) => ({
              bankOrgId: this.bankOrg.bankOrgId,
              accountId: leg.accountId,
              glAccountId: leg.glAccountId,
              branchId: leg.branchId,
              debitMinor: leg.debitMinor,
              creditMinor: leg.creditMinor,
              currency: leg.currency,
            })),
          },
        },
        include: { entries: true },
      });

      if (initialStatus === TxnStatus.POSTED) {
        await this.applyBalanceUpdates(tx, request.legs);
      }

      await this.audit.appendInTx(tx, {
        entity: "JournalTransaction",
        entityId: journalTxn.id,
        action: initialStatus === TxnStatus.POSTED ? "POSTED" : "PENDING",
        afterJson: journalTxn,
        actorUserId: request.makerUserId,
      });

      return journalTxn;
    });

    if (result.status === TxnStatus.POSTED) {
      await emitPostingCommitted({
        transactionId: result.id,
        bankOrgId: this.bankOrg.bankOrgId,
        type: result.type,
        entries: result.entries.map((e) => ({
          accountId: e.accountId,
          debitMinor: e.debitMinor,
          creditMinor: e.creditMinor,
          currency: e.currency,
        })),
      });
    }

    return result;
  }

  async approve(request: ApprovePostingRequest) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const journalTxn = await tx.journalTransaction.findFirst({
        where: { id: request.transactionId, bankOrgId: this.bankOrg.bankOrgId },
        include: { entries: true },
      });
      if (!journalTxn) throw new NotFoundException("Transaction not found");
      if (journalTxn.status !== TxnStatus.PENDING) {
        throw new BadRequestException("Only PENDING transactions can be approved");
      }
      if (journalTxn.makerUserId === request.checkerUserId) {
        throw new BadRequestException("Checker must differ from maker");
      }

      const legs = journalTxn.entries.map((e) => ({
        accountId: e.accountId ?? undefined,
        glAccountId: e.glAccountId,
        branchId: e.branchId,
        debitMinor: e.debitMinor,
        creditMinor: e.creditMinor,
        currency: e.currency,
      }));
      assertBalancedLegs(legs);
      for (const leg of legs) {
        if (leg.accountId) await this.assertAccountCanDebit(tx, leg);
      }

      await this.applyBalanceUpdates(tx, legs);

      const posted = await tx.journalTransaction.update({
        where: { id: journalTxn.id },
        data: {
          status: TxnStatus.POSTED,
          checkerUserId: request.checkerUserId,
        },
        include: { entries: true },
      });

      await this.audit.appendInTx(tx, {
        entity: "JournalTransaction",
        entityId: posted.id,
        action: "APPROVED",
        beforeJson: { status: TxnStatus.PENDING },
        afterJson: { status: TxnStatus.POSTED, checkerUserId: request.checkerUserId },
        actorUserId: request.checkerUserId,
      });

      return posted;
    });

    await emitPostingCommitted({
      transactionId: updated.id,
      bankOrgId: this.bankOrg.bankOrgId,
      type: updated.type,
      entries: updated.entries.map((e) => ({
        accountId: e.accountId,
        debitMinor: e.debitMinor,
        creditMinor: e.creditMinor,
        currency: e.currency,
      })),
    });

    return updated;
  }

  async reverse(request: ReversePostingRequest) {
    const original = await this.prisma.journalTransaction.findFirst({
      where: { id: request.transactionId, bankOrgId: this.bankOrg.bankOrgId },
      include: { entries: true },
    });
    if (!original) throw new NotFoundException("Transaction not found");
    if (original.status !== TxnStatus.POSTED) {
      throw new BadRequestException("Only POSTED transactions can be reversed");
    }

    const mirroredLegs = original.entries.map((e) =>
      mirrorLeg({
        accountId: e.accountId ?? undefined,
        glAccountId: e.glAccountId,
        branchId: e.branchId,
        debitMinor: e.debitMinor,
        creditMinor: e.creditMinor,
        currency: e.currency,
      }),
    );

    const reversal = await this.post({
      reference: `REV-${original.reference}`,
      idempotencyKey: request.idempotencyKey,
      valueDate: new Date(),
      type: TxnType.REVERSAL,
      makerUserId: request.makerUserId,
      branchId: original.branchId ?? undefined,
      legs: mirroredLegs,
      autoApprove: true,
    });

    await this.prisma.journalTransaction.update({
      where: { id: original.id },
      data: { status: TxnStatus.REVERSED },
    });

    await this.audit.append({
      entity: "JournalTransaction",
      entityId: original.id,
      action: "REVERSED",
      afterJson: { reversalId: reversal.id, reason: request.reason },
      actorUserId: request.makerUserId,
    });

    return reversal;
  }

  private async assertAccountCanDebit(
    tx: Pick<PrismaService, "account" | "accountHold">,
    leg: { accountId?: string; debitMinor: bigint; currency: string },
  ) {
    if (!leg.accountId || leg.debitMinor <= 0n) return;
    const account = await tx.account.findFirst({
      where: { id: leg.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new BadRequestException(`Account ${leg.accountId} not found`);
    if (account.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException(`Account ${leg.accountId} is not ACTIVE`);
    }
    if (account.currency !== leg.currency) {
      throw new BadRequestException("Account currency mismatch");
    }
    const holds = await tx.accountHold.aggregate({
      where: { accountId: account.id, status: "ACTIVE" },
      _sum: { amountMinor: true },
    });
    const held = holds._sum.amountMinor ?? 0n;
    const available = account.ledgerBalanceMinor - held + account.overdraftLimitMinor;
    if (leg.debitMinor > available) {
      throw new BadRequestException("Insufficient available balance");
    }
  }

  findById(id: string) {
    return this.prisma.journalTransaction.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      include: { entries: true },
    });
  }

  list(filters?: {
    status?: TxnStatus;
    branchId?: string;
    type?: TxnType;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  }) {
    return this.prisma.journalTransaction.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: filters?.status,
        branchId: filters?.branchId,
        type: filters?.type,
        bookingDate: filters?.dateFrom || filters?.dateTo
          ? {
              gte: filters.dateFrom,
              lte: filters.dateTo,
            }
          : undefined,
      },
      include: { entries: true },
      orderBy: { bookingDate: "desc" },
      take: filters?.limit ?? 100,
    });
  }

  async reject(transactionId: string, rejectedByUserId: string, reason?: string) {
    const journalTxn = await this.prisma.journalTransaction.findFirst({
      where: { id: transactionId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!journalTxn) throw new NotFoundException("Transaction not found");
    if (journalTxn.status !== TxnStatus.PENDING) {
      throw new BadRequestException("Only PENDING transactions can be rejected");
    }
    const updated = await this.prisma.journalTransaction.update({
      where: { id: transactionId },
      data: { status: TxnStatus.REJECTED, checkerUserId: rejectedByUserId },
    });
    await this.audit.append({
      entity: "JournalTransaction",
      entityId: transactionId,
      action: "REJECTED",
      afterJson: { reason: reason ?? "Rejected by checker" },
      actorUserId: rejectedByUserId,
    });
    return updated;
  }

  private async applyBalanceUpdates(
    tx: Pick<PrismaService, "account">,
    legs: Array<{ accountId?: string; debitMinor: bigint; creditMinor: bigint }>,
  ) {
    for (const leg of legs) {
      if (!leg.accountId) continue;
      const delta = leg.creditMinor - leg.debitMinor;
      await tx.account.update({
        where: { id: leg.accountId },
        data: {
          ledgerBalanceMinor: { increment: delta },
          availableBalanceMinor: { increment: delta },
        },
      });
    }
  }
}
