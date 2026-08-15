import { Injectable, NotFoundException } from "@nestjs/common";
import {
  ChequeStatus,
  TxnType,
  VirtualAccountStatus,
  SweepRuleStatus,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import {
  SystemGlConfigService,
  SystemGlKey,
} from "../../kernel/ledger/system-gl-config.service";

@Injectable()
export class VirtualAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  list(customerId?: string) {
    return this.prisma.virtualAccount.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  create(input: {
    customerId: string;
    parentAccountId: string;
    virtualIban: string;
  }) {
    return this.prisma.virtualAccount.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        parentAccountId: input.parentAccountId,
        virtualIban: input.virtualIban,
        status: VirtualAccountStatus.ACTIVE,
      },
    });
  }

  close(id: string) {
    return this.prisma.virtualAccount.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { status: VirtualAccountStatus.CLOSED },
    });
  }
}

@Injectable()
export class ChequesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly systemGl: SystemGlConfigService,
  ) {}

  list(accountId?: string) {
    return this.prisma.chequeInstrument.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(accountId ? { accountId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  issue(input: {
    accountId: string;
    chequeNumber: string;
    amountMinor: bigint;
    currency?: string;
    payeeName: string;
  }) {
    return this.prisma.chequeInstrument.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        accountId: input.accountId,
        chequeNumber: input.chequeNumber,
        amountMinor: input.amountMinor,
        currency: input.currency ?? "AZN",
        payeeName: input.payeeName,
        status: ChequeStatus.ISSUED,
      },
    });
  }

  async clear(id: string, makerUserId: string) {
    const cheque = await this.prisma.chequeInstrument.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!cheque) throw new NotFoundException("Cheque not found");

    const account = await this.prisma.account.findFirst({
      where: { id: cheque.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");

    const clearing = await this.systemGl.resolve(SystemGlKey.DIRECT_DEBIT_CLEARING);

    const txn = await this.postingEngine.post({
      reference: `CHEQUE-CLEAR-${cheque.chequeNumber}`,
      idempotencyKey: `cheque-clear-${cheque.id}`,
      valueDate: new Date(),
      type: TxnType.PAYMENT,
      makerUserId,
      branchId: account.branchId,
      autoApprove: true,
      legs: [
        {
          accountId: account.id,
          glAccountId: account.glAccountId,
          branchId: account.branchId,
          debitMinor: cheque.amountMinor,
          creditMinor: 0n,
          currency: cheque.currency,
        },
        {
          glAccountId: clearing.id,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: cheque.amountMinor,
          currency: cheque.currency,
        },
      ],
    });

    return this.prisma.chequeInstrument.update({
      where: { id },
      data: {
        status: ChequeStatus.CLEARED,
        clearedAt: new Date(),
        journalTxnId: txn.id,
      },
    });
  }

  async bounce(id: string, makerUserId: string) {
    const cheque = await this.prisma.chequeInstrument.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!cheque) throw new NotFoundException("Cheque not found");

    const account = await this.prisma.account.findFirst({
      where: { id: cheque.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");

    const feeIncome = await this.systemGl.resolve(SystemGlKey.FEE_INCOME);

    await this.postingEngine.post({
      reference: `CHEQUE-BOUNCE-${cheque.chequeNumber}`,
      idempotencyKey: `cheque-bounce-${cheque.id}`,
      valueDate: new Date(),
      type: TxnType.FEE,
      makerUserId,
      branchId: account.branchId,
      autoApprove: true,
      legs: [
        {
          accountId: account.id,
          glAccountId: account.glAccountId,
          branchId: account.branchId,
          debitMinor: 500n,
          creditMinor: 0n,
          currency: cheque.currency,
        },
        {
          glAccountId: feeIncome.id,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: 500n,
          currency: cheque.currency,
        },
      ],
    });

    return this.prisma.chequeInstrument.update({
      where: { id },
      data: { status: ChequeStatus.BOUNCED },
    });
  }
}

@Injectable()
export class SweepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  list() {
    return this.prisma.cashPoolSweepRule.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
    });
  }

  create(input: {
    masterAccountId: string;
    childAccountId: string;
    targetMinor?: bigint;
  }) {
    return this.prisma.cashPoolSweepRule.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        masterAccountId: input.masterAccountId,
        childAccountId: input.childAccountId,
        targetMinor: input.targetMinor ?? 0n,
        status: SweepRuleStatus.ACTIVE,
      },
    });
  }

  pause(id: string) {
    return this.prisma.cashPoolSweepRule.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { status: SweepRuleStatus.PAUSED },
    });
  }
}

@Injectable()
export class NostroStatementImportService {
  importStub(_payload: string) {
    return {
      status: "STUB",
      message: "Nostro statement import not wired — parse MT940 in future wave",
      linesParsed: 0,
    };
  }
}
