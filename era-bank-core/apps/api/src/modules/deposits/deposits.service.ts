import { Injectable, NotFoundException } from "@nestjs/common";
import { DepositStatus, TxnType } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { getProductGlCode } from "../../common/product-gl";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";

@Injectable()
export class DepositsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
  ) {}

  list() {
    return this.prisma.depositContract.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { openedAt: "desc" },
    });
  }

  getById(id: string) {
    return this.prisma.depositContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
  }

  private async glByCode(code: string) {
    const gl = await this.prisma.glAccount.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, code },
    });
    if (!gl) throw new NotFoundException(`GL ${code} not seeded`);
    return gl;
  }

  private async termLiabilityGl(productTemplateId: string) {
    const template = await this.prisma.productTemplate.findFirst({
      where: { id: productTemplateId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!template) throw new NotFoundException("Product template not found");
    const code = getProductGlCode(template.paramsJson, "glLiabilityCode");
    return this.glByCode(code);
  }

  async open(input: {
    accountId: string;
    customerId: string;
    productTemplateId: string;
    principalMinor: bigint;
    currency: string;
    maturityDate?: Date;
    makerUserId?: string;
    idempotencyKey?: string;
  }) {
    const account = await this.prisma.account.findFirst({
      where: { id: input.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");

    const termGl = await this.termLiabilityGl(input.productTemplateId);
    const idempotencyKey = input.idempotencyKey ?? `dep-open-${Date.now()}`;

    await this.postingEngine.post({
      reference: `DEP-OPEN-${idempotencyKey}`,
      idempotencyKey: `dep-post-${idempotencyKey}`,
      valueDate: new Date(),
      type: TxnType.DEPOSIT,
      makerUserId: input.makerUserId ?? "service",
      branchId: account.branchId,
      autoApprove: true,
      legs: [
        {
          accountId: account.id,
          glAccountId: account.glAccountId,
          branchId: account.branchId,
          debitMinor: input.principalMinor,
          creditMinor: 0n,
          currency: input.currency,
        },
        {
          glAccountId: termGl.id,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: input.principalMinor,
          currency: input.currency,
        },
      ],
    });

    return this.prisma.depositContract.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        accountId: input.accountId,
        customerId: input.customerId,
        productTemplateId: input.productTemplateId,
        principalMinor: input.principalMinor,
        currency: input.currency,
        openedAt: new Date(),
        maturityDate: input.maturityDate,
        status: DepositStatus.ACTIVE,
        adifTagged: true,
      },
    });
  }

  async close(id: string, makerUserId = "service") {
    const dep = await this.prisma.depositContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!dep) throw new NotFoundException("Deposit not found");

    const account = await this.prisma.account.findFirst({
      where: { id: dep.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");

    const termGl = await this.termLiabilityGl(dep.productTemplateId);

    await this.postingEngine.post({
      reference: `DEP-CLOSE-${id}`,
      idempotencyKey: `dep-close-${id}`,
      valueDate: new Date(),
      type: TxnType.DEPOSIT,
      makerUserId,
      branchId: account.branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: termGl.id,
          branchId: account.branchId,
          debitMinor: dep.principalMinor,
          creditMinor: 0n,
          currency: dep.currency,
        },
        {
          accountId: account.id,
          glAccountId: account.glAccountId,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: dep.principalMinor,
          currency: dep.currency,
        },
      ],
    });

    return this.prisma.depositContract.update({
      where: { id },
      data: { status: DepositStatus.EARLY_CLOSED },
    });
  }

  /**
   * Rollover extends maturity only — no GL posting when principal is unchanged.
   * Accrued interest capitalization on rollover is a future enhancement (separate
   * posting legs); open/close postings remain balanced debit/credit pairs.
   */
  async rollover(id: string, newMaturityDate: Date) {
    const dep = await this.prisma.depositContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!dep) throw new NotFoundException("Deposit not found");
    return this.prisma.depositContract.update({
      where: { id },
      data: { maturityDate: newMaturityDate, status: DepositStatus.ACTIVE },
    });
  }
}
