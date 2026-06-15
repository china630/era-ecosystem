import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AccountStatus } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { CifService } from "../cif/cif.service";

function mod97(input: string): number {
  let remainder = 0;
  for (const ch of input) {
    remainder = (remainder * 10 + Number(ch)) % 97;
  }
  return remainder;
}

export function generateAzIban(bankCode: string, accountNumber: string): string {
  const bban = `${bankCode}${accountNumber}`.replace(/\D/g, "");
  const checkBase = `${bban}172700`;
  const check = String(98 - mod97(checkBase)).padStart(2, "0");
  return `AZ${check}${bban}`;
}

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly cif: CifService,
  ) {}

  listGlAccounts() {
    return this.prisma.glAccount.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { code: "asc" },
    });
  }

  listAccounts(filters?: {
    customerId?: string;
    branchId?: string;
    iban?: string;
    status?: AccountStatus;
  }) {
    return this.prisma.account.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: filters?.customerId,
        branchId: filters?.branchId,
        iban: filters?.iban ? { contains: filters.iban, mode: "insensitive" } : undefined,
        status: filters?.status,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  getAccount(id: string) {
    return this.prisma.account.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      include: { holds: { where: { status: "ACTIVE" } } },
    });
  }

  async openAccount(input: {
    customerId: string;
    branchId: string;
    glAccountId: string;
    productId?: string;
    currency: string;
    makerUserId: string;
    idempotencyKey: string;
  }) {
    await this.cif.assertExists(input.customerId);
    const seq = Date.now().toString().slice(-10);
    const iban = generateAzIban("200001", seq);

    return this.prisma.account.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        iban,
        customerId: input.customerId,
        branchId: input.branchId,
        glAccountId: input.glAccountId,
        productId: input.productId,
        currency: input.currency,
        status: AccountStatus.ACTIVE,
      },
    });
  }

  async getStatement(accountId: string, from: Date, to: Date) {
    const account = await this.getAccount(accountId);
    if (!account) throw new NotFoundException("Account not found");
    return this.prisma.journalEntry.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        accountId,
        createdAt: { gte: from, lte: to },
      },
      include: { transaction: true },
      orderBy: { createdAt: "asc" },
    });
  }

  placeHold(
    accountId: string,
    amountMinor: bigint,
    reason: "MANUAL" | "CARD_AUTH" | "PAYMENT_PENDING",
    expiresAt?: Date,
  ) {
    return this.prisma.accountHold.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        accountId,
        amountMinor,
        reason,
        status: "ACTIVE",
        expiresAt,
      },
    });
  }

  releaseHold(accountId: string, holdId: string) {
    return this.prisma.accountHold.updateMany({
      where: { id: holdId, accountId, bankOrgId: this.bankOrg.bankOrgId, status: "ACTIVE" },
      data: { status: "RELEASED" },
    });
  }

  async closeAccount(accountId: string) {
    const account = await this.getAccount(accountId);
    if (!account) throw new NotFoundException("Account not found");
    if (account.status === AccountStatus.CLOSED) {
      throw new BadRequestException("Account already closed");
    }
    if (account.availableBalanceMinor !== 0n) {
      throw new BadRequestException("Account available balance must be zero to close");
    }
    const activeHolds = await this.prisma.accountHold.count({
      where: {
        accountId,
        bankOrgId: this.bankOrg.bankOrgId,
        status: "ACTIVE",
      },
    });
    if (activeHolds > 0) {
      throw new BadRequestException("Release all holds before closing account");
    }
    return this.prisma.account.update({
      where: { id: accountId },
      data: { status: AccountStatus.CLOSED },
    });
  }

  async trialBalance(asOf: Date) {
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        transaction: { status: "POSTED", bookingDate: { lte: asOf } },
      },
    });
    const byGl = new Map<string, { debitMinor: bigint; creditMinor: bigint; currency: string }>();
    for (const e of entries) {
      const row = byGl.get(e.glAccountId) ?? { debitMinor: 0n, creditMinor: 0n, currency: e.currency };
      row.debitMinor += e.debitMinor;
      row.creditMinor += e.creditMinor;
      byGl.set(e.glAccountId, row);
    }
    return [...byGl.entries()].map(([glAccountId, totals]) => ({ glAccountId, ...totals }));
  }
}
