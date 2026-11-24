import { countRemainingOpenSeatDays } from "@/domain/sanatorium/stay-seat-cap";
import { listPaidExtras } from "@/domain/sanatorium/extras-assign.service";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    programInstance: { findFirst: jest.fn() },
    procedureOrder: { findMany: jest.fn(), count: jest.fn() },
  },
}));

jest.mock("@/domain/planning/clinic-day", () => ({
  listClinicDays: jest.fn(),
}));

jest.mock("@/lib/baku-day", () => {
  const actual = jest.requireActual<typeof import("@/lib/baku-day")>("@/lib/baku-day");
  return {
    ...actual,
    todayBakuYmd: () => "2026-11-24",
  };
});

import { prisma } from "@/lib/prisma";
import { listClinicDays } from "@/domain/planning/clinic-day";

const mocked = prisma as unknown as {
  programInstance: { findFirst: jest.Mock };
  procedureOrder: { findMany: jest.Mock };
};
const mockDays = listClinicDays as jest.Mock;

describe("stay seat cap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("counts free working days today…checkout−1 minus occupied OPEN days", async () => {
    mocked.programInstance.findFirst.mockResolvedValue({
      endsOn: new Date("2026-12-06T00:00:00.000Z"),
      startsOn: new Date("2026-11-22T00:00:00.000Z"),
    });
    mockDays.mockResolvedValue([
      { ymd: "2026-11-24", working: true },
      { ymd: "2026-11-25", working: true },
      { ymd: "2026-11-26", working: true },
      { ymd: "2026-11-27", working: true },
      { ymd: "2026-11-28", working: true },
      { ymd: "2026-11-29", working: false },
      { ymd: "2026-11-30", working: true },
      { ymd: "2026-12-01", working: true },
      { ymd: "2026-12-02", working: true },
      { ymd: "2026-12-03", working: true },
      { ymd: "2026-12-04", working: true },
      { ymd: "2026-12-05", working: true },
    ]);
    // 08:00Z = 12:00 Asia/Baku that civil day
    mocked.procedureOrder.findMany.mockResolvedValue([
      { scheduledAt: new Date("2026-11-24T08:00:00.000Z") },
      { scheduledAt: new Date("2026-11-25T08:00:00.000Z") },
    ]);
    const cap = await countRemainingOpenSeatDays("ep-1", "SVC-OPEN");
    // 11 working days in range minus 2 occupied
    expect(cap.remainingSeatDays).toBe(9);
    expect(cap.horizonEndYmd).toBe("2026-12-05");
  });
});

describe("listPaidExtras money truth", () => {
  it("requires paidAt", async () => {
    mocked.procedureOrder.findMany.mockResolvedValue([]);
    await listPaidExtras("ep-1");
    expect(mocked.procedureOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paidAt: { not: null },
          inPackage: false,
        }),
      }),
    );
  });
});
