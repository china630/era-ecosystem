import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { AccountStatus, HoldReason, HoldStatus } from "@era/bank-core-database";

import { PrismaService } from "../../prisma/prisma.service";

import { BankOrgConfig } from "../../common/bank-org.config";

import { getProductGlCode } from "../../common/product-gl";

import {

  assertOverdraftAllowed,

  computeAvailableBalance,

  sumActiveHoldMinor,

} from "../../common/fc1-core.util";

import { CifService } from "../cif/cif.service";

import { ProductFactoryService } from "../product-factory/product-factory.service";



function mod97(input: string): number {

  let remainder = 0;

  for (const ch of input) {

    remainder = (remainder * 10 + Number(ch)) % 97;

  }

  return remainder;

}



export function generateAzIban(bankCode: string, accountNumber: string): string {

  const bban = `${bankCode}${accountNumber}`.replace(/\D/g, "");

  const checkBase = `${bban}172700`;

  const check = String(98 - mod97(checkBase)).padStart(2, "0");

  return `AZ${check}${bban}`;

}



@Injectable()

export class LedgerService {

  constructor(

    private readonly prisma: PrismaService,

    private readonly bankOrg: BankOrgConfig,

    private readonly cif: CifService,

    private readonly products: ProductFactoryService,

  ) {}



  listGlAccounts() {

    return this.prisma.glAccount.findMany({

      where: { bankOrgId: this.bankOrg.bankOrgId },

      orderBy: { code: "asc" },

    });

  }



  listAccounts(filters?: {

    customerId?: string;

    branchId?: string;

    iban?: string;

    status?: AccountStatus;

  }) {

    return this.prisma.account.findMany({

      where: {

        bankOrgId: this.bankOrg.bankOrgId,

        customerId: filters?.customerId,

        branchId: filters?.branchId,

        iban: filters?.iban ? { contains: filters.iban, mode: "insensitive" } : undefined,

        status: filters?.status,

      },

      orderBy: { createdAt: "desc" },

    });

  }



  getAccount(id: string) {

    return this.prisma.account.findFirst({

      where: { id, bankOrgId: this.bankOrg.bankOrgId },

      include: { holds: { where: { status: "ACTIVE" } } },

    });

  }



  async openAccount(input: {

    customerId: string;

    branchId: string;

    glAccountId?: string;

    productTemplateId?: string;

    productId?: string;

    currency?: string;

    makerUserId: string;

    idempotencyKey: string;

  }) {

    await this.cif.assertExists(input.customerId);



    let glAccountId = input.glAccountId;

    let currency = input.currency ?? "AZN";

    let productId = input.productId;



    const productTemplateId = input.productTemplateId ?? input.productId;

    if (productTemplateId) {

      const template =

        await this.products.assertActiveCurrentProduct(productTemplateId);

      const liabilityCode = getProductGlCode(

        template.paramsJson,

        "glLiabilityCode",

      );

      const gl = await this.prisma.glAccount.findFirst({

        where: { bankOrgId: this.bankOrg.bankOrgId, code: liabilityCode },

      });

      if (!gl) {

        throw new NotFoundException(`GL ${liabilityCode} not seeded`);

      }

      glAccountId = gl.id;

      currency = template.currency;

      productId = template.id;

    }



    if (!glAccountId) {

      throw new BadRequestException(

        "glAccountId or productTemplateId (CURRENT) is required",

      );

    }



    const seq = Date.now().toString().slice(-10);

    const iban = generateAzIban("200001", seq);



    return this.prisma.account.create({

      data: {

        bankOrgId: this.bankOrg.bankOrgId,

        iban,

        customerId: input.customerId,

        branchId: input.branchId,

        glAccountId,

        productId,

        currency,

        status: AccountStatus.ACTIVE,

      },

    });

  }



  async getStatement(accountId: string, from: Date, to: Date) {

    const account = await this.getAccount(accountId);

    if (!account) throw new NotFoundException("Account not found");

    return this.prisma.journalEntry.findMany({

      where: {

        bankOrgId: this.bankOrg.bankOrgId,

        accountId,

        createdAt: { gte: from, lte: to },

      },

      include: { transaction: true },

      orderBy: { createdAt: "asc" },

    });

  }



  listHolds(accountId: string, status?: HoldStatus) {

    return this.prisma.accountHold.findMany({

      where: {

        accountId,

        bankOrgId: this.bankOrg.bankOrgId,

        ...(status ? { status } : {}),

      },

      orderBy: { createdAt: "desc" },

    });

  }



