import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  LeaseAssetStatus,
  LeaseContractStatus,
  ProductKind,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { LoansService } from "../loans/loans.service";
import { buildLeaseOriginationShape } from "./leasing.shape";
import {
  buildFinanceLeaseSchedule,
  buyoutQuoteMinor,
  dailyFinanceIncomeMinor,
} from "./lease-ifrs16.util";

@Injectable()
export class LeasingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly loans: LoansService,
  ) {}

  listPortfolio() {
    return this.prisma.leaseContract.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      include: { asset: true, loan: true },
      orderBy: { createdAt: "desc" },
    });
  }

  listAssets() {
    return this.prisma.leaseAsset.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createAsset(input: {
    description: string;
    catalogValueMinor: string;
    serialRef?: string;
    currency?: string;
  }) {
    const catalogValueMinor = BigInt(input.catalogValueMinor);
    if (catalogValueMinor <= 0n) {
      throw new BadRequestException("catalogValueMinor must be positive");
    }
    return this.prisma.leaseAsset.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        description: input.description.trim(),
        serialRef: input.serialRef?.trim() || null,
        catalogValueMinor,
        currency: input.currency ?? "AZN",
        status: LeaseAssetStatus.AVAILABLE,
      },
    });
  }

  async originateLease(input: {
    customerId: string;
    assetId: string;
    productTemplateId: string;
    advancePct: number;
    residualValueMinor: string;
    termMonths: number;
    rateAnnual?: number;
    makerUserId?: string;
    linkLoan?: boolean;
  }) {
    const asset = await this.prisma.leaseAsset.findFirst({
      where: { id: input.assetId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!asset) throw new NotFoundException("Lease asset not found");
    if (asset.status !== LeaseAssetStatus.AVAILABLE) {
      throw new BadRequestException("Asset is not available for lease");
    }

    const shape = buildLeaseOriginationShape({
      catalogValueMinor: asset.catalogValueMinor,
      advancePct: input.advancePct,
      residualValueMinor: BigInt(input.residualValueMinor),
      termMonths: input.termMonths,
    });

    let loanContractId: string | null = null;
    if (input.linkLoan !== false) {
      const template = await this.prisma.productTemplate.findFirst({
        where: {
          id: input.productTemplateId,
          bankOrgId: this.bankOrg.bankOrgId,
          kind: ProductKind.LOAN_LEASE,
        },
      });
      if (!template) {
        throw new BadRequestException(
          "productTemplateId must be an active LOAN_LEASE template",
        );
      }
      const loan = await this.loans.originate({
        customerId: input.customerId,
        productTemplateId: input.productTemplateId,
        principalMinor: shape.financedPrincipalMinor,
        termMonths: input.termMonths,
        rateAnnual: input.rateAnnual,
        assetRef: asset.id,
        makerUserId: input.makerUserId,
      });
      loanContractId = loan.id;
    }

    return this.prisma.$transaction(async (tx) => {
      const lease = await tx.leaseContract.create({
        data: {
          bankOrgId: this.bankOrg.bankOrgId,
          customerId: input.customerId,
          assetId: asset.id,
          loanContractId,
          advancePct: input.advancePct,
          residualValueMinor: shape.residualValueMinor,
          termMonths: input.termMonths,
          rateAnnual: input.rateAnnual ?? 0,
          netInvestmentMinor: shape.financedPrincipalMinor,
          currency: asset.currency,
          status: LeaseContractStatus.DRAFT,
        },
        include: { asset: true, loan: true },
      });
      await tx.leaseAsset.update({
        where: { id: asset.id },
        data: { status: LeaseAssetStatus.LEASED },
      });
      return lease;
    });
  }

  async getById(id: string) {
    const lease = await this.prisma.leaseContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      include: { asset: true, loan: true },
    });
    if (!lease) throw new NotFoundException("Lease contract not found");
    return lease;
  }

  /** IFRS 16 lab schedule (computed; methodology=lab). */
  async getSchedule(id: string) {
    const lease = await this.getById(id);
    const rate = Number(lease.rateAnnual);
    const net =
      lease.netInvestmentMinor > 0n
        ? lease.netInvestmentMinor
        : lease.loan?.principalMinor ?? 0n;
    const lines = buildFinanceLeaseSchedule({
      netInvestmentMinor: net,
      residualValueMinor: lease.residualValueMinor,
      termMonths: lease.termMonths,
      rateAnnual: rate,
      startDate: lease.createdAt,
    });
    return {
      leaseId: lease.id,
      methodology: "lab",
      ifrs16Lab: true,
      notCertified: true,
      netInvestmentMinor: net.toString(),
      residualValueMinor: lease.residualValueMinor.toString(),
      accruedFinanceIncomeMinor: lease.accruedFinanceIncomeMinor.toString(),
      lines: lines.map((l) => ({
        ...l,
        principalMinor: l.principalMinor.toString(),
        interestMinor: l.interestMinor.toString(),
        vatMinor: l.vatMinor.toString(),
        paymentMinor: l.paymentMinor.toString(),
        remainingNetInvestmentMinor: l.remainingNetInvestmentMinor.toString(),
        dueDate: l.dueDate.toISOString(),
      })),
    };
  }

  async buyoutQuote(id: string) {
    const lease = await this.getById(id);
    const remaining =
      lease.loan?.outstandingMinor ??
      (lease.netInvestmentMinor > lease.residualValueMinor
        ? lease.netInvestmentMinor - lease.residualValueMinor
        : 0n);
    const quote = buyoutQuoteMinor({
      residualValueMinor: lease.residualValueMinor,
      remainingPrincipalMinor: remaining,
    });
    return {
      leaseId: lease.id,
      methodology: "lab",
      residualValueMinor: lease.residualValueMinor.toString(),
      remainingPrincipalMinor: remaining.toString(),
      buyoutMinor: quote.toString(),
      currency: lease.currency,
    };
  }

  /** Lab finance income accrual on net investment (no GL post until SystemGl lease keys seeded). */
  async accrueFinanceIncome(id: string, asOf: Date = new Date()) {
    const lease = await this.getById(id);
    if (lease.status !== LeaseContractStatus.ACTIVE) {
      throw new BadRequestException(
        "Lease must be ACTIVE to accrue finance income (DRAFT→ACTIVE requires originate/disburse path, not accrual)",
      );
    }
    const asOfDay = asOf.toISOString().slice(0, 10);
    if (lease.lastFinanceAccrualDate) {
      const lastDay = lease.lastFinanceAccrualDate.toISOString().slice(0, 10);
      if (lastDay === asOfDay) {
        return {
          leaseId: lease.id,
          accruedFinanceIncomeMinor: lease.accruedFinanceIncomeMinor.toString(),
          dailyIncomeMinor: "0",
          methodology: "lab",
          skipped: true,
          note: "Already accrued for this UTC day — no double count",
        };
      }
    }
    const net =
      lease.netInvestmentMinor > 0n
        ? lease.netInvestmentMinor
        : lease.loan?.outstandingMinor ?? 0n;
    const daily = dailyFinanceIncomeMinor(net, Number(lease.rateAnnual));
    const updated = await this.prisma.leaseContract.update({
      where: { id: lease.id },
      data: {
        accruedFinanceIncomeMinor: lease.accruedFinanceIncomeMinor + daily,
        lastFinanceAccrualDate: asOf,
      },
    });
    return {
      leaseId: updated.id,
      accruedFinanceIncomeMinor: updated.accruedFinanceIncomeMinor.toString(),
      dailyIncomeMinor: daily.toString(),
      methodology: "lab",
      note: "IFRS 16 finance income lab accrual — GL post deferred (INTEREST_INCOME)",
    };
  }
}
