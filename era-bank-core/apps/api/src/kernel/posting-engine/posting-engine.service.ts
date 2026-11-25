import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
// Kernel L1 — must not import from modules/* (see eslint.config.mjs + BOUNDARY.md).
import { AccountStatus, EodStatus, TxnStatus, TxnType } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { AuditService } from "../audit/audit.service";
import {
  assertBalancedLegs,
  mirrorLeg,
} from "./posting-engine.validation";
import {
  ApprovePostingRequest,
  CONTROLLED_TXN_TYPES,
  PostingRequest,
  ReversePostingRequest,
} from "./posting-engine.types";
import { emitPostingCommitted } from "./posting-hooks.registry";
import {
  computeAvailableMinor,
  lockAccountsForUpdate,
  lockNostroAccountsForUpdate,
  runSerializableMoneyTx,
} from "./posting-money-tx";

@Injectable()
export class PostingEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly audit: AuditService,
  ) {}

  async post(request: PostingRequest) {
    assertBalancedLegs(request.legs);

    const existing = await this.findByIdempotencyKey(request.idempotencyKey);
    if (existing) return existing;

    const requiresApproval = CONTROLLED_TXN_TYPES.has(request.type) && !request.autoApprove;
    const initialStatus = requiresApproval ? TxnStatus.PENDING : TxnStatus.POSTED;
    const bookingDate = new Date();

    let result;
    try {
      result = await runSerializableMoneyTx(this.prisma, async (txRaw) => {
        const tx = txRaw as typeof this.prisma;
        if (!request.allowDuringEod) {
          const eodLock = await tx.eodRun.findFirst({
            where: { bankOrgId: this.bankOrg.bankOrgId, status: EodStatus.RUNNING },
          });
          if (eodLock) {
            throw new HttpException(
              "EOD is running — mutations blocked",
              HttpStatus.LOCKED,
            );
          }
        }

        const accountIds = request.legs
          .map((l) => l.accountId)
          .filter((id): id is string => Boolean(id));
        await lockAccountsForUpdate(tx as never, accountIds, this.bankOrg.bankOrgId);

        const nostroIds = (request.nostroAdjustments ?? []).map(
          (n) => n.nostroAccountId,
        );
        await lockNostroAccountsForUpdate(tx as never, nostroIds, this.bankOrg.bankOrgId);

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
          await this.applyNostroAdjustments(tx, request.nostroAdjustments ?? []);
        }

        if (request.sideEffectsInTx) {
          await request.sideEffectsInTx(tx, { id: journalTxn.id });
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
    } catch (err) {
      // Parallel posts with the same key: unique constraint race → return winner.
      if (this.isUniqueViolation(err)) {
        const raced = await this.findByIdempotencyKey(request.idempotencyKey);
        if (raced) return raced;
      }
      throw err;
    }

    if (result.status === TxnStatus.POSTED) {
      await emitPostingCommitted({
        transactionId: result.id,
        bankOrgId: this.bankOrg.bankOrgId,
        type: result.type,
        reference: result.reference,
        entries: result.entries.map((e) => ({
          accountId: e.accountId,
          glAccountId: e.glAccountId,
          debitMinor: e.debitMinor,
          creditMinor: e.creditMinor,
          currency: e.currency,
        })),
      });
    }

    return result;
  }

  private findByIdempotencyKey(idempotencyKey: string) {
    return this.prisma.journalTransaction.findUnique({
      where: { idempotencyKey } as never,
      include: { entries: true },
    });
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    );
  }

  async approve(request: ApprovePostingRequest) {
    const updated = await runSerializableMoneyTx(this.prisma, async (txRaw) => {
      const tx = txRaw as typeof this.prisma;
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
      const accountIds = legs
        .map((l) => l.accountId)
        .filter((id): id is string => Boolean(id));
      await lockAccountsForUpdate(tx as never, accountIds, this.bankOrg.bankOrgId);
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
      reference: updated.reference,
      entries: updated.entries.map((e) => ({
        accountId: e.accountId,
        glAccountId: e.glAccountId,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
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
    const available = computeAvailableMinor({
      ledgerBalanceMinor: account.ledgerBalanceMinor,
      heldMinor: held,
      overdraftLimitMinor: account.overdraftLimitMinor,
    });
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    legs: Array<{ accountId?: string; debitMinor: bigint; creditMinor: bigint }>,
  ) {
    const deltas = new Map<string, bigint>();
    for (const leg of legs) {
      if (!leg.accountId) continue;
      const delta = leg.creditMinor - leg.debitMinor;
      deltas.set(leg.accountId, (deltas.get(leg.accountId) ?? 0n) + delta);
    }
    for (const [accountId, delta] of deltas) {
      const account = await tx.account.findFirst({
        where: { id: accountId, bankOrgId: this.bankOrg.bankOrgId },
      });
      if (!account) {
        throw new BadRequestException(`Account ${accountId} not found for balance update`);
      }
      const holds = await tx.accountHold.aggregate({
        where: { accountId, status: "ACTIVE" },
        _sum: { amountMinor: true },
      });
      const held = holds._sum.amountMinor ?? 0n;
      const nextLedger = account.ledgerBalanceMinor + delta;
      const nextAvailable = computeAvailableMinor({
        ledgerBalanceMinor: nextLedger,
        heldMinor: held,
        overdraftLimitMinor: account.overdraftLimitMinor,
      });
      await tx.account.update({
        where: { id: accountId },
        data: {
          ledgerBalanceMinor: nextLedger,
          availableBalanceMinor: nextAvailable,
        },
      });
    }
  }

  private async applyNostroAdjustments(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    adjustments: Array<{ nostroAccountId: string; deltaMinor: bigint }>,
  ) {
    for (const adj of adjustments) {
      if (adj.deltaMinor === 0n) continue;
      const row = await tx.nostroVostroAccount.findFirst({
        where: {
          id: adj.nostroAccountId,
          bankOrgId: this.bankOrg.bankOrgId,
        },
      });
      if (!row) {
        throw new BadRequestException(
          `Nostro account ${adj.nostroAccountId} not found`,
        );
      }
      await tx.nostroVostroAccount.update({
        where: { id: adj.nostroAccountId },
        data: { ledgerBalanceMinor: { increment: adj.deltaMinor } },
      });
    }
  }
}
