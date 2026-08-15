import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";

@Injectable()
export class PsaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  listAccounts() {
    return this.prisma.psaTsaAccount.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { accountNo: "asc" },
    });
  }

  createAccount(input: {
    agencyCode: string;
    accountNo: string;
    treasuryCode: string;
  }) {
    return this.prisma.psaTsaAccount.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        agencyCode: input.agencyCode,
        accountNo: input.accountNo,
        treasuryCode: input.treasuryCode,
      },
    });
  }
}
