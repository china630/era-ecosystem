import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { LoanStatus, Prisma } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import {
  daysBetweenUtc,
  debtStatusRegistryAlertLevel,
} from "./credit-debt-status.util";
import {
  InMemoryCreditDebtStatusQueue,
  type CreditDebtStatusQueue,
} from "./credit-registry-queue";
import { createCreditRegistryAdapter } from "./credit-registry.adapter";

@Injectable()
export class CreditRegistryService {
  private readonly log = new Logger(CreditRegistryService.name);
  private readonly registry = createCreditRegistryAdapter();
  private readonly memoryQueue: CreditDebtStatusQueue =
    new InMemoryCreditDebtStatusQueue();

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  getQueue(): CreditDebtStatusQueue {
    return this.memoryQueue;
  }

  listQueue(pendingOnly = false) {
    return this.prisma.creditDebtStatusQueueItem.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(pendingOnly ? { submittedAt: null } : {}),
      },
      orderBy: { enqueuedAt: "desc" },
      take: 200,
    });
  }

  listSubmitJournal(limit = 50) {
    return this.prisma.creditRegistrySubmitJournal.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
      take: Math.min(200, Math.max(1, limit)),
    });
  }

  async validatePendingPack(batchId: string) {
    const pending = await this.prisma.creditDebtStatusQueueItem.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        submittedAt: null,
      },
    });
    return this.registry.validateBatch({
      bankOrgId: this.bankOrg.bankOrgId,
      batchId,
      recordCount: pending.length,
      records: pending.map((p) => ({
        loanId: p.loanId,
        customerId: p.customerId,
        status: p.newStatus,
        effectiveDate: p.changedAt.toISOString().slice(0, 10),
      })),
    });
  }

  async enqueueDebtStatusChange(input: {
    loanId: string;
    customerId: string;
    previousStatus: string | null;
    newStatus: string;
    changedAt?: Date;
  }) {
    const changedAt = input.changedAt ?? new Date();
    const row = await this.prisma.creditDebtStatusQueueItem.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        loanId: input.loanId,
        customerId: input.customerId,
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        changedAt,
      },
    });
    this.memoryQueue.enqueue({
      loanId: input.loanId,
      customerId: input.customerId,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      changedAt: changedAt.toISOString(),
    });
    return row;
  }

  async runEodDebtStatusAlerts(asOf: Date) {
    const pending = await this.prisma.creditDebtStatusQueueItem.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        submittedAt: null,
      },
    });
    const alerts: Array<{
      queueItemId: string;
      loanId: string;
      daysPending: number;
      level: string;
    }> = [];
    for (const item of pending) {
      const daysPending = daysBetweenUtc(item.enqueuedAt, asOf);
      const { level, alert } = debtStatusRegistryAlertLevel(daysPending);
      if (alert) {
        alerts.push({
          queueItemId: item.id,
          loanId: item.loanId,
          daysPending,
          level,
        });
        this.log.warn(
          `CKR debt status pending ${daysPending}d loan=${item.loanId} level=${level}`,
        );
      }
    }
    return { checked: pending.length, alerts };
  }

  async submitPendingStubBatch(batchId: string) {
    const pending = await this.prisma.creditDebtStatusQueueItem.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        submittedAt: null,
      },
    });
    const payload = {
      bankOrgId: this.bankOrg.bankOrgId,
      batchId,
      recordCount: pending.length,
      records: pending.map((p) => ({
        loanId: p.loanId,
        customerId: p.customerId,
        status: p.newStatus,
        effectiveDate: p.changedAt.toISOString().slice(0, 10),
      })),
    };
    const result = await this.registry.submitBatch(payload);
    const journal = await this.prisma.creditRegistrySubmitJournal.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        batchId,
        recordCount: pending.length,
        valid: result.valid,
        submittedLive: result.submittedLive === true,
        provider: result.provider,
        errorsJson: result.errors as Prisma.InputJsonValue,
        responseJson: result as unknown as Prisma.InputJsonValue,
      },
    });
    if (result.valid && result.submittedLive !== true) {
      await this.prisma.creditDebtStatusQueueItem.updateMany({
        where: {
          bankOrgId: this.bankOrg.bankOrgId,
          submittedAt: null,
        },
        data: { submittedAt: new Date() },
      });
    }
    return {
      ...result,
      journalId: journal.id,
      note:
        result.submittedLive === true
          ? "Live CKR acceptance"
          : "Lab stub journal only — live CKR remains fail-closed / DECLARED",
    };
  }

  async onLoanStatusChanged(
    loanId: string,
    previousStatus: LoanStatus | string | null,
    newStatus: LoanStatus | string,
  ) {
    const loan = await this.prisma.loanContract.findFirst({
      where: { id: loanId, bankOrgId: this.bankOrg.bankOrgId },
      select: { id: true, customerId: true, status: true },
    });
    if (!loan) throw new NotFoundException("Loan not found");
    if (String(previousStatus) === String(newStatus)) return null;
    return this.enqueueDebtStatusChange({
      loanId: loan.id,
      customerId: loan.customerId,
      previousStatus: previousStatus ? String(previousStatus) : null,
      newStatus: String(newStatus),
    });
  }
}