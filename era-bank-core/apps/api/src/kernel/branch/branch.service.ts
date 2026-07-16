import { Injectable, NotFoundException } from "@nestjs/common";
import { BranchStatus } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import {
  SystemGlConfigService,
  SystemGlKey,
} from "../ledger/system-gl-config.service";
import { PostingEngineService } from "../posting-engine/posting-engine.service";
import { TxnType } from "@era/bank-core-database";
import { buildCrossBranchWithdrawalLegs } from "./interbranch.builder";

@Injectable()
export class BranchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly systemGl: SystemGlConfigService,
  ) {}

  list() {
    return this.prisma.branch.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { code: "asc" },
    });
  }

  create(data: { code: string; name: string; parentId?: string; isHeadOffice?: boolean }) {
    return this.prisma.branch.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        code: data.code,
        name: data.name,
        parentId: data.parentId,
        isHeadOffice: data.isHeadOffice ?? false,
        status: BranchStatus.ACTIVE,
      },
    });
  }

  async postCrossBranchWithdrawal(input: {
    customerAccountId: string;
    serviceBranchId: string;
    amountMinor: bigint;
    currency: string;
    makerUserId: string;
    idempotencyKey: string;
    reference: string;
  }) {
    const account = await this.prisma.account.findFirst({
      where: { id: input.customerAccountId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!account) throw new NotFoundException("Account not found");

    const mfrGl = await this.systemGl.resolve(SystemGlKey.MFR_SETTLEMENT);
    const cashGl = await this.systemGl.resolve(SystemGlKey.CASH_VAULT);

    const legs = buildCrossBranchWithdrawalLegs({
      amountMinor: input.amountMinor,
      currency: input.currency,
      customerAccountId: account.id,
      customerGlAccountId: account.glAccountId,
      homeBranchId: account.branchId,
      serviceBranchId: input.serviceBranchId,
      mfrGlAccountId: mfrGl.id,
      cashGlAccountId: cashGl.id,
    });

    return this.postingEngine.post({
      reference: input.reference,
      idempotencyKey: input.idempotencyKey,
      valueDate: new Date(),
      type: TxnType.INTERBRANCH,
      makerUserId: input.makerUserId,
      branchId: input.serviceBranchId,
      legs,
    });
  }
}
