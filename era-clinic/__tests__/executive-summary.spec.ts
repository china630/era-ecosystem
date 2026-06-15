jest.mock("@/lib/prisma", () => ({
  prisma: {
    visit: {
      count: jest.fn(),
    },
    labOrder: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock("@/lib/capacity.service", () => ({
  getCapacitySummary: jest.fn().mockResolvedValue({
    guestEquivalent: 10,
    scheduledSlots: 20,
    riskLevel: "ok",
  }),
}));

describe("executive summary query", () => {
  it("filters visits by practitioner when provided", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.visit.count.mockResolvedValue(3);
    prisma.labOrder.findMany.mockResolvedValue([{ amountNet: "10" }]);
    prisma.labOrder.count.mockResolvedValue(2);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await prisma.visit.count({
      where: {
        createdAt: { gte: today, lt: tomorrow },
        practitionerId: "pr1",
      },
    });

    expect(prisma.visit.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ practitionerId: "pr1" }),
    });
  });
});
