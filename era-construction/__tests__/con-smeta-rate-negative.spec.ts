/**
 * AC-CON-SMETA-RATE negatives — SKU gate, invalid qty, missing item.
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockPrisma = {
  rateBase: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  rateItem: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  estimateDocument: {
    findFirst: jest.fn(),
  },
  estimateLine: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

class MockIndustryModuleInactiveError extends Error {
  constructor(moduleKey: string) {
    super(`Module not active: ${moduleKey}`);
    this.name = "IndustryModuleInactiveError";
  }
}

const assertEntitled = jest.fn(async () => {
  throw new MockIndustryModuleInactiveError("construction_smeta_rate_engine");
});
const fetchSubscriptionSnapshot = jest.fn(async () => null);

jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "org-1",
}));
jest.mock("@era/satellite-kit", () => ({
  assertEntitled,
  fetchSubscriptionSnapshot,
  IndustryModuleInactiveError: MockIndustryModuleInactiveError,
}));

import {
  calcRate,
  createRateBase,
  listRateBases,
  upsertRateItem,
} from "@/lib/rate-engine.service";

describe("AC-CON-SMETA-RATE negatives", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assertEntitled.mockImplementation(async () => {
      throw new MockIndustryModuleInactiveError("construction_smeta_rate_engine");
    });
    fetchSubscriptionSnapshot.mockResolvedValue(null);
  });

  it("refuses list when SKU is off", async () => {
    const result = await listRateBases();
    expect(result).toMatchObject({ status: 403 });
  });

  it("refuses create when SKU is off", async () => {
    const result = await createRateBase({ code: "RB1", title: "Demo" });
    expect(result).toMatchObject({ status: 403 });
  });

  it("refuses calc when SKU is off", async () => {
    const result = await calcRate({ rateItemId: "ri-1", qty: 2 });
    expect(result).toMatchObject({ status: 403 });
  });

  it("refuses non-positive qty when SKU on", async () => {
    fetchSubscriptionSnapshot.mockResolvedValue({ tier: "TIER_3" });
    const result = await calcRate({ rateItemId: "ri-1", qty: 0 });
    expect(result).toMatchObject({ status: 400 });
  });

  it("refuses missing rate item when SKU on", async () => {
    fetchSubscriptionSnapshot.mockResolvedValue({ tier: "TIER_3" });
    mockPrisma.rateItem.findFirst.mockResolvedValue(null);
    const result = await calcRate({ rateItemId: "missing", qty: 1 });
    expect(result).toMatchObject({ status: 404 });
  });

  it("refuses zero unitAmount when SKU on", async () => {
    fetchSubscriptionSnapshot.mockResolvedValue({ tier: "TIER_3" });
    mockPrisma.rateBase.findFirst.mockResolvedValue({ id: "rb-1" });
    const result = await upsertRateItem("rb-1", {
      code: "X",
      title: "Zero",
      unitAmount: 0,
    });
    expect(result).toMatchObject({ status: 400, error: "unitAmount must be positive" });
  });
});
