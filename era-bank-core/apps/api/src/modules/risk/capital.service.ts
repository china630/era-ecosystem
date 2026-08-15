import { Injectable } from "@nestjs/common";
import { LoanStatus } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";

const STAGE_WEIGHT: Record<1 | 2 | 3, number> = {
  1: 1.0,
  2: 1.0,
  3: 1.5,
};

@Injectable()
export class CapitalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  private tier1CapitalMinor(): bigint {
    const raw = process.env.BANK_TIER1_CAPITAL_MINOR ?? "10000000000";
    try {
      return BigInt(raw);
    } catch {
      return 10_000_000_000n;
    }
  }

  async computeRwa(asOfDate: Date = new Date()) {
    const loans = await this.prisma.loanContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: {
          in: [
            LoanStatus.DISBURSED,
            LoanStatus.ACTIVE,
            LoanStatus.OVERDUE,
            LoanStatus.APPROVED,
          ],
        },
      },
    });

    let creditRwa = 0n;
    const details: Array<{
      loanId: string;
      stage: number;
      outstandingMinor: string;
      weight: number;
      rwaMinor: string;
    }> = [];

    for (const loan of loans) {
      const stage = (
        loan.ifrs9Stage === 2 || loan.ifrs9Stage === 3 ? loan.ifrs9Stage : 1
      ) as 1 | 2 | 3;
      const weight = STAGE_WEIGHT[stage];
      const rwa = BigInt(Math.round(Number(loan.outstandingMinor) * weight));
      creditRwa += rwa;
      details.push({
        loanId: loan.id,
        stage,
        outstandingMinor: loan.outstandingMinor.toString(),
        weight,
        rwaMinor: rwa.toString(),
      });
    }

    return this.prisma.rwaSnapshot.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        asOfDate,
        totalRwaMinor: creditRwa,
        creditRwaMinor: creditRwa,
        detailsJson: { loans: details, weights: STAGE_WEIGHT },
      },
    });
  }

  async capitalAdequacy(asOfDate: Date = new Date(), rwaMinor?: bigint) {
    let rwa = rwaMinor;
    if (rwa == null) {
      const snap = await this.computeRwa(asOfDate);
      rwa = snap.totalRwaMinor;
    }
    const tier1 = this.tier1CapitalMinor();
    const total = tier1;
    const carRatio = rwa > 0n ? Number(total) / Number(rwa) : 0;
    const tier1Ratio = carRatio;

    return this.prisma.capitalAdequacySnapshot.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        asOfDate,
        tier1CapitalMinor: tier1,
        totalCapitalMinor: total,
        rwaMinor: rwa,
        carRatio,
        tier1Ratio,
      },
    });
  }

  async largeExposures(limit = 10) {
    const capital = this.tier1CapitalMinor();
    const loans = await this.prisma.loanContract.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: {
          in: [LoanStatus.DISBURSED, LoanStatus.ACTIVE, LoanStatus.OVERDUE],
        },
      },
      orderBy: { outstandingMinor: "desc" },
      take: limit,
    });
    return loans.map((l) => ({
      loanId: l.id,
      customerId: l.customerId,
      outstandingMinor: l.outstandingMinor.toString(),
      pctOfCapital:
        capital > 0n
          ? Number(l.outstandingMinor) / Number(capital)
          : null,
    }));
  }

  lastRwa() {
    return this.prisma.rwaSnapshot.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { asOfDate: "desc" },
    });
  }

  lastCar() {
    return this.prisma.capitalAdequacySnapshot.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { asOfDate: "desc" },
    });
  }
}
