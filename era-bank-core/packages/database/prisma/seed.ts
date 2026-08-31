import "dotenv/config";
import { createHash } from "crypto";
import {
  Prisma,
  PrismaClient,
  GlAccountType,
  BranchStatus,
  ProductKind,
  ProductStatus,
  CustomerType,
  AccountStatus,
  CredentialStatus,
  SignatoryRole,
  SignatoryStatus,
  KycStatus,
  CardStatus,
  CounterpartyType,
  NostroDirection,
  ActiveStatus,
} from "../generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createSatelliteTenantExtension } from "@era/satellite-kit/tenancy";

const bankOrgId = process.env.ERA_BANK_ORGANIZATION_ID ?? "demo-bank-org-001";

function loginHash(identifier: string) {
  return createHash("sha256").update(identifier.trim().toUpperCase()).digest("hex");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for seed");
  const pool = new Pool({ connectionString: url });
  process.env.ERA_BANK_ORGANIZATION_ID = bankOrgId;
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool as unknown as never),
  }).$extends(createSatelliteTenantExtension(Prisma as never) as never) as unknown as PrismaClient;

  try {
    const glAccounts = [
      { code: "1000101", name: "Cash in vault", type: GlAccountType.ASSET, currency: "AZN" },
      { code: "1000201", name: "Teller till", type: GlAccountType.ASSET, currency: "AZN" },
      { code: "2200101", name: "Customer current accounts", type: GlAccountType.LIABILITY, currency: "AZN" },
      { code: "2200201", name: "Term deposits", type: GlAccountType.LIABILITY, currency: "AZN" },
      { code: "1300101", name: "Loan portfolio", type: GlAccountType.ASSET, currency: "AZN" },
      { code: "2990101", name: "Inter-branch settlement MFR", type: GlAccountType.LIABILITY, currency: "AZN" },
      { code: "1610101", name: "Interbank placements", type: GlAccountType.ASSET, currency: "AZN" },
      { code: "1620101", name: "FX position transit", type: GlAccountType.ASSET, currency: null },
      { code: "1620111", name: "FX revaluation gain clearing", type: GlAccountType.ASSET, currency: "AZN" },
      { code: "4100601", name: "FX revaluation gain", type: GlAccountType.INCOME, currency: "AZN" },
      { code: "5100401", name: "FX revaluation loss", type: GlAccountType.EXPENSE, currency: "AZN" },
      { code: "2550201", name: "Nostro accounts", type: GlAccountType.ASSET, currency: null },
      { code: "2550301", name: "Vostro accounts", type: GlAccountType.LIABILITY, currency: null },
      { code: "1620201", name: "Government securities", type: GlAccountType.ASSET, currency: "AZN" },
      { code: "4100101", name: "Interest income", type: GlAccountType.INCOME, currency: "AZN" },
      { code: "5100101", name: "Interest expense", type: GlAccountType.EXPENSE, currency: "AZN" },
      { code: "5100201", name: "Loan loss expense", type: GlAccountType.EXPENSE, currency: "AZN" },
      { code: "1390101", name: "Loan loss allowance", type: GlAccountType.ASSET, currency: "AZN" },
      { code: "4100201", name: "Fee income", type: GlAccountType.INCOME, currency: "AZN" },
      { code: "1300201", name: "Fee receivable", type: GlAccountType.ASSET, currency: "AZN" },
      { code: "2990201", name: "Fee suspense", type: GlAccountType.LIABILITY, currency: "AZN" },
      { code: "9100101", name: "Trade contingent asset", type: GlAccountType.OFF_BALANCE, currency: "AZN" },
      { code: "9200101", name: "Trade contingent liability", type: GlAccountType.OFF_BALANCE, currency: "AZN" },
      { code: "1300301", name: "Trade margin", type: GlAccountType.ASSET, currency: "AZN" },
      { code: "4100301", name: "Trade commission income", type: GlAccountType.INCOME, currency: "AZN" },
      { code: "2990301", name: "Trade settlement", type: GlAccountType.LIABILITY, currency: "AZN" },
      { code: "1300401", name: "NPL workout", type: GlAccountType.ASSET, currency: "AZN" },
      { code: "4100401", name: "Recovery income", type: GlAccountType.INCOME, currency: "AZN" },
      { code: "2990401", name: "Virtual account clearing", type: GlAccountType.LIABILITY, currency: "AZN" },
      { code: "2200301", name: "Escrow liability", type: GlAccountType.LIABILITY, currency: "AZN" },
      { code: "2990501", name: "Standing order clearing", type: GlAccountType.LIABILITY, currency: "AZN" },
      { code: "2990601", name: "Direct debit clearing", type: GlAccountType.LIABILITY, currency: "AZN" },
      { code: "1300501", name: "Islamic asset", type: GlAccountType.ASSET, currency: "AZN" },
      { code: "2200401", name: "Islamic liability", type: GlAccountType.LIABILITY, currency: "AZN" },
      { code: "4100501", name: "Islamic income", type: GlAccountType.INCOME, currency: "AZN" },
      { code: "5100301", name: "Islamic expense", type: GlAccountType.EXPENSE, currency: "AZN" },
      { code: "2990701", name: "Card dispute suspense", type: GlAccountType.LIABILITY, currency: "AZN" },
    ];

    for (const gl of glAccounts) {
      await prisma.glAccount.upsert({
        where: { bankOrgId_code: { bankOrgId, code: gl.code } },
        create: { bankOrgId, ...gl, isPostable: true },
        update: { name: gl.name, type: gl.type, currency: gl.currency },
      });
    }

    const hq = await prisma.branch.upsert({
      where: { bankOrgId_code: { bankOrgId, code: "HQ" } },
      create: {
        bankOrgId,
        code: "HQ",
        name: "Head Office",
        isHeadOffice: true,
        status: BranchStatus.ACTIVE,
      },
      update: { name: "Head Office" },
    });

    await prisma.branch.upsert({
      where: { bankOrgId_code: { bankOrgId, code: "BR-A" } },
      create: {
        bankOrgId,
        code: "BR-A",
        name: "Branch A",
        parentId: hq.id,
        status: BranchStatus.ACTIVE,
      },
      update: { name: "Branch A" },
    });

    await prisma.branch.upsert({
      where: { bankOrgId_code: { bankOrgId, code: "BR-B" } },
      create: {
        bankOrgId,
        code: "BR-B",
        name: "Branch B",
        parentId: hq.id,
        status: BranchStatus.ACTIVE,
      },
      update: { name: "Branch B" },
    });

    const now = new Date();
    const templates = [
      {
        moduleKey: "banking_core",
        kind: ProductKind.CURRENT,
        name: "CURRENT_AZN",
        currency: "AZN",
        paramsJson: { glLiabilityCode: "2200101", overdraftAllowed: false },
      },
      {
        moduleKey: "banking_deposits",
        kind: ProductKind.TERM_DEPOSIT,
        name: "TERM_6M_12PCT",
        currency: "AZN",
        paramsJson: {
          termMonths: 6,
          rateAnnual: 0.12,
          glLiabilityCode: "2200201",
          glInterestExpenseCode: "5100101",
          adifEligible: true,
        },
      },
      {
        moduleKey: "banking_loans",
        kind: ProductKind.LOAN_ANNUITY,
        name: "LOAN_ANNUITY_24M",
        currency: "AZN",
        paramsJson: {
          termMonths: 24,
          rateAnnual: 0.18,
          glAssetCode: "1300101",
          glInterestIncomeCode: "4100101",
        },
      },
      {
        moduleKey: "banking_cards",
        kind: ProductKind.CARD,
        name: "CARD_DEBIT_VISA_AZN",
        currency: "AZN",
        paramsJson: {
          scheme: "VISA",
          cardType: "DEBIT",
          dailySpendLimitMinor: 500000,
          atmDailyLimitMinor: 100000,
        },
      },
    ];

    for (const t of templates) {
      const existing = await prisma.productTemplate.findFirst({
        where: { bankOrgId, name: t.name },
      });
      if (!existing) {
        await prisma.productTemplate.create({
          data: {
            bankOrgId,
            ...t,
            status: ProductStatus.ACTIVE,
            effectiveFrom: now,
          },
        });
      } else {
        await prisma.productTemplate.update({
          where: { id: existing.id },
          data: { paramsJson: t.paramsJson },
        });
      }
    }

    const systemGlMappings: Array<{ key: string; glCode: string }> = [
      { key: "CASH_VAULT", glCode: "1000101" },
      { key: "TELLER_TILL", glCode: "1000201" },
      { key: "MFR_SETTLEMENT", glCode: "2990101" },
      { key: "INTERBANK_PLACEMENT", glCode: "1610101" },
      { key: "FX_TRANSIT", glCode: "1620101" },
      { key: "FX_REVAL_GAIN", glCode: "4100601" },
      { key: "FX_REVAL_LOSS", glCode: "5100401" },
      { key: "NOSTRO", glCode: "2550201" },
      { key: "VOSTRO", glCode: "2550301" },
      { key: "GOV_SECURITIES", glCode: "1620201" },
      { key: "INTEREST_INCOME", glCode: "4100101" },
      { key: "INTEREST_EXPENSE", glCode: "5100101" },
      { key: "LOAN_LOSS_EXPENSE", glCode: "5100201" },
      { key: "LOAN_LOSS_ALLOWANCE", glCode: "1390101" },
      { key: "FEE_INCOME", glCode: "4100201" },
      { key: "FEE_RECEIVABLE", glCode: "1300201" },
      { key: "FEE_SUSPENSE", glCode: "2990201" },
      { key: "TRADE_CONTINGENT_ASSET", glCode: "9100101" },
      { key: "TRADE_CONTINGENT_LIABILITY", glCode: "9200101" },
      { key: "TRADE_MARGIN", glCode: "1300301" },
      { key: "TRADE_COMMISSION_INCOME", glCode: "4100301" },
      { key: "TRADE_SETTLEMENT", glCode: "2990301" },
      { key: "NPL_WORKOUT", glCode: "1300401" },
      { key: "RECOVERY_INCOME", glCode: "4100401" },
      { key: "VIRTUAL_ACCOUNT_CLEARING", glCode: "2990401" },
      { key: "ESCROW_LIABILITY", glCode: "2200301" },
      { key: "STANDING_ORDER_CLEARING", glCode: "2990501" },
      { key: "DIRECT_DEBIT_CLEARING", glCode: "2990601" },
      { key: "ISLAMIC_ASSET", glCode: "1300501" },
      { key: "ISLAMIC_LIABILITY", glCode: "2200401" },
      { key: "ISLAMIC_INCOME", glCode: "4100501" },
      { key: "ISLAMIC_EXPENSE", glCode: "5100301" },
      { key: "CARD_DISPUTE_SUSPENSE", glCode: "2990701" },
    ];
    for (const mapping of systemGlMappings) {
      await prisma.systemGlConfig.upsert({
        where: { bankOrgId_key: { bankOrgId, key: mapping.key } },
        create: { bankOrgId, key: mapping.key, glCode: mapping.glCode },
        update: { glCode: mapping.glCode },
      });
    }

    const amlRules = [
      {
        code: "THRESHOLD_SINGLE_TXN",
        paramsJson: { thresholdMinor: 1500000, currencies: ["AZN"] },
      },
      {
        code: "VELOCITY_24H",
        paramsJson: { limitMinor: 5000000, windowHours: 24 },
      },
      {
        code: "STRUCTURING_PATTERN",
        paramsJson: { thresholdMinor: 1500000, windowHours: 24 },
      },
      { code: "HIGH_RISK_CUSTOMER", paramsJson: {} },
      { code: "CROSS_BORDER", paramsJson: { homeCountry: "AZ" } },
      { code: "CARD_HIGH_RISK_MCC", paramsJson: { mccs: ["7995", "6051", "6211"] } },
      { code: "CARD_VELOCITY_1H", paramsJson: { limitCount: 5, windowHours: 1 } },
      { code: "CARD_CROSS_BORDER", paramsJson: { homeCountry: "AZ" } },
    ];

    for (const rule of amlRules) {
      await prisma.amlRule.upsert({
        where: { bankOrgId_code: { bankOrgId, code: rule.code } },
        create: {
          bankOrgId,
          code: rule.code,
          enabled: true,
          paramsJson: rule.paramsJson,
        },
        update: { enabled: true, paramsJson: rule.paramsJson },
      });
    }

    const liabilityGl = await prisma.glAccount.findFirst({
      where: { bankOrgId, code: "2200101" },
    });
    if (liabilityGl) {
      const retailId = "demo-retail-customer";
      const corporateId = "demo-corporate-customer";

      await prisma.bankCustomer.upsert({
        where: { id: retailId },
        create: {
          id: retailId,
          bankOrgId,
          customerType: CustomerType.NATURAL,
          homeBranchId: hq.id,
          globalPersonId: "demo-retail-person",
          kycStatus: KycStatus.VERIFIED,
        },
        update: { status: "ACTIVE", kycStatus: KycStatus.VERIFIED },
      });

      await prisma.bankCustomer.upsert({
        where: { id: corporateId },
        create: {
          id: corporateId,
          bankOrgId,
          customerType: CustomerType.LEGAL,
          voen: "1234567890",
          homeBranchId: hq.id,
          globalPersonId: "demo-corporate-entity",
          kycStatus: KycStatus.VERIFIED,
        },
        update: { status: "ACTIVE", voen: "1234567890", kycStatus: KycStatus.VERIFIED },
      });

      const retailAccounts = [
        { id: "demo-retail-acc-1", iban: "AZ21DEMO00000000000001", balance: 5_000_000n },
        { id: "demo-retail-acc-2", iban: "AZ21DEMO00000000000002", balance: 2_000_000n },
      ];
      for (const acc of retailAccounts) {
        await prisma.account.upsert({
          where: { id: acc.id },
          create: {
            id: acc.id,
            bankOrgId,
            iban: acc.iban,
            customerId: retailId,
            branchId: hq.id,
            glAccountId: liabilityGl.id,
            currency: "AZN",
            status: AccountStatus.ACTIVE,
            ledgerBalanceMinor: acc.balance,
            availableBalanceMinor: acc.balance,
          },
          update: {
            ledgerBalanceMinor: acc.balance,
            availableBalanceMinor: acc.balance,
          },
        });
      }

      await prisma.account.upsert({
        where: { id: "demo-corporate-acc-1" },
        create: {
          id: "demo-corporate-acc-1",
          bankOrgId,
          iban: "AZ21DEMO00000000000003",
          customerId: corporateId,
          branchId: hq.id,
          glAccountId: liabilityGl.id,
          currency: "AZN",
          status: AccountStatus.ACTIVE,
          ledgerBalanceMinor: 50_000_000n,
          availableBalanceMinor: 50_000_000n,
        },
        update: {
          ledgerBalanceMinor: 50_000_000n,
          availableBalanceMinor: 50_000_000n,
        },
      });

      await prisma.dboCustomerCredential.upsert({
        where: { bankOrgId_customerId: { bankOrgId, customerId: retailId } },
        create: {
          bankOrgId,
          customerId: retailId,
          loginHash: loginHash("1234567"),
          status: CredentialStatus.ACTIVE,
        },
        update: { loginHash: loginHash("1234567"), status: CredentialStatus.ACTIVE },
      });

      await prisma.dboCustomerCredential.upsert({
        where: { bankOrgId_customerId: { bankOrgId, customerId: corporateId } },
        create: {
          bankOrgId,
          customerId: corporateId,
          loginHash: loginHash("1234567890"),
          status: CredentialStatus.ACTIVE,
        },
        update: { loginHash: loginHash("1234567890"), status: CredentialStatus.ACTIVE },
      });

      const signatories = [
        { globalPersonId: "demo-signatory-a", role: SignatoryRole.PRIMARY, limitMinor: 10_000_000n },
        { globalPersonId: "demo-signatory-b", role: SignatoryRole.SECONDARY, limitMinor: 10_000_000n },
      ];
      for (const s of signatories) {
        const existing = await prisma.corporateSignatory.findFirst({
          where: { bankOrgId, customerId: corporateId, globalPersonId: s.globalPersonId },
        });
        if (!existing) {
          await prisma.corporateSignatory.create({
            data: {
              bankOrgId,
              customerId: corporateId,
              globalPersonId: s.globalPersonId,
              role: s.role,
              limitMinor: s.limitMinor,
              status: SignatoryStatus.ACTIVE,
            },
          });
        }
      }

      console.info("[bank-core:seed] DBO demo: retail FIN 1234567, corporate VOEN 1234567890");

      const cardTemplate = await prisma.productTemplate.findFirst({
        where: { bankOrgId, name: "CARD_DEBIT_VISA_AZN" },
      });
      if (cardTemplate) {
        await prisma.card.upsert({
          where: {
            organizationId_cardToken: {
              organizationId: bankOrgId,
              cardToken: "demo-retail-card-token",
            },
          },
          create: {
            bankOrgId,
            customerId: retailId,
            accountId: "demo-retail-acc-1",
            branchId: hq.id,
            cardToken: "demo-retail-card-token",
            panLast4: "4242",
            bin6: "424242",
            expiryMonth: 12,
            expiryYear: 2028,
            status: CardStatus.ACTIVE,
            limitsJson: { dailySpendLimitMinor: 500000, perTxnMaxMinor: 200000 },
            issuedAt: new Date(),
          },
          update: { status: CardStatus.ACTIVE },
        });
        console.info("[bank-core:seed] demo card token: demo-retail-card-token (use card id from GET /cards)");
      }
    }

    const nostroGl = await prisma.glAccount.findFirst({ where: { bankOrgId, code: "2550201" } });
    if (nostroGl) {
      const cp = await prisma.treasuryCounterparty.upsert({
        where: { bankOrgId_bankMfo: { bankOrgId, bankMfo: "200001" } },
        create: {
          bankOrgId,
          bankMfo: "200001",
          name: "Demo Correspondent Bank",
          nostroIban: "AZ21DEMO00000000009999",
          type: CounterpartyType.BANK,
          status: ActiveStatus.ACTIVE,
        },
        update: { name: "Demo Correspondent Bank", status: ActiveStatus.ACTIVE },
      });

      await prisma.nostroVostroAccount.upsert({
        where: { iban: "AZ21DEMO00000000009999" },
        create: {
          bankOrgId,
          counterpartyId: cp.id,
          direction: NostroDirection.NOSTRO,
          iban: "AZ21DEMO00000000009999",
          currency: "AZN",
          glAccountId: nostroGl.id,
          ledgerBalanceMinor: 100_000_000n,
          status: ActiveStatus.ACTIVE,
        },
        update: {
          ledgerBalanceMinor: 100_000_000n,
          status: ActiveStatus.ACTIVE,
        },
      });
      console.info("[bank-core:seed] treasury nostro: AZ21DEMO00000000009999 (1000000.00 AZN cached)");
    }

    const quoteDay = new Date(now.toISOString().slice(0, 10));
    await prisma.rateIndexQuote.upsert({
      where: {
        bankOrgId_indexKey_asOfDate: {
          bankOrgId,
          indexKey: "CBAR_REF",
          asOfDate: quoteDay,
        },
      },
      create: {
        bankOrgId,
        indexKey: "CBAR_REF",
        asOfDate: quoteDay,
        rateAnnual: 0.075,
        source: "STUB",
      },
      update: { rateAnnual: 0.075, source: "STUB" },
    });

    await prisma.eclParameterSet.upsert({
      where: { bankOrgId_version: { bankOrgId, version: "lab-v1" } },
      create: {
        bankOrgId,
        version: "lab-v1",
        asOfDate: quoteDay,
        active: true,
        paramsJson: {
          pdByStage: { "1": 0.01, "2": 0.05, "3": 0.25 },
          pdLowScoreUplift: 0.02,
          lgdUnsecured: 0.45,
          lgdSecuredFloor: 0.1,
        },
      },
      update: {
        active: true,
        paramsJson: {
          pdByStage: { "1": 0.01, "2": 0.05, "3": 0.25 },
          pdLowScoreUplift: 0.02,
          lgdUnsecured: 0.45,
          lgdSecuredFloor: 0.1,
        },
      },
    });

    console.info(`[bank-core:seed] done for bankOrgId=${bankOrgId}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
