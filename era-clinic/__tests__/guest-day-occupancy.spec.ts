import { guestDayOccupancyStatusOr } from "@/domain/planning/guest-day-occupancy";
import { unpaidExtraVisibleOnPlanWhere } from "@/domain/sanatorium/extra-procedure-route";

describe("guestDayOccupancyStatusOr", () => {
  it("counts every PENDING_PAY and PROPOSED toward the guest day", () => {
    const or = guestDayOccupancyStatusOr();
    expect(or).toEqual(
      expect.arrayContaining([
        { status: "PENDING_PAY" },
        { status: "PROPOSED" },
      ]),
    );
    expect(or.some((row) => "resourceId" in row)).toBe(false);
  });
});

describe("unpaidExtraVisibleOnPlanWhere", () => {
  it("keeps FIXED unpaid off Plan until a cabin is held", () => {
    const where = unpaidExtraVisibleOnPlanWhere();
    expect(where.status).toBe("PENDING_PAY");
    expect(where.inPackage).toBe(false);
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { resourceId: { not: null } },
        { schedulingMode: "OPEN" },
      ]),
    );
  });
});
