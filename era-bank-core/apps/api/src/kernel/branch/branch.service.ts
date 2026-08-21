import { Injectable, NotFoundException } from "@nestjs/common";

import { BranchStatus, TxnType } from "@era/bank-core-database";

import { PrismaService } from "../../prisma/prisma.service";

import { BankOrgConfig } from "../../common/bank-org.config";

import {

  SystemGlConfigService,

  SystemGlKey,

} from "../ledger/system-gl-config.service";

import { PostingEngineService } from "../posting-engine/posting-engine.service";

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



  listLimits(branchId?: string) {

    return this.prisma.branchLimit.findMany({

      where: {

        bankOrgId: this.bankOrg.bankOrgId,

        ...(branchId ? { branchId } : {}),

      },

      orderBy: { limitCode: "asc" },

    });

  }



  upsertLimit(input: {

    branchId: string;

    limitCode: string;

    amountMinor: bigint;

    currency?: string;

  }) {

    return this.prisma.branchLimit.upsert({

      where: {

        bankOrgId_branchId_limitCode: {

          bankOrgId: this.bankOrg.bankOrgId,

          branchId: input.branchId,

          limitCode: input.limitCode,

        },

      },

      create: {

        bankOrgId: this.bankOrg.bankOrgId,

        branchId: input.branchId,

        limitCode: input.limitCode,

        amountMinor: input.amountMinor,

        currency: input.currency ?? "AZN",

      },

      update: {

        amountMinor: input.amountMinor,

        currency: input.currency ?? "AZN",

      },

    });

  }



  async reconcileMfr(asOf: Date, makerUserId: string) {

    const mfrGl = await this.systemGl.resolve(SystemGlKey.MFR_SETTLEMENT);

    const entries = await this.prisma.journalEntry.findMany({

      where: {

        bankOrgId: this.bankOrg.bankOrgId,

        glAccountId: mfrGl.id,

        transaction: { status: "POSTED", bookingDate: { lte: asOf } },

      },

    });



    const byBranch = new Map<string, bigint>();

    for (const entry of entries) {

      const net =
        (byBranch.get(entry.branchId) ?? 0n) +
        BigInt(entry.debitMinor) -
        BigInt(entry.creditMinor);

      byBranch.set(entry.branchId, net);

    }



    const positions = [...byBranch.entries()].map(([branchId, netMinor]) => ({

      branchId,

      netMinor: netMinor.toString(),

    }));



    const totalNet = [...byBranch.values()].reduce((sum, value) => sum + value, 0n);

    let nettingPosted = false;

    let journalTxnId: string | null = null;



    if (totalNet !== 0n) {

      const branch = await this.headOfficeBranch();

      const cashGl = await this.systemGl.resolve(SystemGlKey.CASH_VAULT);

      const absNet = totalNet < 0n ? -totalNet : totalNet;

      const legs =

        totalNet > 0n

          ? [

              {

                glAccountId: mfrGl.id,

                branchId: branch.id,

                debitMinor: 0n,

                creditMinor: absNet,

                currency: "AZN",

              },

              {

                glAccountId: cashGl.id,

                branchId: branch.id,

                debitMinor: absNet,

                creditMinor: 0n,

                currency: "AZN",

              },

            ]

          : [

              {

                glAccountId: mfrGl.id,

                branchId: branch.id,

                debitMinor: absNet,

                creditMinor: 0n,

                currency: "AZN",

              },

              {

                glAccountId: cashGl.id,

                branchId: branch.id,

                debitMinor: 0n,

                creditMinor: absNet,

                currency: "AZN",

              },

            ];



      const txn = await this.postingEngine.post({

        reference: `MFR-NET-${asOf.toISOString().slice(0, 10)}`,

        idempotencyKey: `mfr-net-${asOf.toISOString().slice(0, 10)}`,

        valueDate: asOf,

        type: TxnType.INTERBRANCH,

        makerUserId,

        branchId: branch.id,

        autoApprove: true,

        legs,

      });

      nettingPosted = true;

      journalTxnId = txn.id;

    }



    return {

      asOf: asOf.toISOString().slice(0, 10),

      positions,

      totalNetMinor: totalNet.toString(),

      balanced: totalNet === 0n,

      nettingPosted,

      journalTxnId,

    };

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



  private async headOfficeBranch() {

    const branch = await this.prisma.branch.findFirst({

      where: { bankOrgId: this.bankOrg.bankOrgId, isHeadOffice: true },

    });

    if (!branch) throw new NotFoundException("Head office branch not seeded");

    return branch;

  }

}

