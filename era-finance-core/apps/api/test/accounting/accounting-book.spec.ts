import {
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import {
  AccountingBookBillingSlotKind,
  AccountingBookGaapKind,
  AccountingBookStatus,
  LedgerType,
} from "@erafinance/database";

jest.mock("../../src/subscription/subscription-access.service", () => ({
  SubscriptionAccessService: class SubscriptionAccessService {},
}));

import { AccountingBookService } from "../../src/accounting/accounting-book.service";
import type { PrismaService } from "../../src/prisma/prisma.service";
import type { SubscriptionAccessService } from "../../src/subscription/subscription-access.service";

describe("AccountingBookService resolution", () => {
  const organizationId = "00000000-0000-0000-0000-000000000001";
  const bookId = "00000000-0000-0000-0000-000000000101";

  function makeService(result: Record<string, unknown> | null) {
    const findFirst = jest.fn().mockResolvedValue(result);
    const prisma = {
      accountingBook: { findFirst },
    } as unknown as PrismaService;
    const access = {
      getAccountingBookSlots: jest.fn().mockResolvedValue({
        included: 1,
        extra: 0,
        ifrsBundleSlot: 0,
        maxActive: 1,
      }),
    } as unknown as SubscriptionAccessService;
    return {
      service: new AccountingBookService(prisma, access),
      findFirst,
    };
  }

  it("resolves the active system book from a legacy ledger alias", async () => {
    const row = { id: bookId, organizationId, code: "IFRS" };
    const { service, findFirst } = makeService(row);

    await expect(
      service.resolveByLedgerType(organizationId, LedgerType.IFRS),
    ).resolves.toBe(row);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        organizationId,
        code: "IFRS",
        status: AccountingBookStatus.ACTIVE,
      },
    });
  });

  it("prefers an explicit book id and scopes it to the organization", async () => {
    const row = { id: bookId, organizationId, code: "MGMT" };
    const { service, findFirst } = makeService(row);

    await expect(
      service.resolveByIdOrLedgerAlias(
        organizationId,
        bookId,
        LedgerType.NAS,
      ),
    ).resolves.toBe(row);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: bookId, organizationId },
    });
  });

  it("defaults a missing id and alias to NAS", async () => {
    const row = { id: bookId, organizationId, code: "NAS" };
    const { service, findFirst } = makeService(row);

    await expect(
      service.resolveByIdOrLedgerAlias(organizationId),
    ).resolves.toBe(row);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        organizationId,
        code: "NAS",
        status: AccountingBookStatus.ACTIVE,
      },
    });
  });

  it("rejects unsupported ledger aliases", async () => {
    const { service, findFirst } = makeService(null);

    await expect(
      service.resolveByIdOrLedgerAlias(organizationId, undefined, "MGMT"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("does not resolve a book from another organization", async () => {
    const { service } = makeService(null);

    await expect(service.getBook(organizationId, bookId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("rejects create when all active slots are used", async () => {
    const tx = {
      accountingBook: { count: jest.fn().mockResolvedValue(1) },
    };
    const prisma = {
      $transaction: jest.fn((fn: (db: typeof tx) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const access = {
      getAccountingBookSlots: jest.fn().mockResolvedValue({
        included: 1,
        extra: 0,
        ifrsBundleSlot: 0,
        maxActive: 1,
      }),
    } as unknown as SubscriptionAccessService;
    const service = new AccountingBookService(prisma, access);

    await expect(
      service.createBook(organizationId, {
        code: "MGMT",
        nameAz: "İdarəetmə",
        nameRu: "Управленческий",
        nameEn: "Management",
        gaapKind: AccountingBookGaapKind.MANAGEMENT,
      }),
    ).rejects.toMatchObject({
      status: 402,
      response: expect.objectContaining({
        code: "ACCOUNTING_BOOK_SLOT_REQUIRED",
      }),
    });
  });

  it("creates a management book and starter chart within quota", async () => {
    const created = { id: bookId, code: "MGMT" };
    const tx = {
      accountingBook: {
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 10 } }),
        create: jest.fn().mockResolvedValue(created),
      },
      account: { createMany: jest.fn().mockResolvedValue({ count: 5 }) },
    };
    const prisma = {
      $transaction: jest.fn((fn: (db: typeof tx) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const access = {
      getAccountingBookSlots: jest.fn().mockResolvedValue({
        included: 1,
        extra: 1,
        ifrsBundleSlot: 0,
        maxActive: 2,
      }),
    } as unknown as SubscriptionAccessService;
    const service = new AccountingBookService(prisma, access);

    await expect(
      service.createBook(organizationId, {
        code: "mgmt",
        nameAz: "İdarəetmə",
        nameRu: "Управленческий",
        nameEn: "Management",
        gaapKind: AccountingBookGaapKind.MANAGEMENT,
      }),
    ).resolves.toBe(created);
    expect(tx.accountingBook.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: "MGMT",
        gaapKind: AccountingBookGaapKind.MANAGEMENT,
      }),
    });
    expect(tx.account.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          code: "M1000",
          ledgerType: LedgerType.MANAGEMENT,
          accountingBookId: bookId,
        }),
      ]),
    });
  });

  it("creates an empty book without chart accounts", async () => {
    const created = { id: bookId, code: "MGMT" };
    const tx = {
      accountingBook: {
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 10 } }),
        create: jest.fn().mockResolvedValue(created),
      },
      account: { createMany: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((fn: (db: typeof tx) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const access = {
      getAccountingBookSlots: jest.fn().mockResolvedValue({
        included: 1,
        extra: 1,
        ifrsBundleSlot: 0,
        maxActive: 2,
      }),
    } as unknown as SubscriptionAccessService;

    await new AccountingBookService(prisma, access).createBook(organizationId, {
      code: "MGMT",
      nameAz: "İdarəetmə",
      nameRu: "Управленческий",
      nameEn: "Management",
      gaapKind: AccountingBookGaapKind.MANAGEMENT,
      coaStrategy: "EMPTY",
    });

    expect(tx.account.createMany).not.toHaveBeenCalled();
  });

  it("clones the NAS chart and creates one-to-one draft lines", async () => {
    const sourceBookId = "00000000-0000-0000-0000-000000000102";
    const sourceParentId = "00000000-0000-0000-0000-000000000201";
    const sourceChildId = "00000000-0000-0000-0000-000000000202";
    const targetParentId = "00000000-0000-0000-0000-000000000301";
    const targetChildId = "00000000-0000-0000-0000-000000000302";
    const tx = {
      accountingBook: {
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 10 } }),
        create: jest.fn().mockResolvedValue({ id: bookId, code: "MGMT" }),
        findFirst: jest.fn().mockResolvedValue({ id: sourceBookId, code: "NAS" }),
      },
      account: {
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: sourceParentId,
            code: "100",
            nameAz: "Aktiv",
            nameRu: "Актив",
            nameEn: "Asset",
            type: "ASSET",
            currency: "AZN",
            parentId: null,
          },
          {
            id: sourceChildId,
            code: "101",
            nameAz: "Kassa",
            nameRu: "Касса",
            nameEn: "Cash",
            type: "ASSET",
            currency: "AZN",
            parentId: sourceParentId,
          },
        ]),
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: targetParentId })
          .mockResolvedValueOnce({ id: targetChildId }),
        update: jest.fn().mockResolvedValue({}),
      },
      ledgerMappingSet: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "mapping-set-id" }),
      },
      ledgerMappingLine: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (db: typeof tx) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const access = {
      getAccountingBookSlots: jest.fn().mockResolvedValue({
        included: 1,
        extra: 1,
        ifrsBundleSlot: 0,
        maxActive: 2,
      }),
    } as unknown as SubscriptionAccessService;

    await new AccountingBookService(prisma, access).createBook(organizationId, {
      code: "MGMT",
      nameAz: "İdarəetmə",
      nameRu: "Управленческий",
      nameEn: "Management",
      gaapKind: AccountingBookGaapKind.MANAGEMENT,
      coaStrategy: "NAS_CLONE",
      translateFromStatutory: true,
    });

    expect(tx.account.create).toHaveBeenCalledTimes(2);
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: targetChildId },
      data: { parentId: targetParentId },
    });
    expect(tx.ledgerMappingSet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: "NAS_TO_MGMT",
        fromBookId: sourceBookId,
        toBookId: bookId,
        status: "DRAFT",
      }),
      select: { id: true },
    });
    expect(tx.ledgerMappingLine.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          sourceAccountId: sourceParentId,
          targetAccountId: targetParentId,
        }),
      ]),
    });
  });

  it("retires an unused non-system EXTRA book and frees active usage", async () => {
    const book = {
      id: bookId,
      organizationId,
      code: "MGMT",
      status: AccountingBookStatus.ACTIVE,
      isSystem: false,
      isDefaultOps: false,
      billingSlotKind: AccountingBookBillingSlotKind.EXTRA,
    };
    const tx = {
      accountingBook: {
        findFirst: jest.fn().mockResolvedValue(book),
        update: jest.fn().mockResolvedValue({
          ...book,
          status: AccountingBookStatus.RETIRED,
        }),
      },
      journalEntry: { count: jest.fn().mockResolvedValue(0) },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ settings: {} }),
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (db: typeof tx) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const service = new AccountingBookService(prisma, {} as SubscriptionAccessService);

    await expect(service.retireBook(organizationId, bookId)).resolves.toMatchObject({
      status: AccountingBookStatus.RETIRED,
    });
    expect(tx.accountingBook.update).toHaveBeenCalledWith({
      where: { id: bookId },
      data: { status: AccountingBookStatus.RETIRED },
    });
  });

  it.each([
    ["journal entries", 1, {}, "ACCOUNTING_BOOK_RETIRE_HAS_ENTRIES"],
    [
      "closed periods",
      0,
      { reporting: { closedPeriodsByBookId: { [bookId]: ["2026-08"] } } },
      "ACCOUNTING_BOOK_RETIRE_CLOSED_PERIODS",
    ],
  ])("blocks retirement when the book has %s", async (_label, count, settings, code) => {
    const tx = {
      accountingBook: {
        findFirst: jest.fn().mockResolvedValue({
          id: bookId,
          organizationId,
          status: AccountingBookStatus.ACTIVE,
          isSystem: false,
          isDefaultOps: false,
          billingSlotKind: AccountingBookBillingSlotKind.EXTRA,
        }),
      },
      journalEntry: { count: jest.fn().mockResolvedValue(count) },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ settings }),
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (db: typeof tx) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const service = new AccountingBookService(prisma, {} as SubscriptionAccessService);

    await expect(service.retireBook(organizationId, bookId)).rejects.toMatchObject({
      response: expect.objectContaining({ code }),
    });
  });
});
