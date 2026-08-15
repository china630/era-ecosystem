import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";

@Injectable()
export class MultiEntityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  isMultiEntityEnabled(): boolean {
    return process.env.BANK_MULTI_ENTITY === "1";
  }

  listAgencyLinks() {
    return this.prisma.agencyLink.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
    });
  }

  createAgencyLink(input: {
    peerBankOrgId: string;
    agencyType: string;
  }) {
    if (!this.isMultiEntityEnabled()) {
      return {
        labOnly: true,
        note: "BANK_MULTI_ENTITY=0 — default single bankOrg per deployment (ADR D5)",
        link: null,
      };
    }
    return this.prisma.agencyLink
      .create({
        data: {
          bankOrgId: this.bankOrg.bankOrgId,
          peerBankOrgId: input.peerBankOrgId,
          agencyType: input.agencyType,
        },
      })
      .then((link) => ({ labOnly: false, link }));
  }
}
