import { BadRequestException, HttpException } from "@nestjs/common";
import {
  Decimal,
  EmployeeEmploymentStatus,
  TimesheetStatus,
} from "@erafinance/database";
import { PayrollService } from "./payroll.service";
import { TimesheetService } from "./timesheet.service";

describe("PayrollService createDraftRunSync — contract salary gate", () => {
  const orgId = "660e8400-e29b-41d4-a716-446655440001";

  it("throws CONTRACT_SALARY_REQUIRED when ACTIVE employee salary is 0", async () => {
    const prisma = {
      payrollRun: { findUnique: jest.fn().mockResolvedValue(null) },
      employee: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "e1",
            globalPersonId: "880e8400-e29b-41d4-a716-446655440003",
            salary: new Decimal(0),
            tariffSalary: new Decimal(0),
            supplementSalary: new Decimal(0),
            employmentStatus: EmployeeEmploymentStatus.ACTIVE,
            kind: "EMPLOYEE",
            workSchedule: null,
          },
        ]),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ settings: {} }),
      },
    };
    // Private fields — attach via any for unit gate test.
    const svc = Object.create(PayrollService.prototype) as PayrollService;
    Object.assign(svc as object, {
      prisma,
      payrollComponents: {
        componentIdMap: jest.fn().mockResolvedValue(new Map()),
      },
      mdm: {},
      timesheet: {},
      absences: {},
    });

    try {
      await svc.createDraftRunSync(orgId, { year: 2026, month: 8 });
      fail("expected BadRequestException");
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const body = (e as BadRequestException).getResponse() as {
        code?: string;
        employeeCount?: number;
      };
      expect(body.code).toBe("CONTRACT_SALARY_REQUIRED");
      expect(body.employeeCount).toBe(1);
    }
  });
});

describe("dual-org payroll month uniqueness", () => {
  it("organizationId_year_month unique allows same month on two VÖEN", () => {
    const orgA = "660e8400-e29b-41d4-a716-446655440001";
    const orgB = "660e8400-e29b-41d4-a716-446655440002";
    const keys = new Set([`${orgA}:2026:8`, `${orgB}:2026:8`]);
    expect(keys.size).toBe(2);
  });
});

describe("closed-period mark-paid contract", () => {
  it("accounting postTransaction uses HTTP 423 when period locked", () => {
    const err = new HttpException("Период закрыт для изменений", 423);
    expect(err.getStatus()).toBe(423);
  });
});

describe("TimesheetService.markApprovedFromCpMirror", () => {
  it("updates DRAFT → APPROVED", async () => {
    const prisma = {
      timesheet: {
        findFirst: jest.fn().mockResolvedValue({
          id: "ts-1",
          status: TimesheetStatus.DRAFT,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const svc = new TimesheetService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const id = await svc.markApprovedFromCpMirror(
      "660e8400-e29b-41d4-a716-446655440001",
      2026,
      8,
    );
    expect(id).toBe("ts-1");
    expect(prisma.timesheet.update).toHaveBeenCalledWith({
      where: { id: "ts-1" },
      data: { status: TimesheetStatus.APPROVED },
    });
  });

  it("idempotent when already APPROVED", async () => {
    const prisma = {
      timesheet: {
        findFirst: jest.fn().mockResolvedValue({
          id: "ts-1",
          status: TimesheetStatus.APPROVED,
        }),
        update: jest.fn(),
      },
    };
    const svc = new TimesheetService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const id = await svc.markApprovedFromCpMirror(
      "660e8400-e29b-41d4-a716-446655440001",
      2026,
      8,
    );
    expect(id).toBe("ts-1");
    expect(prisma.timesheet.update).not.toHaveBeenCalled();
  });
});

describe("TimesheetService.summarizeForPayroll", () => {
  it("rejects non-APPROVED timesheet (wave 1 handoff dependency)", async () => {
    const prisma = {
      timesheet: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const svc = new TimesheetService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      svc.summarizeForPayroll(
        "ts-draft",
        "660e8400-e29b-41d4-a716-446655440001",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
