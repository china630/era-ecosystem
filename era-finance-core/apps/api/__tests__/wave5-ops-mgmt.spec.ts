import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AccountingBookGaapKind, UserRole } from "@erafinance/database";
import {
  assertCanAccessMgmtBook,
  assertCanEditInternalRate,
  assertMoneyPathBookNotManagement,
  assertOpsBookIsNas,
  canAccessMgmtBooks,
  canEditInternalRate,
  canSeeInternalRate,
  filterBooksForRole,
  stripInternalRateIfForbidden,
} from "../src/accounting/ops-book.guard";

describe("Wave 5 ops-book guards", () => {
  it("assertOpsBookIsNas accepts NAS", () => {
    expect(() =>
      assertOpsBookIsNas({ gaapKind: AccountingBookGaapKind.NAS, code: "NAS" }),
    ).not.toThrow();
  });

  it("assertOpsBookIsNas rejects MANAGEMENT with OPS_BOOK_MUST_BE_NAS", () => {
    try {
      assertOpsBookIsNas({
        gaapKind: AccountingBookGaapKind.MANAGEMENT,
        code: "MGMT",
      });
      fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const body = (e as BadRequestException).getResponse() as {
        code?: string;
      };
      expect(body.code).toBe("OPS_BOOK_MUST_BE_NAS");
    }
  });

  it("assertMoneyPathBookNotManagement rejects MGMT bookId", () => {
    expect(() =>
      assertMoneyPathBookNotManagement({
        gaapKind: AccountingBookGaapKind.MANAGEMENT,
      }),
    ).toThrow(BadRequestException);
  });

  it("ACCOUNTANT cannot access MGMT reports", () => {
    expect(canAccessMgmtBooks(UserRole.ACCOUNTANT)).toBe(false);
    expect(() =>
      assertCanAccessMgmtBook(UserRole.ACCOUNTANT, {
        gaapKind: AccountingBookGaapKind.MANAGEMENT,
      }),
    ).toThrow(ForbiddenException);
  });

  it("OWNER can access MGMT", () => {
    expect(canAccessMgmtBooks(UserRole.OWNER)).toBe(true);
    expect(() =>
      assertCanAccessMgmtBook(UserRole.OWNER, {
        gaapKind: AccountingBookGaapKind.MANAGEMENT,
      }),
    ).not.toThrow();
  });

  it("filterBooksForRole hides MANAGEMENT from ACCOUNTANT", () => {
    const books = [
      { gaapKind: AccountingBookGaapKind.NAS, code: "NAS" },
      { gaapKind: AccountingBookGaapKind.MANAGEMENT, code: "MGMT" },
    ];
    expect(filterBooksForRole(books, UserRole.ACCOUNTANT)).toHaveLength(1);
    expect(filterBooksForRole(books, UserRole.OWNER)).toHaveLength(2);
  });
});

describe("Wave 5 internalRate ACL", () => {
  it("ACCOUNTANT never sees or edits internalRate", () => {
    expect(canSeeInternalRate(UserRole.ACCOUNTANT)).toBe(false);
    expect(canEditInternalRate(UserRole.ACCOUNTANT)).toBe(false);
    expect(() => assertCanEditInternalRate(UserRole.ACCOUNTANT)).toThrow(
      ForbiddenException,
    );
    expect(
      stripInternalRateIfForbidden(
        { id: "1", salary: 100, internalRate: 200 },
        UserRole.ACCOUNTANT,
      ),
    ).not.toHaveProperty("internalRate");
  });

  it("HR_MANAGER sees only when org policy on", () => {
    expect(canSeeInternalRate(UserRole.HR_MANAGER)).toBe(false);
    expect(
      canSeeInternalRate(UserRole.HR_MANAGER, {
        hr: { internalRateVisibleToHrManager: true },
      }),
    ).toBe(true);
    expect(canEditInternalRate(UserRole.HR_MANAGER)).toBe(false);
  });

  it("OWNER/ADMIN/DIRECTOR can edit", () => {
    expect(canEditInternalRate(UserRole.OWNER)).toBe(true);
    expect(canEditInternalRate(UserRole.DIRECTOR)).toBe(true);
  });
});

describe("AccountingBookService.setDefaultOps", () => {
  it("refuses MANAGEMENT as default ops", async () => {
    jest.resetModules();
    jest.doMock("../src/subscription/subscription-access.service", () => ({
      SubscriptionAccessService: class SubscriptionAccessService {},
    }));
    const { AccountingBookService } = await import(
      "../src/accounting/accounting-book.service"
    );
    const mgmt = {
      id: "mgmt-id",
      organizationId: "org-1",
      code: "MGMT",
      gaapKind: AccountingBookGaapKind.MANAGEMENT,
      isDefaultOps: false,
      status: "ACTIVE",
    };
    const prisma = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          accountingBook: {
            findFirst: jest.fn().mockResolvedValue(mgmt),
            updateMany: jest.fn(),
            update: jest.fn(),
          },
        }),
      accountingBook: {
        findFirst: jest.fn().mockResolvedValue(mgmt),
      },
    };
    const service = new AccountingBookService(
      prisma as never,
      { getAccountingBookSlots: jest.fn() } as never,
    );
    await expect(service.setDefaultOps("org-1", "mgmt-id")).rejects.toMatchObject({
      response: expect.objectContaining({ code: "OPS_BOOK_MUST_BE_NAS" }),
    });
  });
});
