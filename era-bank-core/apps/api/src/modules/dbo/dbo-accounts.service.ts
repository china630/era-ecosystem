import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EodStatus } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { LedgerService } from "../../kernel/ledger/ledger.service";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import { TxnType } from "@era/bank-core-database";
import type { CustomerJwtPayload } from "./dbo-crypto.util";

@Injectable()
export class DboAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly ledger: LedgerService,
    private readonly postingEngine: PostingEngineService,
  ) {}

  private assertAccountAccess(auth: CustomerJwtPayload, accountId: string) {
    if (!auth.accountIds.includes(accountId)) {
      throw new ForbiddenException("Account not in customer scope");
    }
  }

  async assertNotEodLocked() {
    const running = await this.prisma.eodRun.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, status: EodStatus.RUNNING },
    });
    if (running) {
      throw new HttpException("EOD is running — mutations blocked", HttpStatus.LOCKED);
    }
  }

  listAccounts(auth: CustomerJwtPayload) {
    return this.prisma.account.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: auth.sub,
        status: "ACTIVE",
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async getAccount(auth: CustomerJwtPayload, accountId: string) {
    this.assertAccountAccess(auth, accountId);
    const account = await this.ledger.getAccount(accountId);
    if (!account || account.customerId !== auth.sub) {
      throw new NotFoundException("Account not found");
    }
    return account;
  }

  async getStatement(
    auth: CustomerJwtPayload,
    accountId: string,
    from: Date,
    to: Date,
  ) {
    this.assertAccountAccess(auth, accountId);
    return this.ledger.getStatement(accountId, from, to);
  }

  async internalTransfer(
    auth: CustomerJwtPayload,
    input: {
      fromAccountId: string;
      toAccountId: string;
      amountMinor: bigint;
      idempotencyKey: string;
    },
  ) {
    await this.assertNotEodLocked();
    this.assertAccountAccess(auth, input.fromAccountId);
    this.assertAccountAccess(auth, input.toAccountId);
    if (input.fromAccountId === input.toAccountId) {
      throw new ForbiddenException("Source and destination must differ");
    }

    const from = await this.prisma.account.findFirst({
      where: { id: input.fromAccountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    const to = await this.prisma.account.findFirst({
      where: { id: input.toAccountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!from || !to || from.customerId !== auth.sub || to.customerId !== auth.sub) {
      throw new NotFoundException("Account not found");
    }
    if (from.currency !== to.currency) {
      throw new ForbiddenException("Cross-currency internal transfer not supported");
    }

    const retailLimit = 500_000n;
    if (auth.channel === "RETAIL" && input.amountMinor > retailLimit) {
      throw new ForbiddenException("Amount exceeds retail daily transfer limit");
    }

    const txn = await this.postingEngine.post({
      reference: `DBO-INT-${input.idempotencyKey.slice(0, 24)}`,
      idempotencyKey: `dbo-int-${input.idempotencyKey}`,
      valueDate: new Date(),
      type: TxnType.TRANSFER,
      makerUserId: `dbo:${auth.sub}`,
      branchId: from.branchId,
      autoApprove: true,
      legs: [
        {
          accountId: from.id,
          glAccountId: from.glAccountId,
          branchId: from.branchId,
          debitMinor: input.amountMinor,
          creditMinor: 0n,
          currency: from.currency,
        },
        {
          accountId: to.id,
          glAccountId: to.glAccountId,
          branchId: to.branchId,
          debitMinor: 0n,
          creditMinor: input.amountMinor,
          currency: to.currency,
        },
      ],
    });

    return { transactionId: txn.id, status: txn.status };
  }

  async listDeposits(auth: CustomerJwtPayload) {
    return this.prisma.depositContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: auth.sub,
        status: "ACTIVE",
      },
    });
  }

  async listLoans(auth: CustomerJwtPayload) {
    return this.prisma.loanContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: auth.sub,
        status: { in: ["DISBURSED", "ACTIVE", "OVERDUE"] },
      },
      include: { installments: { orderBy: { sequenceNo: "asc" } } },
    });
  }
}
