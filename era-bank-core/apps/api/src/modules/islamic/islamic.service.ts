import { Injectable, NotFoundException } from "@nestjs/common";
import { TxnType } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { assertIdempotencyKey } from "../../common/idempotency";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import {
  SystemGlConfigService,
  SystemGlKey,
} from "../../kernel/ledger/system-gl-config.service";

@Injectable()
export class IslamicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly systemGl: SystemGlConfigService,
  ) {}

  list() {
    return this.prisma.islamicContract.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
    });
  }

  create(input: {
    customerId: string;
    productTemplateId: string;
    kind: string;
    principalMinor: string;
  }) {
    return this.prisma.islamicContract.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        productTemplateId: input.productTemplateId,
        kind: input.kind,
        principalMinor: BigInt(input.principalMinor),
      },
    });
  }

  async activate(input: {
    id: string;
    branchId: string;
    makerUserId: string;
    idempotencyKey: string;
    profitMinor?: string;
  }) {
    const key = assertIdempotencyKey(input.idempotencyKey);
    const c = await this.prisma.islamicContract.findFirst({
      where: { id: input.id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!c) throw new NotFoundException("Islamic contract not found");
    const asset = await this.systemGl.resolve(SystemGlKey.ISLAMIC_ASSET);
    const liab = await this.systemGl.resolve(SystemGlKey.ISLAMIC_LIABILITY);
    const amount = c.principalMinor;
    const txn = await this.postingEngine.post({
      reference: `ISL-ACT:${c.id}`,
      idempotencyKey: key,
      valueDate: new Date(),
      type: TxnType.OPENING,
      makerUserId: input.makerUserId,
      branchId: input.branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: asset.id,
          branchId: input.branchId,
          debitMinor: amount,
          creditMinor: 0n,
          currency: c.currency,
        },
        {
          glAccountId: liab.id,
          branchId: input.branchId,
          debitMinor: 0n,
          creditMinor: amount,
          currency: c.currency,
        },
      ],
    });
    return this.prisma.islamicContract.update({
      where: { id: c.id },
      data: {
        status: "ACTIVE",
        profitMinor: BigInt(input.profitMinor ?? "0"),
        journalTxnId: txn.id,
      },
    });
  }
}
