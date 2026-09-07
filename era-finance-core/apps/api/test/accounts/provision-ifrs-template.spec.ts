import { AccountType, LedgerType } from "@erafinance/database";
import { AccountsService } from "../../src/accounts/accounts.service";
import type { LedgerMappingService } from "../../src/accounting/ledger-mapping.service";
import type { PostingAccountResolver } from "../../src/accounting/posting/posting-account-resolver.service";
import type { PrismaService } from "../../src/prisma/prisma.service";

jest.mock("../../src/subscription/subscription-access.service", () => ({
  SubscriptionAccessService: class SubscriptionAccessService {
    hasModule = jest.fn();
  },
}));

describe("AccountsService.provisionIfrsFromTemplate (P1)", () => {
  it("creates IFRS targets from template without cloning full NAS chart", async () => {
    const created: Array<{ code: string; ledgerType: string }> = [];
    const db = {
      templateIFRSMapping: {
        findMany: jest.fn().mockResolvedValue([
          {
            nasCode: "211",
            ifrsCode: "1200",
            ratio: { toString: () => "1" },
            description: "AR",
          },
        ]),
      },
      account: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "nas-211",
            code: "211",
            type: AccountType.ASSET,
            nameAz: "AR",
            nameRu: "AR",
            nameEn: "AR",
            currency: "AZN",
          },
          {
            id: "nas-999",
            code: "999",
            type: AccountType.EXPENSE,
            nameAz: "X",
            nameRu: "X",
            nameEn: "X",
            currency: "AZN",
          },
        ]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => {
          created.push({ code: data.code, ledgerType: data.ledgerType });
          return { id: `ifrs-${data.code}`, ...data };
        }),
      },
    };

    const ledgerMapping = {
      bootstrapDraftFromAccountPairs: jest.fn().mockResolvedValue(undefined),
    } as unknown as LedgerMappingService;

    const svc = new AccountsService(
      {} as PrismaService,
      {} as PostingAccountResolver,
      ledgerMapping,
      { hasModule: jest.fn().mockResolvedValue(true) } as never,
    );

    const out = await svc.provisionIfrsFromTemplate("org-1", db as never);

    expect(out.ifrsCreated).toBe(1);
    expect(out.mappingPairs).toBe(1);
    expect(created).toEqual([
      { code: "1200", ledgerType: LedgerType.IFRS },
    ]);
    expect(ledgerMapping.bootstrapDraftFromAccountPairs).toHaveBeenCalledWith(
      "org-1",
      [
        expect.objectContaining({
          sourceAccountId: "nas-211",
          targetAccountId: "ifrs-1200",
        }),
      ],
      db,
    );
  });

  it("bootstrap skips IFRS CoA when ifrs_mapping entitlement is absent", async () => {
    const hasModule = jest.fn().mockResolvedValue(false);
    const svc = new AccountsService(
      {} as PrismaService,
      {} as PostingAccountResolver,
      { bootstrapDraftFromAccountPairs: jest.fn() } as unknown as LedgerMappingService,
      { hasModule } as never,
    );
    const out = await svc.bootstrapMultiGaapForNewOrganization("org-1");
    expect(out).toEqual({ skipped: true });
    expect(hasModule).toHaveBeenCalled();
  });
});
