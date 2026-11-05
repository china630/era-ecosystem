import { ModuleGraceService, MODULE_GRACE_DAYS } from "./module-grace.service";

describe("ModuleGraceService", () => {
  const prisma = {
    organizationSubscription: { findUnique: jest.fn() },
    organizationModuleGrace: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };
  const svc = new ModuleGraceService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("needsLateMonthConfirmation when Baku day >= 20", () => {
    const now = new Date("2026-09-22T12:00:00.000Z");
    const graceEndsAt = svc.graceEndsAtFromStart(now);
    expect(svc.needsLateMonthConfirmation(now, graceEndsAt)).toBe(true);
  });

  it("does not require late-month confirmation early in month with long tail", () => {
    const now = new Date("2026-09-05T12:00:00.000Z");
    const graceEndsAt = svc.graceEndsAtFromStart(now);
    expect(svc.needsLateMonthConfirmation(now, graceEndsAt)).toBe(false);
  });

  it("grace window length is MODULE_GRACE_DAYS Baku days from start", () => {
    const started = new Date("2026-09-01T10:00:00.000Z");
    const ends = svc.graceEndsAtFromStart(started);
    expect(ends.getTime()).toBeGreaterThan(started.getTime());
    expect(MODULE_GRACE_DAYS).toBe(7);
  });

  it("shouldSkipModuleForBillingPeriod when grace overlaps billed month", async () => {
    prisma.organizationModuleGrace.findUnique.mockResolvedValue({
      graceStartedAt: new Date("2026-08-10T00:00:00.000Z"),
      graceEndsAt: new Date("2026-08-20T00:00:00.000Z"),
      graceConsumedAt: null,
    });
    const skip = await svc.shouldSkipModuleForBillingPeriod(
      "org-1",
      "cash_bank_pro",
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-08-31T23:59:59.999Z"),
    );
    expect(skip).toBe(true);
  });

  it("isOrgEligibleForModuleGrace is false during platform trial", async () => {
    prisma.organizationSubscription.findUnique.mockResolvedValue({
      isTrial: true,
    });
    await expect(svc.isOrgEligibleForModuleGrace("org-1")).resolves.toBe(false);
  });
});
