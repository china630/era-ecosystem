import { Injectable, NotFoundException } from "@nestjs/common";
import type { GlAccount } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";

/** Bank-wide system GL keys (not product-specific). Seeded in SystemGlConfig. */
export const SystemGlKey = {
  CASH_VAULT: "CASH_VAULT",
  MFR_SETTLEMENT: "MFR_SETTLEMENT",
  INTERBANK_PLACEMENT: "INTERBANK_PLACEMENT",
  FX_TRANSIT: "FX_TRANSIT",
  FX_REVAL_GAIN: "FX_REVAL_GAIN",
  FX_REVAL_LOSS: "FX_REVAL_LOSS",
  NOSTRO: "NOSTRO",
  VOSTRO: "VOSTRO",
  GOV_SECURITIES: "GOV_SECURITIES",
  INTEREST_INCOME: "INTEREST_INCOME",
  INTEREST_EXPENSE: "INTEREST_EXPENSE",
  LOAN_LOSS_EXPENSE: "LOAN_LOSS_EXPENSE",
  LOAN_LOSS_ALLOWANCE: "LOAN_LOSS_ALLOWANCE",
  FEE_INCOME: "FEE_INCOME",
  FEE_RECEIVABLE: "FEE_RECEIVABLE",
  FEE_SUSPENSE: "FEE_SUSPENSE",
  TRADE_CONTINGENT_ASSET: "TRADE_CONTINGENT_ASSET",
  TRADE_CONTINGENT_LIABILITY: "TRADE_CONTINGENT_LIABILITY",
  TRADE_MARGIN: "TRADE_MARGIN",
  TRADE_COMMISSION_INCOME: "TRADE_COMMISSION_INCOME",
  TRADE_SETTLEMENT: "TRADE_SETTLEMENT",
  NPL_WORKOUT: "NPL_WORKOUT",
  RECOVERY_INCOME: "RECOVERY_INCOME",
  VIRTUAL_ACCOUNT_CLEARING: "VIRTUAL_ACCOUNT_CLEARING",
  ESCROW_LIABILITY: "ESCROW_LIABILITY",
  STANDING_ORDER_CLEARING: "STANDING_ORDER_CLEARING",
  DIRECT_DEBIT_CLEARING: "DIRECT_DEBIT_CLEARING",
  ISLAMIC_ASSET: "ISLAMIC_ASSET",
  ISLAMIC_LIABILITY: "ISLAMIC_LIABILITY",
  ISLAMIC_INCOME: "ISLAMIC_INCOME",
  ISLAMIC_EXPENSE: "ISLAMIC_EXPENSE",
  CARD_DISPUTE_SUSPENSE: "CARD_DISPUTE_SUSPENSE",
  TELLER_TILL: "TELLER_TILL",
} as const;

export type SystemGlKey = (typeof SystemGlKey)[keyof typeof SystemGlKey];

@Injectable()
export class SystemGlConfigService {
  private cache = new Map<string, GlAccount>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  async resolve(key: SystemGlKey): Promise<GlAccount> {
    const cacheKey = `${this.bankOrg.bankOrgId}:${key}`;
    const hit = this.cache.get(cacheKey);
    if (hit) return hit;

    const config = await this.prisma.systemGlConfig.findUnique({
      where: {
        bankOrgId_key: { bankOrgId: this.bankOrg.bankOrgId, key },
      },
    });
    if (!config) {
      throw new NotFoundException(`SystemGlConfig key ${key} not seeded`);
    }

    const gl = await this.prisma.glAccount.findFirst({
      where: { bankOrgId: this.bankOrg.bankOrgId, code: config.glCode },
    });
    if (!gl) {
      throw new NotFoundException(
        `GL account ${config.glCode} for SystemGlConfig.${key} not seeded`,
      );
    }

    this.cache.set(cacheKey, gl);
    return gl;
  }

  clearCache() {
    this.cache.clear();
  }
}
