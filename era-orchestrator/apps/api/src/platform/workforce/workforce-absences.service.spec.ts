import { BadRequestException } from "@nestjs/common";
import { WorkforceAbsenceStatus } from "@era365/database";
import { WorkforceAbsencesService } from "./workforce-absences.service";

describe("WorkforceAbsencesService", () => {
  const prisma = {
    workforceAbsence: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const entitlement = { assertWorkforceHub: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const satelliteEvents = { enqueue: jest.fn().mockResolvedValue({ jobId: "j1" }) };

  const svc = new WorkforceAbsencesService(
    prisma as never,
    entitlement as never,
    audit as never,
    satelliteEvents as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects approve when status is not SUBMITTED", async () => {
    prisma.workforceAbsence.findFirst.mockResolvedValue({
      id: "a1",
      organizationId: "org1",
      employmentId: "e1",
      status: WorkforceAbsenceStatus.DRAFT,
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2026-06-05T00:00:00.000Z"),
      employment: { globalPersonId: "p1", financeEmployeeId: null },
    });
    await expect(svc.approve("org1", "a1", "u1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("throws ABSENCE_OVERLAP on conflicting submitted row", async () => {
    prisma.workforceAbsence.findFirst
      .mockResolvedValueOnce({
        id: "a1",
        organizationId: "org1",
        employmentId: "e1",
        status: WorkforceAbsenceStatus.SUBMITTED,
        startDate: new Date("2026-06-01T00:00:00.000Z"),
        endDate: new Date("2026-06-05T00:00:00.000Z"),
        employment: { globalPersonId: "p1", financeEmployeeId: null },
      })
      .mockResolvedValueOnce({
        id: "other",
        kind: "VACATION",
        startDate: new Date("2026-06-03T00:00:00.000Z"),
        endDate: new Date("2026-06-07T00:00:00.000Z"),
      });

    await expect(svc.approve("org1", "a1", "u1")).rejects.toMatchObject({
      response: { code: "ABSENCE_OVERLAP" },
    });
  });
});
