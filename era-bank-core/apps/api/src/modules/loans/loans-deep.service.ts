import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreditLineStatus,
  DrawdownStatus,
  ForbearanceStage,
  LoanApplicationStatus,
  LoanStatus,
  Prisma,
  TxnType,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { assertIdempotencyKey } from "../../common/idempotency";
import {
  assertForbearanceTransition,
  type CreditPolicyRulesJson,
} from "../../common/fc2-fc7.util";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import { ProductFactoryService } from "../../kernel/product-factory/product-factory.service";
import { getProductGlCode } from "../../common/product-gl";
import { createCreditBureauAdapter } from "./bureau.adapter";
import { applyCreditPolicy } from "./credit-score.engine";

@Injectable()
export class LoansDeepService {
  private readonly bureau = createCreditBureauAdapter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly products: ProductFactoryService,
  ) {}

  listApplications(status?: LoanApplicationStatus) {
    return this.prisma.loanApplication.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  createApplication(input: {
    customerId: string;
    productTemplateId: string;
    requestedMinor: bigint;
    currency?: string;
    makerUserId?: string;
  }) {
    return this.prisma.loanApplication.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        productTemplateId: input.productTemplateId,
        requestedMinor: input.requestedMinor,
        currency: input.currency ?? "AZN",
        status: LoanApplicationStatus.DRAFT,
        makerUserId: input.makerUserId,
      },
    });
  }

  submitApplication(id: string) {
    return this.prisma.loanApplication.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { status: LoanApplicationStatus.SUBMITTED },
    });
  }

  async approveApplication(id: string, checkerUserId: string) {
    const app = await this.prisma.loanApplication.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!app) throw new NotFoundException("Loan application not found");
    if (app.makerUserId === checkerUserId) {
      throw new ForbiddenException("Checker must differ from maker");
    }
    return this.prisma.loanApplication.update({
      where: { id },
      data: {
        status: LoanApplicationStatus.APPROVED,
        checkerUserId,
      },
    });
  }

  setForbearance(id: string, reason: string, stage?: ForbearanceStage) {
    return this.prisma.loanApplication.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: {
        forbearanceReason: reason,
        forbearanceStage: stage ?? ForbearanceStage.WATCH,
        watchlist: true,
      },
    });
  }

  async advanceForbearanceStage(id: string, stage: ForbearanceStage) {
    const app = await this.prisma.loanApplication.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!app) throw new NotFoundException("Loan application not found");
    assertForbearanceTransition(app.forbearanceStage, stage);
    return this.prisma.loanApplication.update({
      where: { id },
      data: {
        forbearanceStage: stage,
        watchlist: stage !== ForbearanceStage.NONE,
      },
    });
  }

  listCreditPolicyRules() {
    return this.prisma.creditPolicyRule.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { code: "asc" },
    });
  }

  upsertCreditPolicyRule(input: {
    code: string;
    name: string;
    rulesJson: CreditPolicyRulesJson;
    enabled?: boolean;
  }) {
    return this.prisma.creditPolicyRule.upsert({
      where: {
        bankOrgId_code: {
          bankOrgId: this.bankOrg.bankOrgId,
          code: input.code,
        },
      },
      create: {
        bankOrgId: this.bankOrg.bankOrgId,
        code: input.code,
        name: input.name,
        rulesJson: input.rulesJson as Prisma.InputJsonValue,
        enabled: input.enabled ?? true,
      },
      update: {
        name: input.name,
        rulesJson: input.rulesJson as Prisma.InputJsonValue,
        enabled: input.enabled,
      },
    });
  }

  listCreditLines(customerId?: string) {
    return this.prisma.creditLine.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(customerId ? { customerId } : {}),
      },
      include: { drawdowns: true },
      orderBy: { createdAt: "desc" },
    });
  }

  createCreditLine(input: {
    customerId: string;
    productTemplateId: string;
    limitMinor: bigint;
    currency?: string;
    participationPct?: number;
    leadBankName?: string;
  }) {
    return this.prisma.creditLine.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        productTemplateId: input.productTemplateId,
        limitMinor: input.limitMinor,
        currency: input.currency ?? "AZN",
        status: CreditLineStatus.ACTIVE,
        participationPct: input.participationPct,
        leadBankName: input.leadBankName,
      },
    });
  }

  async requestDrawdown(input: {
    creditLineId: string;
    amountMinor: bigint;
    accountId?: string;
    idempotencyKey: string;
    makerUserId?: string;
  }) {
    const line = await this.prisma.creditLine.findFirst({
      where: {
        id: input.creditLineId,
        bankOrgId: this.bankOrg.bankOrgId,
      },
    });
    if (!line) throw new NotFoundException("Credit line not found");
    if (line.status !== CreditLineStatus.ACTIVE) {
      throw new BadRequestException("Credit line not active");
    }
    if (line.drawnMinor + input.amountMinor > line.limitMinor) {
      throw new BadRequestException("Drawdown exceeds credit line limit");
    }

    return this.prisma.creditLineDrawdown.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        creditLineId: input.creditLineId,
        amountMinor: input.amountMinor,
        accountId: input.accountId,
        status: DrawdownStatus.REQUESTED,
        idempotencyKey: assertIdempotencyKey(input.idempotencyKey),
        makerUserId: input.makerUserId,
      },
    });
  }

  approveDrawdown(id: string, checkerUserId: string) {
    return this.prisma.creditLineDrawdown.updateMany({
      where: {
        id,
        bankOrgId: this.bankOrg.bankOrgId,
        status: DrawdownStatus.REQUESTED,
      },
      data: { status: DrawdownStatus.APPROVED, makerUserId: checkerUserId },
    });
  }

  async disburseDrawdown(id: string, makerUserId: string) {
    const drawdown = await this.prisma.creditLineDrawdown.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      include: { creditLine: true },
    });
    if (!drawdown) throw new NotFoundException("Drawdown not found");
    if (drawdown.status !== DrawdownStatus.APPROVED) {
      throw new BadRequestException("Drawdown must be APPROVED");
    }
    if (!drawdown.accountId) {
      throw new BadRequestException("accountId required on drawdown");
    }

    const account = await this.prisma.account.findFirst({
      where: { id: drawdown.accountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");

    const template = await this.products.assertActiveLoanProduct(
      drawdown.creditLine.productTemplateId,
    );
    const assetCode = getProductGlCode(template.paramsJson, "glAssetCode");
    const loanGl = await this.prisma.glAccount.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, code: assetCode },
    });
    if (!loanGl) throw new NotFoundException(`GL ${assetCode} not seeded`);

    const txn = await this.postingEngine.post({
      reference: `CL-DRAW-${id}`,
      idempotencyKey: `cl-draw-disb-${id}`,
      valueDate: new Date(),
      type: TxnType.TRANSFER,
      makerUserId,
      branchId: account.branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: loanGl.id,
          branchId: account.branchId,
          debitMinor: drawdown.amountMinor,
          creditMinor: 0n,
          currency: drawdown.creditLine.currency,
        },
        {
          accountId: account.id,
          glAccountId: account.glAccountId,
          branchId: account.branchId,
          debitMinor: 0n,
          creditMinor: drawdown.amountMinor,
          currency: drawdown.creditLine.currency,
        },
      ],
    });

    await this.prisma.creditLine.update({
      where: { id: drawdown.creditLineId },
      data: {
        drawnMinor: drawdown.creditLine.drawnMinor + drawdown.amountMinor,
      },
    });

    return this.prisma.creditLineDrawdown.update({
      where: { id },
      data: {
        status: DrawdownStatus.DISBURSED,
        journalTxnId: txn.id,
      },
    });
  }

  async score(customerId: string, applicationId?: string) {
    const bureau = await this.bureau.pullScore({
      customerId,
      bankOrgId: this.bankOrg.bankOrgId,
    });

    const customer = await this.prisma.bankCustomer.findFirst({
      where: { id: customerId, bankOrgId: this.bankOrg.bankOrgId },
    });

    const application = applicationId
      ? await this.prisma.loanApplication.findFirst({
          where: { id: applicationId, bankOrgId: this.bankOrg.bankOrgId },
        })
      : null;

    const policy = await this.prisma.creditPolicyRule.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, enabled: true },
      orderBy: { updatedAt: "desc" },
    });
    const rules = (policy?.rulesJson ?? {
      minScoreApprove: 600,
      minScoreReview: 500,
      pepAutoReview: true,
    }) as CreditPolicyRulesJson;

    const decision = applyCreditPolicy({
      bureauScore: bureau.score,
      rules,
      pepFlag: customer?.pepFlag,
      requestedMinor: application?.requestedMinor,
    });

    await this.prisma.creditDecisionRequest.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId,
        applicationId,
        rulesJson: {
          source: "bureau+policy",
          policyCode: policy?.code ?? "DEFAULT",
          ...decision.rulesApplied,
        } as Prisma.InputJsonValue,
        score: decision.score,
        decision: decision.decision,
        reasonCodes: decision.reasonCodes,
      },
    });

    return { ...bureau, ...decision, policyCode: policy?.code ?? "DEFAULT" };
  }

  recordCollateralValuation(input: {
    loanId: string;
    amountMinor: bigint;
    currency?: string;
    valuedAt: Date;
    valuerNote?: string;
  }) {
    return this.prisma.collateralValuation.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        loanId: input.loanId,
        amountMinor: input.amountMinor,
        currency: input.currency ?? "AZN",
        valuedAt: input.valuedAt,
        valuerNote: input.valuerNote,
      },
    });
  }

  registerLien(input: {
    loanId: string;
    lienRef: string;
    description: string;
    amountMinor: bigint;
    currency?: string;
    registeredAt: Date;
  }) {
    return this.prisma.lienRegister.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        loanId: input.loanId,
        lienRef: input.lienRef,
        description: input.description,
        amountMinor: input.amountMinor,
        currency: input.currency ?? "AZN",
        registeredAt: input.registeredAt,
      },
    });
  }

  releaseLien(lienRef: string) {
    return this.prisma.lienRegister.updateMany({
      where: { bankOrgId: this.bankOrg.bankOrgId, lienRef },
      data: { releasedAt: new Date() },
    });
  }
}
