import { TariffTier } from "@era365/database";
import {
  parseEmployeeCap,
  WorkforceSeatService,
} from "./workforce-seat.service";

describe("parseEmployeeCap", () => {
  it("reads maxEmployees and employees aliases", () => {
    expect(parseEmployeeCap({ maxEmployees: 200 })).toBe(200);
    expect(parseEmployeeCap({ employees: 80 })).toBe(80);
    expect(parseEmployeeCap({ maxEmployees: null })).toBe(null);
    expect(parseEmployeeCap(null)).toBe(undefined);
  });
});

describe("WorkforceSeatService", () => {
  const prisma = {
    workforceSeatAllocation: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    organizationSubscription: {
      findUnique: jest.fn(),
    },
  };

  const systemConfig = {
    getTierQuotas: jest.fn(),
  };

  const svc = new WorkforceSeatService(prisma as never, systemConfig as never);

  beforeEach(() => jest.clearAllMocks());

  it("assertSeatAvailable rejects duplicate person in scope", async () => {
    prisma.workforceSeatAllocation.findFirst.mockResolvedValue({ id: "s1" });

    await expect(
      svc.assertSeatAvailable("scope1", "person1"),
    ).rejects.toMatchObject({
      response: { code: "WORKFORCE_SEAT_TAKEN" },
    });
  });

  it("assertSeatAvailable rejects when quota full", async () => {
    prisma.workforceSeatAllocation.findFirst.mockResolvedValue(null);
    prisma.workforceSeatAllocation.count.mockResolvedValue(500);

    await expect(
      svc.assertSeatAvailable("scope1", "person2"),
    ).rejects.toMatchObject({
      response: { code: "WORKFORCE_SEATS_FULL" },
    });
  });

  it("allows seat when person free and under quota", async () => {
    prisma.workforceSeatAllocation.findFirst.mockResolvedValue(null);
    prisma.workforceSeatAllocation.count.mockResolvedValue(10);

    await expect(
      svc.assertSeatAvailable("scope1", "person3"),
    ).resolves.toBeUndefined();
  });

  it("uses Super-admin tier maxEmployees, not compiled TIER_3=50", async () => {
    const orgId = "11111111-1111-4111-8111-111111111111";
    prisma.workforceSeatAllocation.findFirst.mockResolvedValue(null);
    prisma.workforceSeatAllocation.count.mockResolvedValue(50);
    prisma.organizationSubscription.findUnique.mockResolvedValue({
      currentTier: TariffTier.TIER_3,
      quotaOverrides: null,
    });
    systemConfig.getTierQuotas.mockResolvedValue({ maxEmployees: 200 });

    await expect(
      svc.assertSeatAvailable("scope1", "person4", orgId),
    ).resolves.toBeUndefined();
    expect(systemConfig.getTierQuotas).toHaveBeenCalledWith(TariffTier.TIER_3);
  });

  it("rejects when used meets SystemConfig maxEmployees", async () => {
    const orgId = "11111111-1111-4111-8111-111111111111";
    prisma.workforceSeatAllocation.findFirst.mockResolvedValue(null);
    prisma.workforceSeatAllocation.count.mockResolvedValue(200);
    prisma.organizationSubscription.findUnique.mockResolvedValue({
      currentTier: TariffTier.TIER_3,
      quotaOverrides: null,
    });
    systemConfig.getTierQuotas.mockResolvedValue({ maxEmployees: 200 });

    await expect(
      svc.assertSeatAvailable("scope1", "person5", orgId),
    ).rejects.toMatchObject({
      response: { code: "WORKFORCE_SEATS_FULL" },
    });
  });
});
