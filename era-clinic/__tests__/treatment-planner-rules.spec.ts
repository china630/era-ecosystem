jest.mock("@/lib/prisma", () => ({
  prisma: {
    procedureOrder: {
      count: jest.fn(),
    },
  },
}));

import { hasProcedureSameDay } from "@/lib/treatment-planner.service";

describe("treatment planner rules", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("detects same procedure on same calendar day", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.procedureOrder.count.mockResolvedValue(1);
    const day = new Date("2026-06-04T10:00:00");
    const hit = await hasProcedureSameDay("patient-1", "MASSAGE", day);
    expect(hit).toBe(true);
    expect(prisma.procedureOrder.count).toHaveBeenCalled();
  });

  it("allows procedure when none scheduled that day", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.procedureOrder.count.mockResolvedValue(0);
    const day = new Date("2026-06-04T10:00:00");
    const hit = await hasProcedureSameDay("patient-1", "MASSAGE", day);
    expect(hit).toBe(false);
  });
});
