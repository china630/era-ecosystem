import { createHash } from "crypto";
import {
  WorkforceAttendanceDirection,
  WorkforceAttendancePunchStatus,
  WorkforceAttendanceReviewStatus,
  WorkforceTimesheetEntryStatus,
  WorkforceTimesheetStatus,
} from "@era365/database";
import { WorkforceAttendanceService } from "./workforce-attendance.service";
import {
  haversineMeters,
  isOutsideShiftWindow,
} from "./attendance-geofence.util";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLACE_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PLACE_B = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const EMP_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const DEVICE_A = "11111111-1111-4111-8111-111111111111";
const ACTOR = "33333333-3333-4333-8333-333333333333";
const TS = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function sha256Hex(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

describe("attendance-geofence.util", () => {
  it("haversine is ~0 for same point", () => {
    expect(haversineMeters(40.4, 49.8, 40.4, 49.8)).toBeLessThan(1);
  });

  it("day window with grace", () => {
    expect(isOutsideShiftWindow(540, 540, 1080, 15)).toBe(false); // 09:00
    expect(isOutsideShiftWindow(525, 540, 1080, 15)).toBe(false); // 08:45 within grace
    expect(isOutsideShiftWindow(520, 540, 1080, 15)).toBe(true); // 08:40
  });
});

describe("WorkforceAttendanceService wave 9", () => {
  const prisma: any = {
    workforceAttendanceDevice: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    workforceAttendanceIdentity: {
      findUnique: jest.fn(),
    },
    workforceAttendancePunch: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    workforceAttendancePunchJournal: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    workforcePlace: { findFirst: jest.fn() },
    workforceEmployment: { findFirst: jest.fn() },
    workforceShiftAssignment: { findFirst: jest.fn() },
    workforceBrigadeMember: { findFirst: jest.fn() },
    workforceDayOverride: { findFirst: jest.fn() },
    workforceShiftType: { findMany: jest.fn(), findFirst: jest.fn() },
    workforceTimesheet: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    workforceTimesheetEntry: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) =>
      fn(prisma),
    ),
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const audit = { log: jest.fn() };
  const employments = { resolvePersonProfiles: jest.fn() };
  const catalog = { getCalendarDaysRange: jest.fn().mockResolvedValue({ days: [] }) };
  const fitness = { listFloorIssues: jest.fn().mockResolvedValue([]) };
  const svc = new WorkforceAttendanceService(
    prisma,
    entitlement as never,
    audit as never,
    employments as never,
    catalog as never,
    fitness as never,
  );

  const rawToken = "att_test_token_wave9_abc";
  const tokenHash = sha256Hex(rawToken);

  const geoPlace = {
    id: PLACE_A,
    organizationId: ORG_A,
    code: "SITE_A",
    latitude: 40.4093,
    longitude: 49.8671,
    radiusMeters: 100,
    allowOutside: false,
    graceMinutes: 15,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
    audit.log.mockResolvedValue(undefined);
    employments.resolvePersonProfiles.mockResolvedValue({});
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
    prisma.workforceAttendancePunch.findFirst.mockResolvedValue(null);
    prisma.workforceAttendancePunch.create.mockImplementation(
      async ({ data }: any) => ({
        id: "punch-" + (data.externalId ?? data.direction),
        ...data,
      }),
    );
    prisma.workforceAttendancePunchJournal.findMany.mockResolvedValue([]);
    prisma.workforcePlace.findFirst.mockResolvedValue(geoPlace);
    prisma.workforceShiftAssignment.findFirst.mockResolvedValue(null);
    prisma.workforceBrigadeMember.findFirst.mockResolvedValue(null);
    prisma.workforceDayOverride.findFirst.mockResolvedValue(null);
    prisma.workforceShiftType.findMany.mockResolvedValue([
      { id: "day", defaultHours: 8, isNight: false },
    ]);
  });

  async function authDevice() {
    return svc.authenticateDevice(`Bearer ${rawToken}`, undefined, undefined);
  }

  it("outside radius flags SUSPICIOUS and still stores the punch", async () => {
    const device = await authDevice();
    const r = await svc.ingestPunches(
      device,
      {
        punches: [
          {
            occurredAt: "2026-09-16T05:00:00.000Z",
            direction: "IN",
            personRef: "badge-1",
            externalId: "geo-out",
            latitude: 40.5,
            longitude: 49.9,
          },
        ],
      },
      DEVICE_A,
    );
    expect(r.accepted).toBe(1);
    expect(prisma.workforceAttendancePunch.create).toHaveBeenCalled();
    const data = prisma.workforceAttendancePunch.create.mock.calls[0][0].data;
    expect(data.reviewStatus).toBe(WorkforceAttendanceReviewStatus.SUSPICIOUS);
    expect(data.reviewReasons).toContain("OUTSIDE_RADIUS");
  });

  it("SUSPICIOUS punch is skipped by rebuild (no DRAFT cell)", async () => {
    prisma.workforceAttendancePunch.findMany.mockResolvedValue([]);
    const summary = await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-16");
    expect(summary.cellsUpserted).toBe(0);
    expect(prisma.workforceAttendancePunch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reviewStatus: {
            in: [
              WorkforceAttendanceReviewStatus.CLEAR,
              WorkforceAttendanceReviewStatus.ACCEPTED,
            ],
          },
        }),
      }),
    );
  });

  it("ACCEPT then rebuild writes DRAFT without mutating raw occurredAt", async () => {
    const rawAt = new Date("2026-09-16T05:00:00.000Z");
    prisma.workforceAttendancePunch.findFirst.mockResolvedValue({
      id: "p-sus",
      organizationId: ORG_A,
      reviewStatus: WorkforceAttendanceReviewStatus.SUSPICIOUS,
      reviewReasons: ["OUTSIDE_RADIUS"],
      occurredAt: rawAt,
      placeId: PLACE_A,
      employmentId: EMP_A,
      direction: WorkforceAttendanceDirection.IN,
    });
    prisma.workforceAttendancePunchJournal.create.mockResolvedValue({});
    prisma.workforceAttendancePunch.update.mockResolvedValue({});

    await svc.acceptPunch(ORG_A, "p-sus", ACTOR, {
      reason: "verified on site",
      occurredAt: "2026-09-16T05:15:00.000Z",
    });

    expect(prisma.workforceAttendancePunch.update).toHaveBeenCalledWith({
      where: { id: "p-sus" },
      data: { reviewStatus: WorkforceAttendanceReviewStatus.ACCEPTED },
    });
    expect(prisma.workforceAttendancePunchJournal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: "verified on site",
          afterJson: { occurredAt: "2026-09-16T05:15:00.000Z" },
        }),
      }),
    );

    const inAt = rawAt;
    const outAt = new Date("2026-09-16T13:00:00.000Z");
    prisma.workforceAttendancePunch.findMany.mockResolvedValue([
      {
        id: "p-sus",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.IN,
        occurredAt: inAt,
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.ACCEPTED,
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
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
      },
    ]);
    prisma.workforceAttendancePunchJournal.findMany.mockResolvedValue([
      {
        punchId: "p-sus",
        action: "ACCEPT",
        afterJson: { occurredAt: "2026-09-16T05:15:00.000Z" },
        createdAt: new Date(),
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

    const summary = await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-16");
    expect(summary.cellsUpserted).toBeGreaterThanOrEqual(1);
    expect(prisma.workforceTimesheetEntry.upsert).toHaveBeenCalled();
  });

  it("inside geofence and no shift window stays CLEAR", async () => {
    const device = await authDevice();
    await svc.ingestPunches(
      device,
      {
        punches: [
          {
            occurredAt: "2026-09-16T05:00:00.000Z",
            direction: "IN",
            personRef: "badge-1",
            externalId: "geo-in",
            latitude: 40.4093,
            longitude: 49.8671,
          },
        ],
      },
      DEVICE_A,
    );
    const data = prisma.workforceAttendancePunch.create.mock.calls[0][0].data;
    expect(data.reviewStatus).toBe(WorkforceAttendanceReviewStatus.CLEAR);
    expect(data.reviewReasons).toEqual([]);
  });

  it("outside shift window flags OUTSIDE_WINDOW and still stores punch", async () => {
    prisma.workforcePlace.findFirst.mockResolvedValue({
      ...geoPlace,
      radiusMeters: null,
      latitude: null,
      longitude: null,
    });
    prisma.workforceShiftAssignment.findFirst.mockResolvedValue({
      placeId: PLACE_A,
      cycle: {
        cycleAnchor: new Date("2026-09-15T00:00:00.000Z"),
        slots: [
          {
            slotIndex: 0,
            shiftTypeId: "day",
            shiftType: { startMinute: 9 * 60, endMinute: 18 * 60 },
          },
        ],
      },
    });
    // 05:00 UTC = 09:00 Baku — wait, 05:00 UTC = 09:00 Baku. Use 02:00 UTC = 06:00 Baku (before 09:00)
    const device = await authDevice();
    await svc.ingestPunches(
      device,
      {
        punches: [
          {
            occurredAt: "2026-09-16T02:00:00.000Z",
            direction: "IN",
            personRef: "badge-1",
            externalId: "win-out",
          },
        ],
      },
      DEVICE_A,
    );
    const data = prisma.workforceAttendancePunch.create.mock.calls[0][0].data;
    expect(data.reviewStatus).toBe(WorkforceAttendanceReviewStatus.SUSPICIOUS);
    expect(data.reviewReasons).toContain("OUTSIDE_WINDOW");
  });

  it("second open place flags MULTI_PLACE", async () => {
    prisma.workforceAttendancePunch.findFirst.mockResolvedValue({
      id: "open-elsewhere",
      placeId: PLACE_B,
      status: WorkforceAttendancePunchStatus.OPEN,
      direction: WorkforceAttendanceDirection.IN,
    });
    const device = await authDevice();
    await svc.ingestPunches(
      device,
      {
        punches: [
          {
            occurredAt: "2026-09-16T05:00:00.000Z",
            direction: "IN",
            personRef: "badge-1",
            externalId: "multi",
          },
        ],
      },
      DEVICE_A,
    );
    const data = prisma.workforceAttendancePunch.create.mock.calls[0][0].data;
    expect(data.reviewStatus).toBe(WorkforceAttendanceReviewStatus.SUSPICIOUS);
    expect(data.reviewReasons).toContain("MULTI_PLACE");
  });

  it("does not overwrite APPROVED cell after accept rebuild", async () => {
    prisma.workforceAttendancePunch.findMany.mockResolvedValue([
      {
        id: "p-in",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.IN,
        occurredAt: new Date("2026-09-16T05:00:00.000Z"),
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.ACCEPTED,
      },
      {
        id: "p-out",
        organizationId: ORG_A,
        placeId: PLACE_A,
        employmentId: EMP_A,
        direction: WorkforceAttendanceDirection.OUT,
        occurredAt: new Date("2026-09-16T13:00:00.000Z"),
        status: WorkforceAttendancePunchStatus.MAPPED,
        placeMismatch: false,
        pairId: null,
        reviewStatus: WorkforceAttendanceReviewStatus.CLEAR,
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
    prisma.workforceTimesheetEntry.findUnique.mockResolvedValue({
      id: "cell-1",
      status: WorkforceTimesheetEntryStatus.APPROVED,
      lockedFromAbsence: false,
    });
    const summary = await svc.rebuild(ORG_A, ACTOR, "2026-09-16", "2026-09-16");
    expect(prisma.workforceTimesheetEntry.upsert).not.toHaveBeenCalled();
    expect(summary.cellsSkippedApproved).toBe(1);
  });
});
