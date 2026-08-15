import { Injectable } from "@nestjs/common";
import { PensionContributionStatus } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";

@Injectable()
export class PensionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  listContributions() {
    return this.prisma.pensionContribution.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  createContribution(input: {
    customerId: string;
    employerRef: string;
    amountMinor: string;
    periodMonth: string;
    currency?: string;
  }) {
    return this.prisma.pensionContribution.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        employerRef: input.employerRef,
        amountMinor: BigInt(input.amountMinor),
        periodMonth: input.periodMonth,
        currency: input.currency ?? "AZN",
        status: PensionContributionStatus.PENDING,
      },
    });
  }

  postContribution(id: string) {
    return this.prisma.pensionContribution.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { status: PensionContributionStatus.POSTED },
    });
  }
}
