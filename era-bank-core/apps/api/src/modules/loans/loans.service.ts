import { Injectable, NotFoundException } from "@nestjs/common";
import { InstallmentStatus, LoanStatus, TxnType } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { getProductGlCode } from "../../common/product-gl";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
  ) {}

  list() {
    return this.prisma.loanContract.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
    });
  }

  getById(id: string) {
    return this.prisma.loanContract.findFirst({
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

  private async productGlCodes(productTemplateId: string) {
    const template = await this.prisma.productTemplate.findFirst({
      where: { id: productTemplateId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!template) throw new NotFoundException("Product template not found");
    const assetCode = getProductGlCode(template.paramsJson, "glAssetCode");
    const interestIncomeCode = getProductGlCode(
      template.paramsJson,
      "glInterestIncomeCode",
    );
    return {
      loanGl: await this.glByCode(assetCode),
      interestGl: await this.glByCode(interestIncomeCode),
    };
  }

  originate(input: {
    customerId: string;
    productTemplateId: string;
    principalMinor: bigint;
    currency: string;
    termMonths: number;
    rateAnnual: number;
  }) {
    const monthlyRate = input.rateAnnual / 12;
    const n = input.termMonths;
    const p = Number(input.principalMinor);
    const pmt = Math.round((p * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n)));

    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loanContract.create({
        data: {
          bankOrgId: this.bankOrg.bankOrgId,
          customerId: input.customerId,
          productTemplateId: input.productTemplateId,
          principalMinor: input.principalMinor,
          outstandingMinor: input.principalMinor,
          currency: input.currency,
          status: LoanStatus.APPROVED,
          akbScore: 720,
        },
      });
      let remaining = input.principalMinor;
      for (let i = 1; i <= n; i += 1) {
        const interestMinor = BigInt(Math.round(Number(remaining) * monthlyRate));
        const principalPart = BigInt(pmt) - interestMinor;
        remaining -= principalPart;
        const due = new Date();
        due.setMonth(due.getMonth() + i);
        await tx.loanScheduleInstallment.create({
          data: {
            bankOrgId: this.bankOrg.bankOrgId,
            loanId: loan.id,
            sequenceNo: i,
            dueDate: due,
            principalMinor: principalPart,
            interestMinor,
            status: InstallmentStatus.SCHEDULED,
          },
        });
      }
      return loan;
    });
  }

  schedule(id: string) {
    return this.prisma.loanScheduleInstallment.findMany({
      where: { loanId: id, bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { sequenceNo: "asc" },
    });
  }

  async disburse(id: string, accountId: string, makerUserId = "service") {
    const loan = await this.prisma.loanContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!loan) throw new NotFoundException("Loan not found");

    const account = await this.prisma.account.findFirst({
      where: { id: accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");

    const { loanGl } = await this.productGlCodes(loan.productTemplateId);

    await this.postingEngine.post({
      reference: `LOAN-DISB-${id}`,
      idempotencyKey: `loan-disb-${id}`,
      valueDate: new Date(),
      type: TxnType.TRANSFER,
      makerUserId,
      branchId: account.branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: loanGl.id,
          branchId: account.branchId,
          debitMinor: loan.principalMinor,
          creditMinor: 0n,
          currency: loan.currency,
        },
        {
          accountId: account.id,
          glAccountId: account.glAccountId,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: loan.principalMinor,
          currency: loan.currency,
        },
      ],
    });

    return this.prisma.loanContract.update({
      where: { id },
      data: { status: LoanStatus.DISBURSED, accountId, disbursedAt: new Date() },
    });
  }

  async repay(id: string, amountMinor: bigint, makerUserId = "service") {
    const loan = await this.prisma.loanContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!loan) throw new NotFoundException("Loan not found");
    if (!loan.accountId) throw new NotFoundException("Loan has no disbursement account");

    const account = await this.prisma.account.findFirst({
      where: { id: loan.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");

    const { loanGl, interestGl } = await this.productGlCodes(loan.productTemplateId);

    const principalPart =
      amountMinor > loan.outstandingMinor ? loan.outstandingMinor : amountMinor;
    const interestPart = amountMinor - principalPart;

    const legs: Array<{
      accountId?: string;
      glAccountId: string;
      branchId: string;
      debitMinor: bigint;
      creditMinor: bigint;
      currency: string;
    }> = [
      {
        accountId: account.id,
        glAccountId: account.glAccountId,
        branchId: account.branchId,
        debitMinor: amountMinor,
        creditMinor: 0n,
        currency: loan.currency,
      },
      {
        glAccountId: loanGl.id,
        branchId: account.branchId,
        debitMinor: 0n,
        creditMinor: principalPart,
        currency: loan.currency,
      },
    ];

    if (interestPart > 0n) {
      legs.push({
        glAccountId: interestGl.id,
        branchId: account.branchId,
        debitMinor: 0n,
        creditMinor: interestPart,
        currency: loan.currency,
      });
    }

    await this.postingEngine.post({
      reference: `LOAN-REPAY-${id}-${Date.now()}`,
      idempotencyKey: `loan-repay-${id}-${amountMinor}`,
      valueDate: new Date(),
      type: TxnType.INTEREST,
      makerUserId,
      branchId: account.branchId,
      autoApprove: true,
      legs,
    });

    const outstanding = loan.outstandingMinor - amountMinor;
    return this.prisma.loanContract.update({
      where: { id },
      data: {
        outstandingMinor: outstanding < 0n ? 0n : outstanding,
        status: outstanding <= 0n ? LoanStatus.CLOSED : LoanStatus.ACTIVE,
      },
    });
  }

  restructure(id: string, ifrs9Stage: number) {
    return this.prisma.loanContract.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { ifrs9Stage, status: LoanStatus.ACTIVE },
    });
  }
}
