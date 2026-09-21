import {
  applyPriceMissingFallback,
  DEFAULT_OVER_QUOTA_AZN,
  resolveEntitlementCharge,
} from "@/domain/sanatorium/entitlement-charge.service";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    serviceCatalogCache: { findFirst: jest.fn() },
    clinicalEpisode: { findUnique: jest.fn() },
    programInstance: { findFirst: jest.fn() },
    programProcedureBalance: { findUnique: jest.fn() },
    programTemplateBlockMember: { findMany: jest.fn() },
  },
}));

jest.mock("@/domain/sanatorium/entitlement-usage.service", () => ({
  resolveEntitlementInstance: jest.fn(),
  resolvePackageStampForEpisode: jest.fn(),
  isOverEntitlementQuota: jest.fn(),
  membersByBlockForInstance: jest.fn(),
  resolveQuotaCodeForServiceCode: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  resolveEntitlementInstance,
  resolvePackageStampForEpisode,
  isOverEntitlementQuota,
} from "@/domain/sanatorium/entitlement-usage.service";

const mockedPrisma = prisma as unknown as {
  serviceCatalogCache: { findFirst: jest.Mock };
  clinicalEpisode: { findUnique: jest.Mock };
  programProcedureBalance: { findUnique: jest.Mock };
};

const mockedUsage = {
  resolveEntitlementInstance: resolveEntitlementInstance as jest.Mock,
  resolvePackageStampForEpisode: resolvePackageStampForEpisode as jest.Mock,
  isOverEntitlementQuota: isOverEntitlementQuota as jest.Mock,
};

describe("resolveEntitlementCharge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.serviceCatalogCache.findFirst.mockResolvedValue({
      amount: 0,
      listAmount: 40,
      packageIncluded: true,
    });
    mockedPrisma.clinicalEpisode.findUnique.mockResolvedValue({
      programCode: "PKG-STANDART",
      noPackageConfirmedAt: null,
    });
    mockedUsage.resolvePackageStampForEpisode.mockResolvedValue(null);
  });

  it("in quota → amountNet 0", async () => {
    mockedUsage.resolveEntitlementInstance.mockResolvedValue({
      id: "inst1",
      entitlementSnapshot: null,
      procedureLines: [{ procedureCode: "CARDIO-ECG" }],
    });
    mockedUsage.resolvePackageStampForEpisode.mockResolvedValue({
      inPackage: true,
      packageQuotaCode: "CARDIO-ECG",
    });
    mockedUsage.isOverEntitlementQuota.mockResolvedValue({
      hasBalance: true,
      overQuota: false,
      remaining: 2,
    });
    mockedPrisma.programProcedureBalance.findUnique.mockResolvedValue({
      quotaTotal: 3,
      quotaUsed: 1,
    });

    const r = await resolveEntitlementCharge({
      episodeId: "ep1",
      patientOrigin: "IN_HOUSE",
      serviceCode: "CARDIO-ECG",
      inPackage: true,
      quotaCode: "CARDIO-ECG",
    });
    expect(r).toMatchObject({
      amountNet: 0,
      overQuota: false,
      priceMissing: false,
      reason: "in_quota",
    });
  });

  it("walk-in → list price (never free from package)", async () => {
    mockedUsage.resolveEntitlementInstance.mockResolvedValue({
      id: "inst1",
      entitlementSnapshot: null,
      procedureLines: [{ procedureCode: "CARDIO-ECG" }],
    });
    const r = await resolveEntitlementCharge({
      episodeId: "ep1",
      patientOrigin: "WALK_IN",
      serviceCode: "CARDIO-ECG",
      inPackage: true,
      quotaCode: "CARDIO-ECG",
    });
    expect(r).toMatchObject({
      amountNet: 40,
      overQuota: false,
      priceMissing: false,
      reason: "walk_in",
    });
    expect(mockedUsage.resolveEntitlementInstance).not.toHaveBeenCalled();
  });

  it("priceMissing when list and amount absent/zero", async () => {
    mockedPrisma.serviceCatalogCache.findFirst.mockResolvedValue({
      amount: 0,
      listAmount: null,
      packageIncluded: true,
    });
    mockedUsage.resolveEntitlementInstance.mockResolvedValue(null);
    const r = await resolveEntitlementCharge({
      episodeId: "ep1",
      patientOrigin: "IN_HOUSE",
      serviceCode: "MISSING",
    });
    expect(r).toMatchObject({
      amountNet: 0,
      priceMissing: true,
      reason: "price_missing",
    });
  });

  it("noPackageConfirmed → paid at list price", async () => {
    mockedPrisma.clinicalEpisode.findUnique.mockResolvedValue({
      programCode: null,
      noPackageConfirmedAt: new Date("2026-09-08T10:00:00Z"),
    });
    mockedUsage.resolveEntitlementInstance.mockResolvedValue(null);
    const r = await resolveEntitlementCharge({
      episodeId: "ep1",
      patientOrigin: "IN_HOUSE",
      serviceCode: "CARDIO-ECG",
    });
    expect(r).toMatchObject({
      amountNet: 40,
      priceMissing: false,
      reason: "no_package_confirmed",
    });
  });

  it("NO_PROGRAM_CODE awaiting_package → 0 without priceMissing", async () => {
    mockedPrisma.clinicalEpisode.findUnique.mockResolvedValue({
      programCode: null,
      noPackageConfirmedAt: null,
    });
    mockedUsage.resolveEntitlementInstance.mockResolvedValue(null);
    const r = await resolveEntitlementCharge({
      episodeId: "ep1",
      patientOrigin: "IN_HOUSE",
      serviceCode: "CARDIO-ECG",
    });
    expect(r).toMatchObject({
      amountNet: 0,
      overQuota: false,
      priceMissing: false,
      reason: "awaiting_package",
    });
  });
});

describe("applyPriceMissingFallback", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  afterAll(() => warn.mockRestore());

  it("fills the default amount when a paid line has no list price", () => {
    const r = applyPriceMissingFallback(
      { amountNet: 0, overQuota: false, priceMissing: true, reason: "price_missing" },
      { serviceCode: "MISSING", where: "lab" },
    );
    expect(r.amountNet).toBe(DEFAULT_OVER_QUOTA_AZN);
    // Stays flagged so the code keeps showing in the missing-price report.
    expect(r.priceMissing).toBe(true);
  });

  it("leaves in-quota and awaiting_package lines at zero", () => {
    for (const reason of ["in_quota", "awaiting_package"]) {
      const r = applyPriceMissingFallback(
        { amountNet: 0, overQuota: false, priceMissing: true, reason },
        { serviceCode: "CARDIO-ECG", where: "lab" },
      );
      expect(r.amountNet).toBe(0);
    }
  });

  it("keeps a resolved price untouched", () => {
    const r = applyPriceMissingFallback(
      { amountNet: 40, overQuota: true, priceMissing: false, reason: "over_quota" },
      { serviceCode: "CARDIO-ECG", where: "procedure" },
    );
    expect(r.amountNet).toBe(40);
  });
});
