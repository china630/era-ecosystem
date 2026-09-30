import { ForbiddenException } from "@nestjs/common";
import {
  WorkforceAbsenceStatus,
  WorkforceTimesheetEntryStatus,
} from "@era365/database";
import { WorkforceSelfService } from "./workforce-self.service";

describe("WorkforceSelfService wave 12", () => {
  function makeSvc(prisma: any) {
    const entitlement = { assertWorkforceHub: jest.fn() };
    const audit = { log: jest.fn() };
    const absences = {
      create: jest.fn(async (_o: string, _u: string, dto: { submit?: boolean }) => ({
        status: dto.submit
          ? WorkforceAbsenceStatus.SUBMITTED
          : WorkforceAbsenceStatus.DRAFT,
      })),
    };
    const mdm = {
      getPersonOpsProfile: jest.fn(async () => ({
        fullName: "Test Person",
        phoneMasked: "+994***",
        nationality: "AZ",
        firstName: "Test",
        lastName: "Person",
      })),
    };
    const financeMirror = {
      queueAdvanceLine: jest.fn(async () => true),
      fetchPostedPayslip: jest.fn(async () => null),
    };
    const svc = new WorkforceSelfService(
      prisma,
      entitlement as never,
      audit as never,
      absences as never,
      mdm as never,
      financeMirror as never,
    );
    return { svc, absences, financeMirror, audit, entitlement };
  }

  it("rejects foreign employmentId with 403", async () => {
    const prisma: any = {
      workforceEmployment: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const { svc } = makeSvc(prisma);
    await expect(
      svc.assertOwnEmployment("org-1", "user-1", "emp-other"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("full-day absence stays SUBMITTED via absences.create(submit:true)", async () => {
    const prisma: any = {
      workforceEmployment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "emp-1",
          organizationId: "org-1",
          platformUserId: "user-1",
          status: "ACTIVE",
        }),
      },
    };
    const { svc, absences } = makeSvc(prisma);
    const row = await svc.submitFullDayAbsence("org-1", "user-1", {
      employmentId: "emp-1",
      kind: "VACATION" as never,
      startDate: "2026-09-01",
      endDate: "2026-09-02",
    });
    expect(absences.create).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      expect.objectContaining({ submit: true }),
    );
    expect(row.status).toBe(WorkforceAbsenceStatus.SUBMITTED);
  });

  it("hourly approve refuses APPROVED cell", async () => {
    const prisma: any = {
      workforceHourlyLeaveRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: "hl-1",
          organizationId: "org-1",
          employmentId: "emp-1",
          workDate: new Date("2026-09-15T00:00:00.000Z"),
          startMinute: 540,
          endMinute: 600,
          paid: false,
          status: "SUBMITTED",
        }),
      },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) => {
        const tx = {
          workforceTimesheet: {
            findUnique: jest.fn().mockResolvedValue({
              id: "ts-1",
              status: "DRAFT",
            }),
          },
          workforceTimesheetEntry: {
            findUnique: jest.fn().mockResolvedValue({
              status: WorkforceTimesheetEntryStatus.APPROVED,
              lockedFromAbsence: false,
              hourlyLeaveMinutes: 0,
              hourlyLeavePaid: false,
            }),
          },
        };
        return fn(tx);
      }),
    };
    const { svc } = makeSvc(prisma);
    await expect(
      svc.approveHourlyLeave("org-1", "hr-1", "hl-1"),
    ).rejects.toThrow(/APPROVED|absence-locked/);
  });

  it("hourly approve refuses mixed paid and unpaid on one day", async () => {
    const prisma: any = {
      workforceHourlyLeaveRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: "hl-2",
          organizationId: "org-1",
          employmentId: "emp-1",
          workDate: new Date("2026-09-15T00:00:00.000Z"),
          startMinute: 600,
          endMinute: 660,
          paid: true,
          status: "SUBMITTED",
        }),
      },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) => {
        const tx = {
          workforceTimesheet: {
            findUnique: jest.fn().mockResolvedValue({
              id: "ts-1",
              status: "DRAFT",
            }),
          },
          workforceTimesheetEntry: {
            findUnique: jest.fn().mockResolvedValue({
              status: WorkforceTimesheetEntryStatus.DRAFT,
              lockedFromAbsence: false,
              hourlyLeaveMinutes: 60,
              hourlyLeavePaid: false,
            }),
          },
        };
        return fn(tx);
      }),
    };
    const { svc } = makeSvc(prisma);
    await expect(
      svc.approveHourlyLeave("org-1", "hr-1", "hl-2"),
    ).rejects.toThrow(/cannot share one day/i);
  });

  it("advance approve queues Finance line and does not invent a payment", async () => {
    const prisma: any = {
      workforceAdvanceRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: "adv-1",
          organizationId: "org-1",
          amountAzn: 100,
          note: "need",
          status: "SUBMITTED",
          employment: { financeEmployeeId: "fin-emp-1" },
        }),
        update: jest.fn().mockResolvedValue({
          id: "adv-1",
          status: "APPROVED",
        }),
      },
    };
    const { svc, financeMirror, audit } = makeSvc(prisma);
    await svc.approveAdvance("org-1", "hr-1", "adv-1");
    expect(financeMirror.queueAdvanceLine).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADVANCE_APPROVED",
        payload: expect.objectContaining({ financeQueued: true }),
      }),
    );
  });

  it("announcement read requires own employment", async () => {
    const prisma: any = {
      workforceEmployment: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const { svc } = makeSvc(prisma);
    await expect(
      svc.markAnnouncementRead("org-1", "user-1", "emp-x", "ann-1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("payslip without financeEmployeeId is 404 (no zeros)", async () => {
    const prisma: any = {
      workforceEmployment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "emp-1",
          organizationId: "org-1",
          platformUserId: "user-1",
          status: "ACTIVE",
          financeEmployeeId: null,
        }),
      },
    };
    const { svc } = makeSvc(prisma);
    await expect(
      svc.getOwnPayslip("org-1", "user-1", "emp-1", 2026, 8),
    ).rejects.toThrow(/Payslip not available/);
  });

  it("payslip is hidden without hr_full and never returns internalRate", async () => {
    const prisma: any = {
      workforceEmployment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "emp-1",
          organizationId: "org-1",
          platformUserId: "user-1",
          status: "ACTIVE",
          financeEmployeeId: "fin-1",
        }),
      },
      organization: {
        findFirst: jest.fn().mockResolvedValue({ activeModules: ["workforce"] }),
      },
    };
    const { svc } = makeSvc(prisma);
    await expect(
      svc.getOwnPayslip("org-1", "user-1", "emp-1", 2026, 8),
    ).rejects.toThrow(/Payslip not available/);

    prisma.organization.findFirst.mockResolvedValue({
      activeModules: ["hr_full"],
    });
    const { svc: svc2, financeMirror } = makeSvc(prisma);
    financeMirror.fetchPostedPayslip.mockResolvedValue({
      year: 2026,
      month: 8,
      gross: "100",
      net: "80",
      lines: [],
      internalRate: "50",
    });
    const slip = await svc2.getOwnPayslip("org-1", "user-1", "emp-1", 2026, 8);
    expect(slip).not.toHaveProperty("internalRate");
    expect(slip.net).toBe("80");
  });
});
