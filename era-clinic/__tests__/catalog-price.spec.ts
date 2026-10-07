import { catalogUnitPrice, resolveProcedureAmount } from "@/domain/catalog/catalog-price.service";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    serviceCatalogCache: { findFirst: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

const findFirst = prisma.serviceCatalogCache.findFirst as jest.Mock;

describe("catalogUnitPrice", () => {
  it("uses listAmount when the older row left amount at 0", () => {
    expect(catalogUnitPrice({ amount: 0, listAmount: 14 })).toBe(14);
  });

  it("uses amount when listAmount is empty", () => {
    expect(catalogUnitPrice({ amount: 14, listAmount: null })).toBe(14);
  });

  it("is zero when both are empty", () => {
    expect(catalogUnitPrice({ amount: 0, listAmount: null })).toBe(0);
  });
});

describe("resolveProcedureAmount", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the catalog price even when packageIncluded is set", async () => {
    findFirst.mockResolvedValue({
      amount: 0,
      listAmount: 14,
      packageIncluded: true,
    });
    await expect(resolveProcedureAmount("SVC-INFRAQIRMIZI")).resolves.toEqual({
      amountNet: 14,
      priceMissing: false,
    });
  });
});
