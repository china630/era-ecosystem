import { ConflictException } from "@nestjs/common";
import { TimesheetStatus } from "@erafinance/database";
import { TimesheetService } from "../../src/hr/timesheet.service";

describe("TimesheetService CP attendance master", () => {
  it("returns 409 TIMESHEET_MASTER_IS_CP when platform_workforce is on", async () => {
    const tsRow = {
      id: "ts-1",
      organizationId: "org-1",
      status: TimesheetStatus.DRAFT,
      year: 2026,
      month: 8,
    };
    const prisma = {
      timesheet: { findFirst: jest.fn().mockResolvedValue(tsRow) },
    } as never;
    const calendar = {} as never;
    const mdm = {} as never;
    const subscriptionAccess = {
      hasModule: jest.fn().mockResolvedValue(true),
    } as never;
    const svc = new TimesheetService(prisma, calendar, mdm, subscriptionAccess);

    await expect(svc.autofill("org-1", "ts-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
    try {
      await svc.autofill("org-1", "ts-1");
    } catch (err) {
      expect((err as ConflictException).getResponse()).toMatchObject({
        code: "TIMESHEET_MASTER_IS_CP",
      });
    }
  });
});
