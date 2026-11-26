const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

class MockCronOrganizationListError extends Error {
  readonly reason: string;
  constructor(reason: string, message?: string) {
    super(message ?? reason);
    this.name = "CronOrganizationListError";
    this.reason = reason;
  }
}

const mockAls: { organizationId?: string } = {};
const mockListOrgs = jest.fn<Promise<string[]>, []>();
const mockFindMany = jest.fn();
const mockUpdate = jest.fn();
const mockPublish = jest.fn();

jest.mock("@era/satellite-kit", () => ({
  CronOrganizationListError: MockCronOrganizationListError,
  listCronOrganizationIds: (...args: unknown[]) => mockListOrgs(...(args as [])),
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

const mockFetchPool = jest.fn(async () => [ORG_A, ORG_B]);

jest.mock("@/lib/cron-organization-ids", () => ({
  fetchHotelPoolOrganizationIds: (...args: unknown[]) => mockFetchPool(...(args as [])),
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
    mockListOrgs.mockReset();
    mockFetchPool.mockReset();
    mockFindMany.mockReset();
    mockUpdate.mockReset();
    mockPublish.mockReset();
    mockListOrgs.mockResolvedValue([ORG_A, ORG_B]);
    mockFetchPool.mockResolvedValue([ORG_A, ORG_B]);
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

  it("polls each pool org under tenant ALS and does not unbound", async () => {
    const sent = await drainClinicLifecycleOutbox(20);
    expect(sent).toBe(1);
    expect(mockListOrgs).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledTimes(2);
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: "corr-a" }),
      ORG_A,
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "row-a" },
        data: expect.objectContaining({ ackedAt: expect.any(Date) }),
      }),
    );
  });

  it("falls back to orch pool when listCron throws unbound before Sync stamps SHARED", async () => {
    const unbound = new Error("Satellite organizationId is not bound");
    unbound.name = "SatelliteOrganizationUnboundError";
    mockListOrgs.mockRejectedValue(unbound);
    mockFetchPool.mockResolvedValue([ORG_A]);
    const sent = await drainClinicLifecycleOutbox(20);
    expect(sent).toBe(1);
    expect(mockFetchPool).toHaveBeenCalled();
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it("returns 0 when both listCron and orch pool are empty", async () => {
    mockListOrgs.mockRejectedValue(
      new MockCronOrganizationListError("pool_registry_empty"),
    );
    mockFetchPool.mockResolvedValue([]);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await expect(drainClinicLifecycleOutbox()).resolves.toBe(0);
      expect(mockFindMany).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
