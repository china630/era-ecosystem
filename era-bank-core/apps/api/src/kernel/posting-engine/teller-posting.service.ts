import { Injectable, NotFoundException } from "@nestjs/common";
import { TxnType } from "@era/bank-core-database";
import { BankOrgConfig } from "../../common/bank-org.config";
import { PrismaService } from "../../prisma/prisma.service";
import { PostingEngineService } from "./posting-engine.service";

@Injectable()
export class TellerPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
  ) {}

  private async glByCode(code: string) {
    const gl = await this.prisma.glAccount.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, code },
    });
    if (!gl) throw new NotFoundException(`GL ${code} not seeded`);
    return gl;
  }

  async cashDeposit(input: {
    accountId: string;
    amountMinor: bigint;
    currency: string;
    makerUserId: string;
    idempotencyKey: string;
    reference?: string;
  }) {
    const account = await this.prisma.account.findFirst({
      where: { id: input.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");
    const cashGl = await this.glByCode("1000101");
    return this.postingEngine.post({
      reference: input.reference ?? `CASH-IN-${input.idempotencyKey}`,
      idempotencyKey: input.idempotencyKey,
      valueDate: new Date(),
      type: TxnType.DEPOSIT,
      makerUserId: input.makerUserId,
      branchId: account.branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: cashGl.id,
          branchId: account.branchId,
          debitMinor: input.amountMinor,
          creditMinor: 0n,
          currency: input.currency,
        },
        {
          accountId: account.id,
          glAccountId: account.glAccountId,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: input.amountMinor,
          currency: input.currency,
        },
      ],
    });
  }

  async cashWithdrawal(input: {
    accountId: string;
    amountMinor: bigint;
    currency: string;
    makerUserId: string;
    idempotencyKey: string;
    reference?: string;
  }) {
    const account = await this.prisma.account.findFirst({
      where: { id: input.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");
    const cashGl = await this.glByCode("1000101");
    return this.postingEngine.post({
      reference: input.reference ?? `CASH-OUT-${input.idempotencyKey}`,
      idempotencyKey: input.idempotencyKey,
      valueDate: new Date(),
      type: TxnType.WITHDRAWAL,
      makerUserId: input.makerUserId,
      branchId: account.branchId,
      legs: [
        {
          accountId: account.id,
          glAccountId: account.glAccountId,
          branchId: account.branchId,
          debitMinor: input.amountMinor,
          creditMinor: 0n,
          currency: input.currency,
        },
        {
          glAccountId: cashGl.id,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: input.amountMinor,
          currency: input.currency,
        },
      ],
    });
  }

  async internalTransfer(input: {
    fromAccountId: string;
    toAccountId: string;
    amountMinor: bigint;
    makerUserId: string;
    idempotencyKey: string;
    reference?: string;
  }) {
    const from = await this.prisma.account.findFirst({
      where: { id: input.fromAccountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    const to = await this.prisma.account.findFirst({
      where: { id: input.toAccountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!from || !to) throw new NotFoundException("Account not found");
    return this.postingEngine.post({
      reference: input.reference ?? `XFER-${input.idempotencyKey}`,
      idempotencyKey: input.idempotencyKey,
      valueDate: new Date(),
      type: TxnType.TRANSFER,
      makerUserId: input.makerUserId,
      branchId: from.branchId,
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
  }
}
