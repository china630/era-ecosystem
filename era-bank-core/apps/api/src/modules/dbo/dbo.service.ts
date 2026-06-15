import { Injectable } from "@nestjs/common";
import { CredentialStatus, SignatoryRole, SignatoryStatus } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";

@Injectable()
export class DboService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  registerCredential(input: { customerId: string; loginHash: string; passwordHash?: string }) {
    return this.prisma.dboCustomerCredential.upsert({
      where: {
        bankOrgId_customerId: { bankOrgId: this.bankOrg.bankOrgId, customerId: input.customerId },
      },
      create: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        loginHash: input.loginHash,
        passwordHash: input.passwordHash,
        status: CredentialStatus.ACTIVE,
      },
      update: { loginHash: input.loginHash, passwordHash: input.passwordHash },
    });
  }

  createOtpChallenge(customerId: string, codeHash: string, expiresAt: Date) {
    return this.prisma.dboOtpChallenge.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId,
        codeHash,
        expiresAt,
      },
    });
  }

  addSignatory(input: {
    customerId: string;
    globalPersonId: string;
    role: SignatoryRole;
    limitMinor?: bigint;
  }) {
    return this.prisma.corporateSignatory.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        globalPersonId: input.globalPersonId,
        role: input.role,
        limitMinor: input.limitMinor,
        status: SignatoryStatus.ACTIVE,
      },
    });
  }
}
