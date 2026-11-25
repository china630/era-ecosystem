import { Injectable } from "@nestjs/common";
import { InstitutionType } from "@era/bank-core-database";
import { PrismaService } from "../prisma/prisma.service";
import { BankOrgConfig } from "./bank-org.config";

@Injectable()
export class InstitutionConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  /** Defaults to BANK when row missing (pre-migration or first boot before seed). */
  async getInstitutionType(): Promise<InstitutionType> {
    const row = await this.prisma.bankInstitutionConfig.findUnique({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      select: { institutionType: true },
    });
    return row?.institutionType ?? InstitutionType.BANK;
  }
}