  async placeHold(

    accountId: string,

    amountMinor: bigint,

    reason: HoldReason,

    options?: {

      expiresAt?: Date;

      reference?: string;

      authorityCode?: string;

    },

  ) {

    const account = await this.getAccount(accountId);

    if (!account) throw new NotFoundException("Account not found");



    const hold = await this.prisma.accountHold.create({

      data: {

        bankOrgId: this.bankOrg.bankOrgId,

        accountId,

        amountMinor,

        reason,

        status: "ACTIVE",

        expiresAt: options?.expiresAt,

        reference: options?.reference,

        authorityCode: options?.authorityCode,

      },

    });



    await this.recomputeAvailable(accountId);

    return hold;

  }



  async releaseHold(accountId: string, holdId: string) {

    const result = await this.prisma.accountHold.updateMany({

      where: { id: holdId, accountId, bankOrgId: this.bankOrg.bankOrgId, status: "ACTIVE" },

      data: { status: "RELEASED" },

    });

    if (result.count > 0) {

      await this.recomputeAvailable(accountId);

    }

    return result;

  }



  async setAccountLimits(

    accountId: string,

    limits: {

      overdraftLimitMinor?: bigint;

      dailyDebitLimitMinor?: bigint;

    },

  ) {

    const account = await this.prisma.account.findFirst({

      where: { id: accountId, bankOrgId: this.bankOrg.bankOrgId },

    });

    if (!account) throw new NotFoundException("Account not found");



    let productOverdraftAllowed: boolean | undefined;

    let hasProductTemplate = false;

    if (account.productId && limits.overdraftLimitMinor != null) {

      hasProductTemplate = true;

      const template = await this.prisma.productTemplate.findFirst({

        where: { id: account.productId, bankOrgId: this.bankOrg.bankOrgId },

      });

      if (template) {

        const params = this.products.parseParamsFor(template);

        if ("overdraftAllowed" in params) {

          productOverdraftAllowed = Boolean(params.overdraftAllowed);

        }

      }

    }



    assertOverdraftAllowed(

      limits.overdraftLimitMinor ?? 0n,

      productOverdraftAllowed,

      hasProductTemplate,

    );



    const data: {
      overdraftLimitMinor?: bigint;
      dailyDebitLimitMinor?: bigint;
    } = {};
    if (limits.overdraftLimitMinor != null) {
      data.overdraftLimitMinor = limits.overdraftLimitMinor;
    }
    if (limits.dailyDebitLimitMinor != null) {
      data.dailyDebitLimitMinor = limits.dailyDebitLimitMinor;
    }

    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data,
    });



    if (limits.overdraftLimitMinor != null) {

      await this.recomputeAvailable(accountId);

    }



    return updated;

  }



  async recomputeAvailable(accountId: string) {

    const account = await this.prisma.account.findFirst({

      where: { id: accountId, bankOrgId: this.bankOrg.bankOrgId },

      include: { holds: true },

    });

    if (!account) throw new NotFoundException("Account not found");



    const activeHoldMinor = sumActiveHoldMinor(account.holds);

    const availableBalanceMinor = computeAvailableBalance({

      ledgerBalanceMinor: account.ledgerBalanceMinor,

      overdraftLimitMinor: account.overdraftLimitMinor,

      activeHoldMinor,

    });



    return this.prisma.account.update({

      where: { id: accountId },

      data: { availableBalanceMinor },

    });

  }



  async closeAccount(accountId: string) {

    const account = await this.getAccount(accountId);

    if (!account) throw new NotFoundException("Account not found");

    if (account.status === AccountStatus.CLOSED) {

      throw new BadRequestException("Account already closed");

    }

    if (account.availableBalanceMinor !== 0n) {

      throw new BadRequestException("Account available balance must be zero to close");

    }

    const activeHolds = await this.prisma.accountHold.count({

      where: {

        accountId,

        bankOrgId: this.bankOrg.bankOrgId,

        status: "ACTIVE",

      },

    });

    if (activeHolds > 0) {

      throw new BadRequestException("Release all holds before closing account");

    }

    return this.prisma.account.update({

      where: { id: accountId },

      data: { status: AccountStatus.CLOSED },

    });

  }



  async trialBalance(asOf: Date) {

    const entries = await this.prisma.journalEntry.findMany({

      where: {

        bankOrgId: this.bankOrg.bankOrgId,

        transaction: { status: "POSTED", bookingDate: { lte: asOf } },

      },

    });

    const byGl = new Map<string, { debitMinor: bigint; creditMinor: bigint; currency: string }>();

    for (const e of entries) {

      const row = byGl.get(e.glAccountId) ?? { debitMinor: 0n, creditMinor: 0n, currency: e.currency };

      row.debitMinor += e.debitMinor;

      row.creditMinor += e.creditMinor;

      byGl.set(e.glAccountId, row);

    }

    return [...byGl.entries()].map(([glAccountId, totals]) => ({ glAccountId, ...totals }));

  }

}

