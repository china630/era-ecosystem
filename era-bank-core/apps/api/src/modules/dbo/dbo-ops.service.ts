import { Injectable } from "@nestjs/common";
import { H2hJobStatus, ObConsentStatus, Prisma } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";

@Injectable()
export class DboOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  listH2hJobs(status?: H2hJobStatus) {
    return this.prisma.dboH2hFileJob.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  receiveH2hJob(input: { fileName: string; payload: string }) {
    return this.prisma.dboH2hFileJob.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        fileName: input.fileName,
        payload: input.payload,
        status: H2hJobStatus.RECEIVED,
      },
    });
  }

  async parseH2hJob(id: string) {
    const job = await this.prisma.dboH2hFileJob.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!job) return null;
    return this.prisma.dboH2hFileJob.update({
      where: { id },
      data: {
        status: H2hJobStatus.PARSED,
        resultJson: { lineCount: job.payload.split("\n").length },
      },
    });
  }

  listObConsents(customerId?: string) {
    return this.prisma.openBankingConsent.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  createObConsent(input: {
    customerId: string;
    scopes?: string[];
    expiresAt?: Date;
  }) {
    return this.prisma.openBankingConsent.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        scopes: (input.scopes ?? ["accounts:read"]) as Prisma.InputJsonValue,
        status: ObConsentStatus.ACTIVE,
        expiresAt: input.expiresAt,
      },
    });
  }

  revokeObConsent(id: string) {
    return this.prisma.openBankingConsent.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { status: ObConsentStatus.REVOKED },
    });
  }
}
