import { WorkforceSeatService } from "./workforce-seat.service";

describe("WorkforceSeatService", () => {
  const prisma = {
    workforceSeatAllocation: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const svc = new WorkforceSeatService(prisma as never);

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
});
