import { BadRequestException } from "@nestjs/common";
import { FixedAssetStatus, Prisma } from "@erafinance/database";
import { FixedAssetLifecycleService } from "../src/fixed-assets/fixed-asset-lifecycle.service";
import type { AccountingService } from "../src/accounting/accounting.service";
import type { PostingAccountResolver } from "../src/accounting/posting/posting-account-resolver.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const Decimal = Prisma.Decimal;

describe("Finance FA negative paths (AC-FIN-FA)", () => {
  it("dispose refuses already disposed asset (invalid state)", async () => {
    const tx = {
      fixedAsset: {
        findFirst: jest.fn().mockResolvedValue({
          id: "fa-1",
          status: FixedAssetStatus.DISPOSED,
          purchasePrice: new Decimal(1000),
          modernizationCost: new Decimal(0),
          disposedPortion: new Decimal(1),
          bookedDepreciation: new Decimal(0),
          taxProfile: null,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaService;
    const accounting = {
      postJournalInTransaction: jest.fn(),
    } as unknown as AccountingService;
    const posting = {
      resolveAccountCode: jest.fn(),
    } as unknown as PostingAccountResolver;
    const svc = new FixedAssetLifecycleService(prisma, accounting, posting);

    await expect(
      svc.dispose("org-1", "fa-1", { portion: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    try {
      await svc.dispose("org-1", "fa-1", { portion: 1 });
    } catch (err) {
      expect((err as BadRequestException).message).toMatch(/already disposed/i);
    }
    expect(accounting.postJournalInTransaction).not.toHaveBeenCalled();
  });

  it("acquire DONATION refuses short note", async () => {
    const tx = {
      fixedAsset: {
        findFirst: jest.fn().mockResolvedValue({
          id: "fa-1",
          name: "Desk",
          inventoryNumber: "FA-001",
          purchaseDate: new Date("2026-01-01"),
          purchasePrice: new Decimal(500),
          modernizationCost: new Decimal(0),
          fixedAssetAccountId: null,
          status: FixedAssetStatus.ACTIVE,
          disposedPortion: new Decimal(0),
        }),
      },
      fixedAssetLifecycleEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaService;
    const accounting = {
      postJournalInTransaction: jest.fn(),
    } as unknown as AccountingService;
    const posting = {
      resolveAccountCode: jest.fn(async () => "111"),
    } as unknown as PostingAccountResolver;
    const svc = new FixedAssetLifecycleService(prisma, accounting, posting);

    await expect(
      svc.acquire("org-1", "fa-1", {
        creditSource: "DONATION" as never,
        note: "short",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accounting.postJournalInTransaction).not.toHaveBeenCalled();
  });
});
