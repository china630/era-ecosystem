import { createHash, createHmac } from "crypto";
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  WorkforceAttendanceDirection,
  WorkforceAttendancePunchStatus,
  WorkforceTimesheetEntryStatus,
  WorkforceTimesheetStatus,
} from "@era365/database";
import { WorkforceAttendanceService } from "./workforce-attendance.service";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PLACE_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PLACE_B = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const EMP_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const EMP_B = "99999999-9999-4999-8999-999999999999";
const DEVICE_A = "11111111-1111-4111-8111-111111111111";
const ACTOR = "33333333-3333-4333-8333-333333333333";
const TS = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function sha256Hex(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

describe("WorkforceAttendanceService wave 6", () => {
  const prisma: any = {
    workforceAttendanceDevice: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    workforceAttendanceIdentity: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    workforceAttendancePunch: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    workforcePlace: { findFirst: jest.fn() },
    workforceEmployment: { findFirst: jest.fn() },
    workforceShiftAssignment: { findFirst: jest.fn() },
    workforceShiftType: { findMany: jest.fn() },
    workforceTimesheet: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    workforceTimesheetEntry: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const audit = { log: jest.fn() };
  const svc = new WorkforceAttendanceService(
    prisma,
    entitlement as never,
    audit as never,
  );

  const rawToken = "att_test_token_wave6_abc";
  const tokenHash = sha256Hex(rawToken);

  beforeEach(() => {
    jest.clearAllMocks();
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
    audit.log.mockResolvedValue(undefined);
    prisma.workforceAttendanceDevice.findFirst.mockResolvedValue({
      id: DEVICE_A,
      organizationId: ORG_A,
      placeId: PLACE_A,
      tokenHash,
      hmacSecretHash: null,
      status: "ACTIVE",
    });
    prisma.workforceAttendanceDevice.update.mockResolvedValue({});
    prisma.workforceAttendanceIdentity.findUnique.mockResolvedValue({
      employmentId: EMP_A,
      personRef: "badge-1",
      organizationId: ORG_A,
    });
    prisma.workforceEmployment.findFirst.mockResolvedValue({
      id: EMP_A,
      organizationId: ORG_A,
    });
    prisma.workforceAttendancePunch.findUnique.mockResolvedValue(null);
    prisma.workforceAttendancePunch.create.mockImplementation(
      async ({ data }: any) => ({
        id: "punch-" + data.direction,
        ...data,
      }),
    );
    prisma.workforceShiftAssignment.findFirst.mockResolvedValue(null);
    prisma.workforceShiftType.findMany.mockResolvedValue([
      { id: "night", defaultHours: 12, isNight: true },
    ]);
  });

  it("401 on bad token", async () => {
    prisma.workforceAttendanceDevice.findFirst.mockResolvedValue(null);
    await expect(
      svc.authenticateDevice("Bearer att_nope", undefined, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("401 on missing Bearer", async () => {
    await expect(
      svc.authenticateDevice(undefined, undefined, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects HMAC when required and signature wrong", async () => {
    prisma.workforceAttendanceDevice.findFirst.mockResolvedValue({
      id: DEVICE_A,
      organizationId: ORG_A,
      placeId: PLACE_A,
      tokenHash,
      hmacSecretHash: tokenHash,
      status: "ACTIVE",
    });
    await expect(
      svc.authenticateDevice(
        `Bearer ${rawToken}`,
        '{"punches":[]}',
        "sha256=deadbeef",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("accepts HMAC when signature matches token key", async () => {
    prisma.workforceAttendanceDevice.findFirst.mockResolvedValue({
      id: DEVICE_A,
      organizationId: ORG_A,
      placeId: PLACE_A,
      tokenHash,
      hmacSecretHash: tokenHash,
      status: "ACTIVE",
    });
    const body = '{"punches":[]}';
    const sig = createHmac("sha256", rawToken).update(body, "utf8").digest("hex");
    const auth = await svc.authenticateDevice(
      `Bearer ${rawToken}`,
      body,
      `sha256=${sig}`,
    );
    expect(auth.organizationId).toBe(ORG_A);
  });

  it("403 when placeCode belongs to another org", async () => {
    const device = await svc.authenticateDevice(
      `Bearer ${rawToken}`,
      undefined,
      undefined,
    );
    prisma.workforcePlace.findFirst.mockResolvedValue(null);
    await expect(
      svc.ingestPunches(
        device,
        {
          punches: [
            {
              occurredAt: "2026-09-16T16:00:00.000Z",
              direction: "IN",
              personRef: "badge-1",
              placeCode: "OTHER",
            },
          ],
        },
        DEVICE_A,
      ),
    ).resolves.toMatchObject({ rejected: 1, accepted: 0 });
  });

  it("cross-org employment mapping is rejected", async () => {
    const device = await svc.authenticateDevice(
      `Bearer ${rawToken}`,
      undefined,
      undefined,
    );
    prisma.workforceAttendanceIdentity.findUnique.mockResolvedValue({
      employmentId: EMP_B,
      personRef: "badge-1",
      organizationId: ORG_A,
    });
    prisma.workforceEmployment.findFirst.mockResolvedValue(null);
    const r = await svc.ingestPunches(
      device,
      {
        punches: [
          {
            occurredAt: "2026-09-16T16:00:00.000Z",
            direction: "IN",
            personRef: "badge-1",
          },
        ],
      },
      DEVICE_A,
    );
    expect(r.rejected).toBe(1);
  });

  it("duplicate externalId does not double-create", async () => {
    const device = await svc.authenticateDevice(
      `Bearer ${rawToken}`,
      undefined,
      undefined,
    );
    prisma.workforceAttendancePunch.findUnique.mockResolvedValue({
      id: "existing",
      organizationId: ORG_A,
      status: "MAPPED",
    });
    const r = await svc.ingestPunches(
      device,
      {
        punches: [
          {
            occurredAt: "2026-09-16T16:00:00.000Z",
            direction: "IN",
            personRef: "badge-1",
            externalId: "ext-1",
          },
        ],
      },
      DEVICE_A,
    );
    expect(r.duplicates).toBe(1);
    expect(prisma.workforceAttendancePunch.create).not.toHaveBeenCalled();
  });

  it("UNMAPPED punch does not create timesheet entry on rebuild", async () => {
    prisma.workforceAttendancePunch.findMany.mockResolvedValue([]);
    const summary = await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-17");
    expect(summary.cellsUpserted).toBe(0);
    expect(prisma.workforceTimesheetEntry.upsert).not.toHaveBeenCalled();
  });

  it("pairs night IN 20:00 OUT 08:00 onto IN date hours", async () => {
    const inAt = new Date("2026-09-16T16:00:00.000Z"); // 20:00 Baku UTC+4
    const outAt = new Date("2026-09-17T04:00:00.000Z"); // 08:00 Baku next day
    prisma.workforceAttendancePunch.findMany.mockResolvedValue([
      {
        id: "p-in",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.IN,
        occurredAt: inAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
      },
      {
        id: "p-out",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.OUT,
        occurredAt: outAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
      },
    ]);
    prisma.workforceAttendancePunch.update.mockResolvedValue({});
    prisma.workforceTimesheet.findUnique.mockResolvedValue({
      id: TS,
      organizationId: ORG_A,
      year: 2026,
      month: 9,
      status: WorkforceTimesheetStatus.DRAFT,
    });
    prisma.workforceTimesheetEntry.findUnique.mockResolvedValue(null);
    prisma.workforceTimesheetEntry.upsert.mockResolvedValue({});
    prisma.workforceShiftAssignment.findFirst.mockResolvedValue({
      placeId: PLACE_A,
      cycle: {
        cycleAnchor: new Date("2026-09-01T00:00:00.000Z"),
        slots: [
          {
            slotIndex: 0,
            shiftTypeId: "night",
            shiftType: { isNight: true, defaultHours: 12 },
          },
        ],
      },
    });

    const summary = await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-17");
    expect(summary.pairsWritten).toBe(1);
    expect(summary.cellsUpserted).toBe(1);
    const upsert = prisma.workforceTimesheetEntry.upsert.mock.calls[0][0];
    expect(upsert.create.source).toBe("faceid");
    expect(upsert.create.workDate.toISOString().slice(0, 10)).toBe("2026-09-16");
    expect(Number(upsert.create.hours)).toBe(12);
  });

  it("does not overwrite APPROVED cell after punch rebuild", async () => {
    const inAt = new Date("2026-09-16T05:00:00.000Z");
    const outAt = new Date("2026-09-16T13:00:00.000Z");
    prisma.workforceAttendancePunch.findMany.mockResolvedValue([
      {
        id: "p-in",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.IN,
        occurredAt: inAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
      },
      {
        id: "p-out",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.OUT,
        occurredAt: outAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
      },
    ]);
    prisma.workforceAttendancePunch.update.mockResolvedValue({});
    prisma.workforceTimesheet.findUnique.mockResolvedValue({
      id: TS,
      status: WorkforceTimesheetStatus.DRAFT,
    });
    prisma.workforceTimesheetEntry.findUnique.mockResolvedValue({
      id: "cell",
      status: WorkforceTimesheetEntryStatus.APPROVED,
      lockedFromAbsence: false,
    });

    const summary = await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-16");
    expect(summary.cellsSkippedApproved).toBe(1);
    expect(prisma.workforceTimesheetEntry.upsert).not.toHaveBeenCalled();
  });

  it("preserves absence lock", async () => {
    const inAt = new Date("2026-09-16T05:00:00.000Z");
    const outAt = new Date("2026-09-16T13:00:00.000Z");
    prisma.workforceAttendancePunch.findMany.mockResolvedValue([
      {
        id: "p-in",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.IN,
        occurredAt: inAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
      },
      {
        id: "p-out",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.OUT,
        occurredAt: outAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
      },
    ]);
    prisma.workforceAttendancePunch.update.mockResolvedValue({});
    prisma.workforceTimesheet.findUnique.mockResolvedValue({
      id: TS,
      status: WorkforceTimesheetStatus.DRAFT,
    });
    prisma.workforceTimesheetEntry.findUnique.mockResolvedValue({
      id: "cell",
      status: WorkforceTimesheetEntryStatus.DRAFT,
      lockedFromAbsence: true,
    });

    const summary = await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-16");
    expect(summary.cellsSkippedAbsence).toBe(1);
    expect(prisma.workforceTimesheetEntry.upsert).not.toHaveBeenCalled();
  });

  it("rebuild is idempotent (second run still one upsert path)", async () => {
    const inAt = new Date("2026-09-16T05:00:00.000Z");
    const outAt = new Date("2026-09-16T13:00:00.000Z");
    const punches = [
      {
        id: "p-in",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.IN,
        occurredAt: inAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
      },
      {
        id: "p-out",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.OUT,
        occurredAt: outAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
      },
    ];
    prisma.workforceAttendancePunch.findMany.mockResolvedValue(punches);
    prisma.workforceAttendancePunch.update.mockResolvedValue({});
    prisma.workforceTimesheet.findUnique.mockResolvedValue({
      id: TS,
      status: WorkforceTimesheetStatus.DRAFT,
    });
    prisma.workforceTimesheetEntry.findUnique.mockResolvedValue(null);
    prisma.workforceTimesheetEntry.upsert.mockResolvedValue({});

    await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-16");
    await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-16");
    expect(prisma.workforceTimesheetEntry.upsert).toHaveBeenCalledTimes(2);
    expect(
      prisma.workforceTimesheetEntry.upsert.mock.calls.every(
        (c: any[]) => c[0].create.source === "faceid",
      ),
    ).toBe(true);
  });

  it("pairs IN/OUT only at the same place", async () => {
    const inAt = new Date("2026-09-16T05:00:00.000Z");
    const outAt = new Date("2026-09-16T13:00:00.000Z");
    prisma.workforceAttendancePunch.findMany.mockResolvedValue([
      {
        id: "p-in",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.IN,
        occurredAt: inAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
      },
      {
        id: "p-out-other",
        organizationId: ORG_A,
        placeId: PLACE_B,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.OUT,
        occurredAt: outAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
      },
    ]);
    prisma.workforceAttendancePunch.update.mockResolvedValue({});
    prisma.workforceAttendancePunch.findUnique.mockResolvedValue({
      id: "p-in",
      status: WorkforceAttendancePunchStatus.OPEN,
    });

    const summary = await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-16");
    expect(summary.pairsWritten).toBe(0);
    expect(summary.openLeft).toBe(1);
    expect(prisma.workforceTimesheetEntry.upsert).not.toHaveBeenCalled();
  });

  it("upsertIdentity rejects employment from other org", async () => {
    prisma.workforceEmployment.findFirst.mockResolvedValue(null);
    await expect(
      svc.upsertIdentity(ORG_A, ACTOR, {
        personRef: "x",
        employmentId: EMP_B,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("createDevice rejects place from other org", async () => {
    prisma.workforcePlace.findFirst.mockResolvedValue(null);
    await expect(
      svc.createDevice(ORG_A, ACTOR, {
        placeId: PLACE_B,
        name: "Tablet",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
