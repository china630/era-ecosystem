import {
  resolveQuotaCodeForServiceCode,
  countEntitlementUsage,
  syncEntitlementUsage,
  isOverEntitlementQuota,
} from "@/domain/sanatorium/entitlement-usage.service";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    procedureOrder: { count: jest.fn() },
    labOrderItem: { count: jest.fn() },
    visitServiceLine: { count: jest.fn() },
    programProcedureBalance: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    programInstance: { findFirst: jest.fn() },
    programTemplateBlockMember: { findMany: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

const mocked = prisma as unknown as {
  procedureOrder: { count: jest.Mock };
  labOrderItem: { count: jest.Mock };
  visitServiceLine: { count: jest.Mock };
  programProcedureBalance: { updateMany: jest.Mock; findUnique: jest.Mock };
};

describe("resolveQuotaCodeForServiceCode", () => {
  it("returns exact balance code", () => {
    expect(
      resolveQuotaCodeForServiceCode({
        balanceCodes: ["ECG-12", "PHYSIO_POOL"],
        membersByBlock: new Map(),
        serviceCode: "ECG-12",
      }),
    ).toBe("ECG-12");
  });

  it("maps pool member SKU to block code", () => {
    expect(
      resolveQuotaCodeForServiceCode({
        balanceCodes: ["PHYSIO_POOL"],
        membersByBlock: new Map([["PHYSIO_POOL", ["SVC-LASER", "SVC-MAGNET"]]]),
        serviceCode: "SVC-LASER",
      }),
    ).toBe("PHYSIO_POOL");
  });

  it("returns null when unmatched", () => {
    expect(
      resolveQuotaCodeForServiceCode({
        balanceCodes: ["PHYSIO_POOL"],
        membersByBlock: new Map([["PHYSIO_POOL", ["SVC-LASER"]]]),
        serviceCode: "ALT",
      }),
    ).toBeNull();
  });
});

describe("countEntitlementUsage + syncEntitlementUsage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.procedureOrder.count.mockResolvedValue(2);
    mocked.labOrderItem.count.mockResolvedValue(1);
    mocked.visitServiceLine.count.mockResolvedValue(1);
    mocked.programProcedureBalance.updateMany.mockResolvedValue({ count: 1 });
  });

  it("sums procedure + lab + visit counts", async () => {
    const used = await countEntitlementUsage({
      episodeId: "ep1",
      quotaCode: "PHYSIO_POOL",
    });
    expect(used).toBe(4);
    expect(mocked.procedureOrder.count).toHaveBeenCalled();
    expect(mocked.labOrderItem.count).toHaveBeenCalled();
    expect(mocked.visitServiceLine.count).toHaveBeenCalled();
  });

  it("syncEntitlementUsage writes the COUNT (no double-increment)", async () => {
    const used = await syncEntitlementUsage({
      instanceId: "inst1",
      episodeId: "ep1",
      quotaCode: "PHYSIO_POOL",
    });
    expect(used).toBe(4);
    expect(mocked.programProcedureBalance.updateMany).toHaveBeenCalledWith({
      where: { instanceId: "inst1", procedureCode: "PHYSIO_POOL" },
      data: { quotaUsed: 4 },
    });
  });
});

describe("isOverEntitlementQuota", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns overQuota when used >= total", async () => {
    mocked.programProcedureBalance.findUnique.mockResolvedValue({
      quotaTotal: 10,
      quotaUsed: 10,
    });
    const r = await isOverEntitlementQuota({
      instanceId: "inst1",
      quotaCode: "PHYSIO_POOL",
    });
    expect(r).toEqual({ hasBalance: true, overQuota: true, remaining: 0 });
  });

  it("returns remaining when under cap", async () => {
    mocked.programProcedureBalance.findUnique.mockResolvedValue({
      quotaTotal: 10,
      quotaUsed: 3,
    });
    const r = await isOverEntitlementQuota({
      instanceId: "inst1",
      quotaCode: "PHYSIO_POOL",
    });
    expect(r).toEqual({ hasBalance: true, overQuota: false, remaining: 7 });
  });

  it("has no balance when line missing", async () => {
    mocked.programProcedureBalance.findUnique.mockResolvedValue(null);
    const r = await isOverEntitlementQuota({
      instanceId: "inst1",
      quotaCode: "MISSING",
    });
    expect(r.hasBalance).toBe(false);
  });
});
