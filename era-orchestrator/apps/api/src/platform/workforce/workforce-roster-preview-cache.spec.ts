import { WorkforceRosterService } from "./workforce-roster.service";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("WorkforceRosterService preview cache", () => {
  it("returns the cached grid without loading assignments", async () => {
    const snapshot = {
      year: 2026,
      month: 3,
      lastDay: 31,
      places: [],
      rows: [{ employmentId: "emp-1" }],
      gaps: [],
    };
    const prisma = {
      workforceShiftAssignment: { findMany: jest.fn() },
    };
    const cache = {
      read: jest.fn().mockResolvedValue(snapshot),
      write: jest.fn(),
      forgetOrganization: jest.fn(),
    };
    const svc = new WorkforceRosterService(
      prisma as never,
      { assertWorkforceHub: jest.fn() } as never,
      { log: jest.fn() } as never,
      cache as never,
    );
    const out = await svc.previewMonth(ORG, 2026, 3);
    expect(out).toEqual(snapshot);
    expect(prisma.workforceShiftAssignment.findMany).not.toHaveBeenCalled();
    expect(cache.write).not.toHaveBeenCalled();
  });

  it("drops the org snapshot after a day override is deleted", async () => {
    const prisma = {
      workforceDayOverride: {
        findFirst: jest.fn().mockResolvedValue({ id: "ov-1", organizationId: ORG }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const cache = {
      read: jest.fn(),
      write: jest.fn(),
      forgetOrganization: jest.fn(),
    };
    const svc = new WorkforceRosterService(
      prisma as never,
      { assertWorkforceHub: jest.fn() } as never,
      { log: jest.fn() } as never,
      cache as never,
    );
    await svc.deleteOverride(ORG, "ov-1", "actor-1");
    expect(cache.forgetOrganization).toHaveBeenCalledWith(ORG);
  });
});
