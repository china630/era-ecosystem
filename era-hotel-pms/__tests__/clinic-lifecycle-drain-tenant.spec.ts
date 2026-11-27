const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const mockAls: { organizationId?: string } = {};
const mockDiscoverFindMany = jest.fn();
const mockFindMany = jest.fn();
const mockUpdate = jest.fn();
const mockPublish = jest.fn();

jest.mock("@era/satellite-kit", () => ({
  runWithSatelliteTenant: async <T>(ctx: { organizationId?: string }, fn: () => Promise<T> | T) => {
    const prev = mockAls.organizationId;
    mockAls.organizationId = ctx.organizationId;
    try {
      return await fn();
    } finally {
      mockAls.organizationId = prev;
    }
  },
}));

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    clinicLifecycleOutbox: {
      findMany: (...args: unknown[]) => mockDiscoverFindMany(...args),
    },
  })),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    clinicLifecycleOutbox: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    reservation: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/integration/guest-lifecycle-events", () => ({
  publishLifecycle: (...args: unknown[]) => mockPublish(...args),
}));

jest.mock("@/lib/request-organization", () => ({
  enterRequestTenant: jest.fn(),
  requestOrganizationId: jest.fn(),
}));

import { drainClinicLifecycleOutbox } from "@/lib/integration/clinic-lifecycle-outbox";

describe("clinic lifecycle drain tenant", () => {
  beforeEach(() => {
    mockAls.organizationId = undefined;
    mockDiscoverFindMany.mockReset();
    mockFindMany.mockReset();
    mockUpdate.mockReset();
    mockPublish.mockReset();
    mockDiscoverFindMany.mockResolvedValue([{ organizationId: ORG_A }]);
    mockFindMany.mockImplementation(async () => {
      if (!mockAls.organizationId) {
        throw new Error("SatelliteOrganizationUnboundError");
      }
      if (mockAls.organizationId === ORG_A) {
        return [
          {
            id: "row-a",
            organizationId: ORG_A,
            correlationId: "corr-a",
            payload: { type: "SATELLITE_HOTEL_GUEST_CHECKED_IN" },
            attempts: 0,
          },
        ];
      }
      return [];
    });
    mockPublish.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue({});
  });

  it("discovers due orgs unscoped then drains under tenant ALS", async () => {
    const sent = await drainClinicLifecycleOutbox(20);
    expect(sent).toBe(1);
    expect(mockDiscoverFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        distinct: ["organizationId"],
        select: { organizationId: true },
      }),
    );
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: "corr-a" }),
      ORG_A,
    );
  });

  it("is quiet when no due outbox rows exist", async () => {
    mockDiscoverFindMany.mockResolvedValue([]);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await expect(drainClinicLifecycleOutbox()).resolves.toBe(0);
      expect(mockFindMany).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("drains multiple due orgs", async () => {
    mockDiscoverFindMany.mockResolvedValue([
      { organizationId: ORG_A },
      { organizationId: ORG_B },
    ]);
    mockFindMany.mockImplementation(async () => {
      const org = mockAls.organizationId;
      return [
        {
          id: `row-${org}`,
          organizationId: org,
          correlationId: `corr-${org}`,
          payload: { type: "SATELLITE_HOTEL_GUEST_CHECKED_IN" },
          attempts: 0,
        },
      ];
    });
    const sent = await drainClinicLifecycleOutbox(20);
    expect(sent).toBe(2);
    expect(mockFindMany).toHaveBeenCalledTimes(2);
  });
});
