import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  WORKFORCE_ATTENDANCE_TOKEN_PREFIX,
  workforceAttendancePunchBatchSchema,
  type WorkforceAttendancePunchBatch,
  type WorkforceAttendancePunchItem,
} from "@era/contracts";
import {
  Prisma,
  WorkforceAttendanceDeviceStatus,
  WorkforceAttendanceDirection,
  WorkforceAttendanceJournalAction,
  WorkforceAttendancePunchStatus,
  WorkforceAttendanceReviewStatus,
  WorkforceEmploymentStatus,
  WorkforceTimesheetEntryStatus,
  WorkforceTimesheetEntryType,
  WorkforceTimesheetStatus,
} from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import {
  applyDayOverride,
  bakuYmd,
  cycleSlotIndex,
  isoDayUtc,
  resolvedFromCycleSlot,
  utcFromYmd,
  type RosterTapeSlot,
} from "./roster-cycle.util";
import { csvFromWorkforceImportBody } from "./workforce-xlsx";
import {
  bakuMinuteOfDay,
  haversineMeters,
  isOutsideShiftWindow,
} from "./attendance-geofence.util";
import { todayBakuYmd } from "@era/satellite-kit/time";
import { WorkforceEmploymentsService } from "./workforce-employments.service";
import { CatalogGatewayService } from "../catalog/catalog-gateway.service";
import { WorkforceFitnessService } from "./workforce-fitness.service";
import {
  classifyMinuteBuckets,
  calendarKindFromDay,
  type MinuteBuckets,
  type TimeInterval,
} from "./attendance-minute-buckets.util";

const REBUILD_EMPLOYMENT_CHUNK = 240;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function parseDateOnly(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

function roundHours(h: number): Prisma.Decimal {
  return new Prisma.Decimal(Math.round(h * 100) / 100);
}

export type AttendanceDeviceAuth = {
  id: string;
  organizationId: string;
  placeId: string;
  requireHmac: boolean;
  rawToken: string;
};

@Injectable()
export class WorkforceAttendanceService {
  private readonly logger = new Logger(WorkforceAttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly audit: WorkforceAuditService,
    private readonly employments: WorkforceEmploymentsService,
    private readonly catalog: CatalogGatewayService,
    private readonly fitness: WorkforceFitnessService,
  ) {}

  // ── Device auth (public ingest) ──────────────────────────────────────────

  async authenticateDevice(
    authorization: string | undefined,
    rawBody: string | undefined,
    signatureHeader: string | undefined,
  ): Promise<AttendanceDeviceAuth> {
    const raw = authorization?.trim() ?? "";
    const m = /^Bearer\s+(.+)$/i.exec(raw);
    if (!m) {
      throw new UnauthorizedException("Missing Bearer token");
    }
    const token = m[1]!.trim();
    if (!token.startsWith(WORKFORCE_ATTENDANCE_TOKEN_PREFIX)) {
      throw new UnauthorizedException("Invalid attendance token");
    }
    const tokenHash = sha256Hex(token);
    const device = await this.prisma.workforceAttendanceDevice.findFirst({
      where: { tokenHash, status: WorkforceAttendanceDeviceStatus.ACTIVE },
    });
    if (!device) {
      throw new UnauthorizedException("Invalid attendance token");
    }
    const requireHmac = Boolean(device.hmacSecretHash);
    if (requireHmac) {
      const sig = (signatureHeader ?? "").trim();
      const expectedHex = createHmac("sha256", token)
        .update(rawBody ?? "", "utf8")
        .digest("hex");
      const provided = sig.toLowerCase().startsWith("sha256=")
        ? sig.slice("sha256=".length).trim().toLowerCase()
        : sig.toLowerCase();
      if (!provided || !safeEqualHex(provided, expectedHex)) {
        throw new UnauthorizedException("Invalid HMAC signature");
      }
    }
    return {
      id: device.id,
      organizationId: device.organizationId,
      placeId: device.placeId,
      requireHmac,
      rawToken: token,
    };
  }

  // ── Admin: devices ───────────────────────────────────────────────────────

  async listDevices(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    return this.prisma.workforceAttendanceDevice.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { place: { select: { id: true, code: true, name: true } } },
    });
  }

  async createDevice(
    organizationId: string,
    actorUserId: string,
    input: {
      placeId: string;
      name: string;
      code?: string;
      requireHmac?: boolean;
    },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const place = await this.prisma.workforcePlace.findFirst({
      where: { id: input.placeId, organizationId },
    });
    if (!place) {
      throw new BadRequestException("Place not found in organization");
    }
    const rawToken = `${WORKFORCE_ATTENDANCE_TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
    const tokenHash = sha256Hex(rawToken);
    const requireHmac = Boolean(input.requireHmac);
    const device = await this.prisma.workforceAttendanceDevice.create({
      data: {
        organizationId,
        placeId: place.id,
        name: input.name.trim(),
        code: input.code?.trim() || null,
        tokenHash,
        hmacSecretHash: requireHmac ? tokenHash : null,
        status: WorkforceAttendanceDeviceStatus.ACTIVE,
      },
      include: { place: { select: { id: true, code: true, name: true } } },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ATTENDANCE_DEVICE_CREATED",
      entityType: "WorkforceAttendanceDevice",
      entityId: device.id,
      payload: { placeId: place.id, requireHmac },
    });
    return {
      ...device,
      token: rawToken,
      hmacHint: requireHmac
        ? "Sign body with HMAC-SHA256 using the Bearer token as key; header X-Attendance-Signature: sha256=<hex>"
        : null,
    };
  }

  async revokeDevice(
    organizationId: string,
    deviceId: string,
    actorUserId: string,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const device = await this.prisma.workforceAttendanceDevice.findFirst({
      where: { id: deviceId, organizationId },
    });
    if (!device) {
      throw new BadRequestException("Device not found");
    }
    const updated = await this.prisma.workforceAttendanceDevice.update({
      where: { id: device.id },
      data: { status: WorkforceAttendanceDeviceStatus.REVOKED },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ATTENDANCE_DEVICE_REVOKED",
      entityType: "WorkforceAttendanceDevice",
      entityId: device.id,
    });
    return updated;
  }

  // ── Admin: identities ────────────────────────────────────────────────────

  async listIdentities(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    return this.prisma.workforceAttendanceIdentity.findMany({
      where: { organizationId },
      orderBy: { personRef: "asc" },
      include: {
        employment: {
          select: {
            id: true,
            globalPersonId: true,
            status: true,
            orgUnit: { select: { name: true } },
            position: { select: { name: true } },
          },
        },
      },
    });
  }

  async upsertIdentity(
    organizationId: string,
    actorUserId: string,
    input: { personRef: string; employmentId: string },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const personRef = input.personRef.trim();
    if (!personRef) {
      throw new BadRequestException("personRef required");
    }
    const emp = await this.prisma.workforceEmployment.findFirst({
      where: { id: input.employmentId, organizationId },
    });
    if (!emp) {
      throw new ForbiddenException("Employment not in organization");
    }
    const row = await this.prisma.workforceAttendanceIdentity.upsert({
      where: {
        organizationId_personRef: { organizationId, personRef },
      },
      create: {
        organizationId,
        personRef,
        employmentId: emp.id,
      },
      update: { employmentId: emp.id },
    });
    // Remap pending UNMAPPED punches for this personRef
    await this.prisma.workforceAttendancePunch.updateMany({
      where: {
        organizationId,
        personRef,
        status: WorkforceAttendancePunchStatus.UNMAPPED,
      },
      data: {
        employmentId: emp.id,
        status: WorkforceAttendancePunchStatus.MAPPED,
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ATTENDANCE_IDENTITY_UPSERTED",
      entityType: "WorkforceAttendanceIdentity",
      entityId: row.id,
      cpEmploymentId: emp.id,
      payload: { personRef },
    });
    return row;
  }

  // ── Punch queues ─────────────────────────────────────────────────────────

  async listPunches(
    organizationId: string,
    opts?: { status?: string; limit?: number },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const status =
      opts?.status &&
      Object.values(WorkforceAttendancePunchStatus).includes(
        opts.status as WorkforceAttendancePunchStatus,
      )
        ? (opts.status as WorkforceAttendancePunchStatus)
        : undefined;
    const take = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
    return this.prisma.workforceAttendancePunch.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take,
      include: {
        place: { select: { id: true, code: true, name: true } },
        device: { select: { id: true, name: true, code: true } },
      },
    });
  }

  // ── Ingest ───────────────────────────────────────────────────────────────

  parseBatch(body: unknown): WorkforceAttendancePunchBatch {
    const parsed = workforceAttendancePunchBatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid punch batch",
        issues: parsed.error.issues,
      });
    }
    return parsed.data;
  }

  async ingestPunches(
    device: AttendanceDeviceAuth,
    batch: WorkforceAttendancePunchBatch,
    /** Must be a UUID (device id for webhook; HR user for CSV). */
    actorUserId: string,
  ) {
    let accepted = 0;
    let rejected = 0;
    let duplicates = 0;
    const results: Array<{
      externalId?: string;
      status: string;
      punchId?: string;
      reason?: string;
    }> = [];

    for (const item of batch.punches) {
      try {
        const r = await this.appendPunch(device, item);
        if (r.duplicate) {
          duplicates += 1;
          results.push({
            externalId: item.externalId,
            status: "DUPLICATE",
            punchId: r.punchId,
          });
        } else {
          accepted += 1;
          results.push({
            externalId: item.externalId,
            status: r.status,
            punchId: r.punchId,
          });
        }
      } catch (err) {
        rejected += 1;
        const reason =
          err instanceof Error ? err.message : "rejected";
        results.push({
          externalId: item.externalId,
          status: "REJECTED",
          reason,
        });
      }
    }

    await this.prisma.workforceAttendanceDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    await this.audit.log({
      organizationId: device.organizationId,
      actorUserId,
      action: "ATTENDANCE_INGEST",
      entityType: "WorkforceAttendanceDevice",
      entityId: device.id,
      payload: {
        deviceId: device.id,
        n: batch.punches.length,
        accepted,
        rejected,
        duplicates,
      },
    });

    return { accepted, rejected, duplicates, results };
  }

  private async appendPunch(
    device: AttendanceDeviceAuth,
    item: WorkforceAttendancePunchItem,
  ): Promise<{ punchId: string; status: string; duplicate: boolean }> {
    let placeId = device.placeId;
    if (item.placeCode) {
      const place = await this.prisma.workforcePlace.findFirst({
        where: {
          organizationId: device.organizationId,
          code: item.placeCode,
        },
      });
      if (!place) {
        throw new ForbiddenException("placeCode not in device organization");
      }
      placeId = place.id;
    }

    const identity = await this.prisma.workforceAttendanceIdentity.findUnique({
      where: {
        organizationId_personRef: {
          organizationId: device.organizationId,
          personRef: item.personRef,
        },
      },
    });

    if (identity) {
      const emp = await this.prisma.workforceEmployment.findFirst({
        where: {
          id: identity.employmentId,
          organizationId: device.organizationId,
        },
      });
      if (!emp) {
        throw new ForbiddenException("Mapped employment is cross-org");
      }
    }

    const occurredAt = new Date(item.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException("Invalid occurredAt");
    }

    const status = identity
      ? WorkforceAttendancePunchStatus.MAPPED
      : WorkforceAttendancePunchStatus.UNMAPPED;
    const employmentId = identity?.employmentId ?? null;

    let placeMismatch = false;
    if (employmentId) {
      placeMismatch = await this.detectPlaceMismatch(
        device.organizationId,
        employmentId,
        placeId,
        occurredAt,
      );
    }

    const place = await this.prisma.workforcePlace.findFirst({
      where: { id: placeId, organizationId: device.organizationId },
    });
    if (!place) {
      throw new ForbiddenException("Place not found");
    }

    const reviewReasons: string[] = [];
    const punchLat =
      typeof item.latitude === "number" ? item.latitude : null;
    const punchLng =
      typeof item.longitude === "number" ? item.longitude : null;

    if (
      place.radiusMeters != null &&
      place.radiusMeters > 0 &&
      place.latitude != null &&
      place.longitude != null &&
      punchLat != null &&
      punchLng != null
    ) {
      const dist = haversineMeters(
        Number(place.latitude),
        Number(place.longitude),
        punchLat,
        punchLng,
      );
      if (dist > place.radiusMeters) {
        reviewReasons.push("OUTSIDE_RADIUS");
      }
    }

    if (employmentId) {
      const shiftWindow = await this.resolveShiftWindowForPunch(
        device.organizationId,
        employmentId,
        placeId,
        occurredAt,
      );
      if (shiftWindow) {
        const minute = bakuMinuteOfDay(occurredAt);
        if (
          isOutsideShiftWindow(
            minute,
            shiftWindow.startMinute,
            shiftWindow.endMinute,
            place.graceMinutes ?? 0,
          )
        ) {
          reviewReasons.push("OUTSIDE_WINDOW");
        }
      }

      if (item.direction === "IN") {
        const workYmd = bakuYmd(occurredAt);
        const dayStart = utcFromYmd(workYmd);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const openElsewhere =
          await this.prisma.workforceAttendancePunch.findFirst({
            where: {
              organizationId: device.organizationId,
              employmentId,
              status: WorkforceAttendancePunchStatus.OPEN,
              direction: WorkforceAttendanceDirection.IN,
              placeId: { not: placeId },
              occurredAt: { gte: dayStart, lt: dayEnd },
            },
          });
        if (openElsewhere) {
          reviewReasons.push("MULTI_PLACE");
        }
      }
    }

    const reviewStatus =
      reviewReasons.length > 0
        ? WorkforceAttendanceReviewStatus.SUSPICIOUS
        : WorkforceAttendanceReviewStatus.CLEAR;

    if (item.externalId) {
      const existing = await this.prisma.workforceAttendancePunch.findUnique({
        where: {
          deviceId_externalId: {
            deviceId: device.id,
            externalId: item.externalId,
          },
        },
      });
      if (existing) {
        if (existing.organizationId !== device.organizationId) {
          throw new ForbiddenException("Punch ownership mismatch");
        }
        return {
          punchId: existing.id,
          status: existing.status,
          duplicate: true,
        };
      }
    }

    try {
      const punch = await this.prisma.workforceAttendancePunch.create({
        data: {
          organizationId: device.organizationId,
          deviceId: device.id,
          placeId,
          employmentId,
          personRef: item.personRef,
          direction: item.direction as WorkforceAttendanceDirection,
          occurredAt,
          externalId: item.externalId ?? null,
          status,
          placeMismatch,
          reviewStatus,
          reviewReasons,
          latitude: punchLat != null ? punchLat : null,
          longitude: punchLng != null ? punchLng : null,
        },
      });
      return { punchId: punch.id, status: punch.status, duplicate: false };
    } catch (err) {
      if (
        typeof err === "object" &&
        err != null &&
        "code" in err &&
        (err as { code?: string }).code === "P2002" &&
        item.externalId
      ) {
        const existing = await this.prisma.workforceAttendancePunch.findUnique({
          where: {
            deviceId_externalId: {
              deviceId: device.id,
              externalId: item.externalId,
            },
          },
        });
        if (existing) {
          return {
            punchId: existing.id,
            status: existing.status,
            duplicate: true,
          };
        }
      }
      throw err;
    }
  }

  private async detectPlaceMismatch(
    organizationId: string,
    employmentId: string,
    punchPlaceId: string,
    occurredAt: Date,
  ): Promise<boolean> {
    const workYmd = bakuYmd(occurredAt);
    const workDate = utcFromYmd(workYmd);
    const assignment = await this.prisma.workforceShiftAssignment.findFirst({
      where: {
        organizationId,
        employmentId,
        effectiveFrom: { lte: workDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!assignment) return false;
    return assignment.placeId !== punchPlaceId;
  }

  // ── CSV fallback (HR) ────────────────────────────────────────────────────

  async importCsv(
    organizationId: string,
    actorUserId: string,
    deviceId: string,
    csv?: string,
    xlsxBase64?: string,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const device = await this.prisma.workforceAttendanceDevice.findFirst({
      where: { id: deviceId, organizationId },
    });
    if (!device) {
      throw new BadRequestException("Device not found");
    }
    const csvText = csvFromWorkforceImportBody({ csv, xlsxBase64 });
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      throw new BadRequestException("CSV needs header + rows");
    }
    const header = lines[0]!.toLowerCase().split(",").map((h) => h.trim());
    const idx = {
      occurredAt: header.indexOf("occurredat"),
      direction: header.indexOf("direction"),
      personRef: header.indexOf("personref"),
      externalId: header.indexOf("externalid"),
      placeCode: header.indexOf("placecode"),
    };
    if (idx.occurredAt < 0 || idx.direction < 0 || idx.personRef < 0) {
      throw new BadRequestException(
        "CSV header must include occurredAt,direction,personRef",
      );
    }
    const punches: WorkforceAttendancePunchItem[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]!.split(",").map((c) => c.trim());
      const direction = cols[idx.direction]!.toUpperCase();
      if (
        direction !== "IN" &&
        direction !== "OUT" &&
        direction !== "BREAK_START" &&
        direction !== "BREAK_END"
      ) {
        throw new BadRequestException(
          `Row ${i + 1}: direction must be IN|OUT|BREAK_START|BREAK_END`,
        );
      }
      let occurredAt = cols[idx.occurredAt]!;
      if (!occurredAt.includes("T")) {
        // date-only → start of day UTC
        occurredAt = `${occurredAt.slice(0, 10)}T00:00:00.000Z`;
      } else if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(occurredAt)) {
        occurredAt = `${occurredAt}Z`;
      }
      const item: WorkforceAttendancePunchItem = {
        occurredAt,
        direction,
        personRef: cols[idx.personRef]!,
      };
      if (idx.externalId >= 0 && cols[idx.externalId]) {
        item.externalId = cols[idx.externalId];
      }
      if (idx.placeCode >= 0 && cols[idx.placeCode]) {
        item.placeCode = cols[idx.placeCode];
      }
      punches.push(item);
    }
    const batch = this.parseBatch({ punches });
    const auth: AttendanceDeviceAuth = {
      id: device.id,
      organizationId: device.organizationId,
      placeId: device.placeId,
      requireHmac: false,
      rawToken: "",
    };
    const result = await this.ingestPunches(auth, batch, actorUserId);
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ATTENDANCE_CSV_IMPORT",
      entityType: "WorkforceAttendanceDevice",
      entityId: device.id,
      payload: { n: punches.length, ...result },
    });
    return result;
  }

  // ── Pair + rebuild DRAFT timesheet ───────────────────────────────────────

  async rebuild(
    organizationId: string,
    actorUserId: string,
    fromIso: string,
    toIso: string,
    opts?: { usePlannedIfOpen?: boolean },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const from = parseDateOnly(fromIso);
    const to = parseDateOnly(toIso);
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException("from must be <= to");
    }
    // Expand window: IN may be on from-1 for night OUT on from
    const windowStart = new Date(from.getTime() - 24 * 60 * 60 * 1000);
    const windowEnd = new Date(to.getTime() + 24 * 60 * 60 * 1000 + 86400000 - 1);

    const punches = await this.prisma.workforceAttendancePunch.findMany({
      where: {
        organizationId,
        status: {
          in: [
            WorkforceAttendancePunchStatus.MAPPED,
            WorkforceAttendancePunchStatus.OPEN,
            WorkforceAttendancePunchStatus.PAIRED,
          ],
        },
        reviewStatus: {
          in: [
            WorkforceAttendanceReviewStatus.CLEAR,
            WorkforceAttendanceReviewStatus.ACCEPTED,
          ],
        },
        employmentId: { not: null },
        occurredAt: { gte: windowStart, lte: windowEnd },
      },
      orderBy: [{ employmentId: "asc" }, { occurredAt: "asc" }],
    });

    const punchIds = punches.map((p) => p.id);
    const journals =
      punchIds.length > 0
        ? await this.prisma.workforceAttendancePunchJournal.findMany({
            where: {
              organizationId,
              punchId: { in: punchIds },
              action: WorkforceAttendanceJournalAction.ACCEPT,
            },
            orderBy: { createdAt: "desc" },
          })
        : [];
    const overlayByPunch = new Map<string, Date>();
    for (const j of journals) {
      if (overlayByPunch.has(j.punchId)) continue;
      const after = j.afterJson as { occurredAt?: string } | null;
      if (after?.occurredAt && !Number.isNaN(Date.parse(after.occurredAt))) {
        overlayByPunch.set(j.punchId, new Date(after.occurredAt));
      }
    }
    const punchesEffective = punches.map((p) => {
      const overlay = overlayByPunch.get(p.id);
      return overlay ? { ...p, occurredAt: overlay } : p;
    });

    const byEmp = new Map<string, typeof punchesEffective>();
    for (const p of punchesEffective) {
      if (!p.employmentId) continue;
      const list = byEmp.get(p.employmentId) ?? [];
      list.push(p);
      byEmp.set(p.employmentId, list);
    }

    const calendarByYmd = new Map<
      string,
      { dayType?: string; isWorking?: boolean }
    >();
    try {
      const fromYmd = fromIso.slice(0, 10);
      const toYmd = toIso.slice(0, 10);
      const cal = (await this.catalog.getCalendarDaysRange(
        "AZ",
        fromYmd,
        toYmd,
        organizationId,
      )) as {
        days?: Array<{
          date: string;
          dayType?: string;
          isWorking?: boolean;
        }>;
      };
      for (const d of cal.days ?? []) {
        calendarByYmd.set(d.date.slice(0, 10), {
          dayType: d.dayType,
          isWorking: d.isWorking,
        });
      }
    } catch (err) {
      this.logger.warn(
        `attendance rebuild calendar unavailable org=${organizationId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    let pairsWritten = 0;
    let cellsUpserted = 0;
    let cellsSkippedApproved = 0;
    let cellsSkippedAbsence = 0;
    let openLeft = 0;
    let monthsSkipped = 0;

    const empIds = [...byEmp.keys()];
    for (let i = 0; i < empIds.length; i += REBUILD_EMPLOYMENT_CHUNK) {
      const chunk = empIds.slice(i, i + REBUILD_EMPLOYMENT_CHUNK);
      for (const empId of chunk) {
        const list = byEmp.get(empId)!;
        const pairResult = await this.pairAndUpsertEmployment({
          organizationId,
          employmentId: empId,
          punches: list,
          from,
          to,
          usePlannedIfOpen: opts?.usePlannedIfOpen === true,
          calendarByYmd,
        });
        pairsWritten += pairResult.pairsWritten;
        cellsUpserted += pairResult.cellsUpserted;
        cellsSkippedApproved += pairResult.cellsSkippedApproved;
        cellsSkippedAbsence += pairResult.cellsSkippedAbsence;
        openLeft += pairResult.openLeft;
        monthsSkipped += pairResult.monthsSkipped;
      }
    }

    const summary = {
      pairsWritten,
      cellsUpserted,
      cellsSkippedApproved,
      cellsSkippedAbsence,
      openLeft,
      monthsSkipped,
      employments: empIds.length,
    };
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ATTENDANCE_REBUILD",
      entityType: "WorkforceAttendance",
      entityId: organizationId,
      payload: { from: fromIso.slice(0, 10), to: toIso.slice(0, 10), ...summary },
    });
    return summary;
  }

  private async pairAndUpsertEmployment(input: {
    organizationId: string;
    employmentId: string;
    punches: Array<{
      id: string;
      placeId: string;
      direction: WorkforceAttendanceDirection;
      occurredAt: Date;
      status: WorkforceAttendancePunchStatus;
      placeMismatch: boolean;
      pairId: string | null;
    }>;
    from: Date;
    to: Date;
    usePlannedIfOpen: boolean;
    calendarByYmd: Map<string, { dayType?: string; isWorking?: boolean }>;
  }) {
    let pairsWritten = 0;
    let cellsUpserted = 0;
    let cellsSkippedApproved = 0;
    let cellsSkippedAbsence = 0;
    let openLeft = 0;
    let monthsSkipped = 0;

    const pending = [...input.punches];
    const used = new Set<string>();

    type DayAgg = {
      presence: TimeInterval[];
      breaks: TimeInterval[];
      pairIds: string[];
      placeMismatch: boolean;
    };
    const byDay = new Map<string, DayAgg>();

    const resolveShift = async (
      workDate: Date,
      workYmd: string,
    ): Promise<{
      startMinute: number | null;
      endMinute: number | null;
      plannedBreakMinutes: number;
      plannedHours: number | null;
      assignmentPlaceId: string | null;
      wasShiftDay: boolean;
    }> => {
      let assignment = await this.prisma.workforceShiftAssignment.findFirst({
        where: {
          organizationId: input.organizationId,
          employmentId: input.employmentId,
          effectiveFrom: { lte: workDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }],
        },
        orderBy: { effectiveFrom: "desc" },
        include: {
          cycle: {
            include: {
              slots: {
                include: { shiftType: true },
                orderBy: { slotIndex: "asc" },
              },
            },
          },
        },
      });
      if (!assignment?.cycle?.slots?.length) {
        const member = await this.prisma.workforceBrigadeMember.findFirst({
          where: {
            organizationId: input.organizationId,
            employmentId: input.employmentId,
            effectiveFrom: { lte: workDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }],
          },
          orderBy: { effectiveFrom: "desc" },
        });
        if (member) {
          assignment = await this.prisma.workforceShiftAssignment.findFirst({
            where: {
              organizationId: input.organizationId,
              brigadeId: member.brigadeId,
              effectiveFrom: { lte: workDate },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }],
            },
            orderBy: { effectiveFrom: "desc" },
            include: {
              cycle: {
                include: {
                  slots: {
                    include: { shiftType: true },
                    orderBy: { slotIndex: "asc" },
                  },
                },
              },
            },
          });
        }
      }

      const ov = await this.prisma.workforceDayOverride.findFirst({
        where: {
          organizationId: input.organizationId,
          employmentId: input.employmentId,
          workDate,
        },
        include: { shiftType: true },
      });

      let startMinute: number | null = null;
      let endMinute: number | null = null;
      let plannedBreakMinutes = 0;
      let plannedHours: number | null = null;
      let assignmentPlaceId: string | null = assignment?.placeId ?? null;
      let wasShiftDay = false;

      if (assignment?.cycle?.slots?.length) {
        const slots = [...assignment.cycle.slots].sort(
          (a, b) => a.slotIndex - b.slotIndex,
        );
        const anchorYmd = bakuYmd(assignment.cycle.cycleAnchor);
        const idx = cycleSlotIndex(anchorYmd, workYmd, slots.length);
        const slot = slots[idx];
        const st = slot?.shiftType;
        if (slot?.shiftTypeId && st) {
          startMinute = st.startMinute;
          endMinute = st.endMinute;
          plannedBreakMinutes = st.breakMinutes ?? 0;
          plannedHours = Number(st.defaultHours) || null;
          wasShiftDay = true;
        } else {
          plannedHours = 0;
          wasShiftDay = false;
        }
      }

      if (ov) {
        if (ov.kind === "DAY_OFF") {
          return {
            startMinute: null,
            endMinute: null,
            plannedBreakMinutes: 0,
            plannedHours: 0,
            assignmentPlaceId: ov.placeId ?? assignmentPlaceId,
            wasShiftDay: false,
          };
        }
        // EXTRA / SWAP — window from override shift type when present
        if (ov.shiftType) {
          startMinute = ov.shiftType.startMinute;
          endMinute = ov.shiftType.endMinute;
          plannedBreakMinutes = ov.shiftType.breakMinutes ?? 0;
          plannedHours = Number(ov.shiftType.defaultHours) || plannedHours;
          wasShiftDay = true;
        } else if (ov.shiftTypeId) {
          const st = await this.prisma.workforceShiftType.findFirst({
            where: {
              id: ov.shiftTypeId,
              organizationId: input.organizationId,
            },
          });
          if (st) {
            startMinute = st.startMinute;
            endMinute = st.endMinute;
            plannedBreakMinutes = st.breakMinutes ?? 0;
            plannedHours = Number(st.defaultHours) || plannedHours;
            wasShiftDay = true;
          }
        } else if (!wasShiftDay) {
          // EXTRA without type: still a shift day for shortfall, no window
          wasShiftDay = true;
        }
        if (ov.placeId) assignmentPlaceId = ov.placeId;
      }

      return {
        startMinute,
        endMinute,
        plannedBreakMinutes,
        plannedHours,
        assignmentPlaceId,
        wasShiftDay,
      };
    };

    const upsertFaceidCell = async (
      workDate: Date,
      buckets: MinuteBuckets,
      pairId: string,
    ): Promise<"ok" | "approved" | "absence" | "month"> => {
      const year = workDate.getUTCFullYear();
      const month = workDate.getUTCMonth() + 1;
      let timesheet = await this.prisma.workforceTimesheet.findUnique({
        where: {
          organizationId_year_month: {
            organizationId: input.organizationId,
            year,
            month,
          },
        },
      });
      if (!timesheet) {
        timesheet = await this.prisma.workforceTimesheet.create({
          data: {
            organizationId: input.organizationId,
            year,
            month,
            status: WorkforceTimesheetStatus.DRAFT,
          },
        });
      }
      if (timesheet.status === WorkforceTimesheetStatus.APPROVED) {
        return "month";
      }
      const existing = await this.prisma.workforceTimesheetEntry.findUnique({
        where: {
          timesheetId_employmentId_workDate: {
            timesheetId: timesheet.id,
            employmentId: input.employmentId,
            workDate,
          },
        },
      });
      if (existing?.lockedFromAbsence) return "absence";
      if (existing?.status === WorkforceTimesheetEntryStatus.APPROVED) {
        return "approved";
      }
      const minuteFields = {
        normalMinutes: buckets.normalMinutes,
        shortfallMinutes: buckets.shortfallMinutes,
        overtimeMinutes: buckets.overtimeMinutes,
        nightMinutes: buckets.nightMinutes,
        restDayMinutes: buckets.restDayMinutes,
        holidayMinutes: buckets.holidayMinutes,
        hourlyLeaveMinutes:
          buckets.hourlyLeaveMinutes > 0
            ? buckets.hourlyLeaveMinutes
            : (existing?.hourlyLeaveMinutes ?? 0),
        breakMinutes: buckets.breakMinutes,
      };
      await this.prisma.workforceTimesheetEntry.upsert({
        where: {
          timesheetId_employmentId_workDate: {
            timesheetId: timesheet.id,
            employmentId: input.employmentId,
            workDate,
          },
        },
        create: {
          organizationId: input.organizationId,
          timesheetId: timesheet.id,
          employmentId: input.employmentId,
          workDate,
          hours: roundHours(buckets.hours),
          type: WorkforceTimesheetEntryType.WORK,
          lockedFromAbsence: false,
          source: "faceid",
          sourceRef: pairId,
          status: WorkforceTimesheetEntryStatus.DRAFT,
          ...minuteFields,
        },
        update: {
          hours: roundHours(buckets.hours),
          type: WorkforceTimesheetEntryType.WORK,
          source: "faceid",
          sourceRef: pairId,
          status: WorkforceTimesheetEntryStatus.DRAFT,
          ...minuteFields,
        },
      });
      return "ok";
    };

    const pairDirection = async (
      startDir: WorkforceAttendanceDirection,
      endDir: WorkforceAttendanceDirection,
      kind: "presence" | "break",
    ) => {
      let i = 0;
      while (i < pending.length) {
        const punch = pending[i]!;
        if (used.has(punch.id) || punch.direction !== startDir) {
          i += 1;
          continue;
        }
        const endIdx = pending.findIndex(
          (q, j) =>
            j > i &&
            !used.has(q.id) &&
            q.direction === endDir &&
            q.placeId === punch.placeId &&
            q.occurredAt.getTime() > punch.occurredAt.getTime(),
        );
        if (endIdx < 0) {
          await this.prisma.workforceAttendancePunch.update({
            where: { id: punch.id },
            data: {
              status: WorkforceAttendancePunchStatus.OPEN,
              pairId: null,
              hoursAttributed: null,
              workDate: utcFromYmd(bakuYmd(punch.occurredAt)),
            },
          });
          used.add(punch.id);
          openLeft += 1;
          i += 1;
          continue;
        }
        const end = pending[endIdx]!;
        const workYmd = bakuYmd(punch.occurredAt);
        const workDate = utcFromYmd(workYmd);
        if (
          workDate.getTime() < input.from.getTime() ||
          workDate.getTime() > input.to.getTime()
        ) {
          i += 1;
          continue;
        }

        const resolved = await resolveShift(workDate, workYmd);
        const pairId = punch.id;
        const placeMismatch =
          punch.placeMismatch ||
          (resolved.assignmentPlaceId != null &&
            resolved.assignmentPlaceId !== punch.placeId);
        const hoursAttr =
          kind === "presence"
            ? roundHours(
                (end.occurredAt.getTime() - punch.occurredAt.getTime()) /
                  (60 * 60 * 1000),
              )
            : roundHours(
                (end.occurredAt.getTime() - punch.occurredAt.getTime()) /
                  (60 * 60 * 1000),
              );

        await this.prisma.workforceAttendancePunch.update({
          where: { id: punch.id },
          data: {
            status: WorkforceAttendancePunchStatus.PAIRED,
            pairId,
            hoursAttributed: hoursAttr,
            workDate,
            placeMismatch,
          },
        });
        await this.prisma.workforceAttendancePunch.update({
          where: { id: end.id },
          data: {
            status: WorkforceAttendancePunchStatus.PAIRED,
            pairId,
            hoursAttributed: hoursAttr,
            workDate,
            placeMismatch,
          },
        });
        used.add(punch.id);
        used.add(end.id);
        pairsWritten += 1;

        // Open break alone never creates a cell; only closed presence days write.
        if (kind === "break") {
          const agg =
            byDay.get(workYmd) ??
            ({
              presence: [],
              breaks: [],
              pairIds: [],
              placeMismatch: false,
            } satisfies DayAgg);
          agg.breaks.push({ start: punch.occurredAt, end: end.occurredAt });
          agg.pairIds.push(pairId);
          agg.placeMismatch = agg.placeMismatch || placeMismatch;
          byDay.set(workYmd, agg);
          i += 1;
          continue;
        }

        const agg =
          byDay.get(workYmd) ??
          ({
            presence: [],
            breaks: [],
            pairIds: [],
            placeMismatch: false,
          } satisfies DayAgg);
        agg.presence.push({ start: punch.occurredAt, end: end.occurredAt });
        agg.pairIds.push(pairId);
        agg.placeMismatch = agg.placeMismatch || placeMismatch;
        byDay.set(workYmd, agg);
        i += 1;
      }
    };

    await pairDirection(
      WorkforceAttendanceDirection.IN,
      WorkforceAttendanceDirection.OUT,
      "presence",
    );
    await pairDirection(
      WorkforceAttendanceDirection.BREAK_START,
      WorkforceAttendanceDirection.BREAK_END,
      "break",
    );

    for (const [workYmd, agg] of byDay) {
      if (agg.presence.length === 0) {
        // Breaks without a closed IN→OUT do not write a cell
        continue;
      }
      const workDate = utcFromYmd(workYmd);
      const resolved = await resolveShift(workDate, workYmd);
      const cal = input.calendarByYmd.get(workYmd) ?? null;
      const buckets = classifyMinuteBuckets({
        presence: agg.presence,
        breaks: agg.breaks,
        workYmd,
        startMinute: resolved.startMinute,
        endMinute: resolved.endMinute,
        plannedBreakMinutes: resolved.plannedBreakMinutes,
        calendarKind: calendarKindFromDay(cal),
        wasShiftDay: resolved.wasShiftDay,
      });
      const cell = await upsertFaceidCell(
        workDate,
        buckets,
        agg.pairIds[0] ?? `day:${workYmd}`,
      );
      if (cell === "ok") cellsUpserted += 1;
      else if (cell === "approved") cellsSkippedApproved += 1;
      else if (cell === "absence") cellsSkippedAbsence += 1;
      else if (cell === "month") monthsSkipped += 1;
    }

    if (input.usePlannedIfOpen) {
      for (const punch of pending) {
        if (punch.direction !== WorkforceAttendanceDirection.IN) continue;
        const openRow = await this.prisma.workforceAttendancePunch.findUnique({
          where: { id: punch.id },
        });
        if (
          !openRow ||
          openRow.status !== WorkforceAttendancePunchStatus.OPEN
        ) {
          continue;
        }
        const workYmd = bakuYmd(punch.occurredAt);
        const workDate = utcFromYmd(workYmd);
        if (
          workDate.getTime() < input.from.getTime() ||
          workDate.getTime() > input.to.getTime()
        ) {
          continue;
        }
        const resolved = await resolveShift(workDate, workYmd);
        if (resolved.plannedHours == null || resolved.plannedHours <= 0) {
          continue;
        }
        const plannedMin = Math.round(resolved.plannedHours * 60);
        const buckets: MinuteBuckets = {
          normalMinutes: plannedMin,
          shortfallMinutes: 0,
          overtimeMinutes: 0,
          nightMinutes: 0,
          restDayMinutes: 0,
          holidayMinutes: 0,
          hourlyLeaveMinutes: 0,
          breakMinutes: 0,
          hours: resolved.plannedHours,
        };
        const cell = await upsertFaceidCell(
          workDate,
          buckets,
          `open:${punch.id}`,
        );
        if (cell === "ok") cellsUpserted += 1;
        else if (cell === "approved") cellsSkippedApproved += 1;
        else if (cell === "absence") cellsSkippedAbsence += 1;
        else if (cell === "month") monthsSkipped += 1;
      }
    }

    return {
      pairsWritten,
      cellsUpserted,
      cellsSkippedApproved,
      cellsSkippedAbsence,
      openLeft,
      monthsSkipped,
    };
  }

  private async resolveShiftWindowForPunch(
    organizationId: string,
    employmentId: string,
    _placeId: string,
    occurredAt: Date,
  ): Promise<{ startMinute: number; endMinute: number } | null> {
    const workYmd = bakuYmd(occurredAt);
    const workDate = utcFromYmd(workYmd);
    const assignment = await this.prisma.workforceShiftAssignment.findFirst({
      where: {
        organizationId,
        employmentId,
        effectiveFrom: { lte: workDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
      include: {
        cycle: {
          include: {
            slots: {
              include: { shiftType: true },
              orderBy: { slotIndex: "asc" },
            },
          },
        },
      },
    });
    if (!assignment?.cycle?.slots?.length) {
      // Brigade assignment covering this employment
      const member = await this.prisma.workforceBrigadeMember.findFirst({
        where: {
          organizationId,
          employmentId,
          effectiveFrom: { lte: workDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }],
        },
        orderBy: { effectiveFrom: "desc" },
      });
      if (!member) return null;
      const brigadeAssignment =
        await this.prisma.workforceShiftAssignment.findFirst({
          where: {
            organizationId,
            brigadeId: member.brigadeId,
            effectiveFrom: { lte: workDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }],
          },
          orderBy: { effectiveFrom: "desc" },
          include: {
            cycle: {
              include: {
                slots: {
                  include: { shiftType: true },
                  orderBy: { slotIndex: "asc" },
                },
              },
            },
          },
        });
      if (!brigadeAssignment?.cycle?.slots?.length) return null;
      return this.shiftWindowFromAssignment(brigadeAssignment, workYmd);
    }
    return this.shiftWindowFromAssignment(assignment, workYmd);
  }

  private shiftWindowFromAssignment(
    assignment: {
      cycle: {
        cycleAnchor: Date;
        slots: Array<{
          slotIndex: number;
          shiftType: { startMinute: number; endMinute: number } | null;
        }>;
      };
    },
    workYmd: string,
  ): { startMinute: number; endMinute: number } | null {
    const slots = [...assignment.cycle.slots].sort(
      (a, b) => a.slotIndex - b.slotIndex,
    );
    const idx = cycleSlotIndex(
      isoDayUtc(assignment.cycle.cycleAnchor),
      workYmd,
      slots.length,
    );
    const st = slots[idx]?.shiftType;
    if (!st) return null;
    return { startMinute: st.startMinute, endMinute: st.endMinute };
  }

  async floorBoard(
    organizationId: string,
    opts?: { date?: string; orgUnitId?: string; placeId?: string },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const dateYmd = (opts?.date?.trim() || todayBakuYmd()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
      throw new BadRequestException("date must be YYYY-MM-DD");
    }
    const workDate = utcFromYmd(dateYmd);
    const dayStart = workDate;
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const nowYmd = bakuYmd(now);
    const nowMinute = bakuMinuteOfDay(now);
    const dayIsPast = dateYmd < nowYmd;
    const dayIsToday = dateYmd === nowYmd;

    const employments = await this.prisma.workforceEmployment.findMany({
      where: {
        organizationId,
        status: WorkforceEmploymentStatus.ACTIVE,
        ...(opts?.orgUnitId ? { orgUnitId: opts.orgUnitId } : {}),
      },
      select: {
        id: true,
        globalPersonId: true,
        orgUnitId: true,
      },
    });
    const employmentIds = employments.map((e) => e.id);

    const [places, overrides, dayPunchesAll, shiftTypes] = await Promise.all([
      this.prisma.workforcePlace.findMany({
        where: { organizationId },
      }),
      employmentIds.length
        ? this.prisma.workforceDayOverride.findMany({
            where: {
              organizationId,
              workDate,
              employmentId: { in: employmentIds },
            },
            include: { shiftType: true },
          })
        : Promise.resolve([]),
      employmentIds.length
        ? this.prisma.workforceAttendancePunch.findMany({
            where: {
              organizationId,
              employmentId: { in: employmentIds },
              occurredAt: { gte: dayStart, lt: dayEnd },
              direction: {
                in: [
                  WorkforceAttendanceDirection.IN,
                  WorkforceAttendanceDirection.OUT,
                  WorkforceAttendanceDirection.BREAK_START,
                  WorkforceAttendanceDirection.BREAK_END,
                ],
              },
            },
            orderBy: { occurredAt: "asc" },
          })
        : Promise.resolve([]),
      this.prisma.workforceShiftType.findMany({
        where: { organizationId },
      }),
    ]);
    const placeById = new Map(places.map((p) => [p.id, p]));
    const shiftTypeById = new Map(shiftTypes.map((t) => [t.id, t]));
    const overrideByEmp = new Map(overrides.map((o) => [o.employmentId, o]));
    const punchesByEmp = new Map<string, typeof dayPunchesAll>();
    for (const p of dayPunchesAll) {
      if (!p.employmentId) continue;
      const list = punchesByEmp.get(p.employmentId) ?? [];
      list.push(p);
      punchesByEmp.set(p.employmentId, list);
    }

    type Card = {
      kind:
        | "ARRIVED"
        | "SHIFT_STARTED_NO_IN"
        | "NOT_ARRIVED"
        | "STILL_INSIDE"
        | "LEFT_EARLY"
        | "LATE"
        | "OPEN_BREAK"
        | "PENDING_REQUEST"
        | "FITNESS_ISSUE";
      employmentId: string;
      globalPersonId: string;
      placeId: string | null;
      punchId: string | null;
      fitnessKind?: string;
      fitnessStatus?: string;
    };
    const cards: Card[] = [];

    for (const emp of employments) {
      let assignment = await this.prisma.workforceShiftAssignment.findFirst({
        where: {
          organizationId,
          employmentId: emp.id,
          effectiveFrom: { lte: workDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }],
        },
        orderBy: { effectiveFrom: "desc" },
        include: {
          cycle: {
            include: {
              slots: {
                include: { shiftType: true },
                orderBy: { slotIndex: "asc" },
              },
            },
          },
        },
      });
      if (!assignment) {
        const member = await this.prisma.workforceBrigadeMember.findFirst({
          where: {
            organizationId,
            employmentId: emp.id,
            effectiveFrom: { lte: workDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }],
          },
          orderBy: { effectiveFrom: "desc" },
        });
        if (member) {
          assignment = await this.prisma.workforceShiftAssignment.findFirst({
            where: {
              organizationId,
              brigadeId: member.brigadeId,
              effectiveFrom: { lte: workDate },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }],
            },
            orderBy: { effectiveFrom: "desc" },
            include: {
              cycle: {
                include: {
                  slots: {
                    include: { shiftType: true },
                    orderBy: { slotIndex: "asc" },
                  },
                },
              },
            },
          });
        }
      }

      const ov = overrideByEmp.get(emp.id);
      if (!assignment && !ov) continue;

      let resolved = assignment
        ? (() => {
            const tape: RosterTapeSlot[] = (assignment.cycle?.slots ?? []).map(
              (s) => {
                if (!s.shiftTypeId || !s.shiftType) return { kind: "OFF" as const };
                return {
                  kind: "SHIFT" as const,
                  shiftTypeId: s.shiftTypeId,
                  defaultHours: Number(s.shiftType.defaultHours),
                };
              },
            );
            if (!tape.length) {
              return {
                type: "OFF" as const,
                hours: 0,
                shiftTypeId: null as string | null,
                placeId: assignment.placeId as string | null,
                assignmentId: assignment.id as string | null,
                fromOverride: false,
              };
            }
            const slot = tape[
              cycleSlotIndex(
                isoDayUtc(assignment.cycle!.cycleAnchor),
                dateYmd,
                tape.length,
              )
            ]!;
            return resolvedFromCycleSlot(slot, assignment.placeId, assignment.id);
          })()
        : {
            type: "OFF" as const,
            hours: 0,
            shiftTypeId: null as string | null,
            placeId: null as string | null,
            assignmentId: null as string | null,
            fromOverride: false,
          };

      if (ov) {
        resolved = applyDayOverride(resolved, {
          kind: ov.kind as "DAY_OFF" | "EXTRA" | "SWAP",
          placeId: ov.placeId,
          shiftTypeId: ov.shiftTypeId,
          defaultHours:
            ov.shiftType != null
              ? Number(ov.shiftType.defaultHours)
              : ov.shiftTypeId
                ? Number(
                    shiftTypeById.get(ov.shiftTypeId)?.defaultHours ?? 8,
                  )
                : null,
        });
      }

      // DAY_OFF (cycle or override) does not appear on the floor board
      if (resolved.type === "OFF") continue;
      const placeId = resolved.placeId;
      if (opts?.placeId && placeId !== opts.placeId) continue;

      const stId = resolved.shiftTypeId;
      const st =
        (stId ? shiftTypeById.get(stId) : null) ??
        (stId && ov?.shiftType?.id === stId ? ov.shiftType : null) ??
        (assignment?.cycle?.slots ?? []).find((s) => s.shiftTypeId === stId)
          ?.shiftType ??
        null;
      if (!st) continue;

      const place = placeId ? placeById.get(placeId) : undefined;
      const grace = place?.graceMinutes ?? 0;
      const startWithGrace = Math.max(0, st.startMinute - grace);
      const endWithGrace = Math.min(1440, st.endMinute + grace);

      const dayPunches = punchesByEmp.get(emp.id) ?? [];
      const firstIn = dayPunches.find(
        (p) => p.direction === WorkforceAttendanceDirection.IN,
      );
      const lastOut = [...dayPunches]
        .reverse()
        .find((p) => p.direction === WorkforceAttendanceDirection.OUT);
      const openIn = dayPunches.find(
        (p) =>
          p.direction === WorkforceAttendanceDirection.IN &&
          p.status === WorkforceAttendancePunchStatus.OPEN,
      );
      const openBreak = dayPunches.find(
        (p) =>
          p.direction === WorkforceAttendanceDirection.BREAK_START &&
          p.status === WorkforceAttendancePunchStatus.OPEN,
      );

      const shiftStarted =
        dayIsPast ||
        (dayIsToday &&
          (st.startMinute <= st.endMinute
            ? nowMinute >= startWithGrace
            : nowMinute >= startWithGrace || nowMinute <= endWithGrace));

      if (openBreak) {
        cards.push({
          kind: "OPEN_BREAK",
          employmentId: emp.id,
          globalPersonId: emp.globalPersonId,
          placeId,
          punchId: openBreak.id,
        });
      }

      if (firstIn && lastOut && lastOut.occurredAt > firstIn.occurredAt) {
        const outMinute = bakuMinuteOfDay(lastOut.occurredAt);
        const leftEarly =
          st.startMinute < st.endMinute
            ? outMinute < st.endMinute - grace
            : false;
        cards.push({
          kind: leftEarly ? "LEFT_EARLY" : "ARRIVED",
          employmentId: emp.id,
          globalPersonId: emp.globalPersonId,
          placeId,
          punchId: leftEarly ? lastOut.id : firstIn.id,
        });
        continue;
      }

      if (openIn || (firstIn && !lastOut)) {
        cards.push({
          kind: "STILL_INSIDE",
          employmentId: emp.id,
          globalPersonId: emp.globalPersonId,
          placeId,
          punchId: (openIn ?? firstIn)!.id,
        });
        continue;
      }

      if (!firstIn && shiftStarted) {
        const latePast =
          dayIsPast ||
          (dayIsToday &&
            (st.startMinute < st.endMinute
              ? nowMinute > st.startMinute + grace
              : false));
        cards.push({
          kind: latePast ? "LATE" : "SHIFT_STARTED_NO_IN",
          employmentId: emp.id,
          globalPersonId: emp.globalPersonId,
          placeId,
          punchId: null,
        });
        continue;
      }

      if (!firstIn && dayIsToday && !shiftStarted) {
        cards.push({
          kind: "NOT_ARRIVED",
          employmentId: emp.id,
          globalPersonId: emp.globalPersonId,
          placeId,
          punchId: null,
        });
      }
    }

    // Wave 12: pending self-requests (absence / hourly / advance)
    const [pendingAbs, pendingHourly, pendingAdv] = await Promise.all([
      this.prisma.workforceAbsence.findMany({
        where: {
          organizationId,
          status: "SUBMITTED",
          employmentId: { in: employmentIds },
        },
        select: { employmentId: true },
      }),
      this.prisma.workforceHourlyLeaveRequest.findMany({
        where: {
          organizationId,
          status: "SUBMITTED",
          employmentId: { in: employmentIds },
        },
        select: { employmentId: true },
      }),
      this.prisma.workforceAdvanceRequest.findMany({
        where: {
          organizationId,
          status: "SUBMITTED",
          employmentId: { in: employmentIds },
        },
        select: { employmentId: true },
      }),
    ]);
    const pendingEmpIds = new Set([
      ...pendingAbs.map((r) => r.employmentId),
      ...pendingHourly.map((r) => r.employmentId),
      ...pendingAdv.map((r) => r.employmentId),
    ]);
    for (const emp of employments) {
      if (!pendingEmpIds.has(emp.id)) continue;
      cards.push({
        kind: "PENDING_REQUEST",
        employmentId: emp.id,
        globalPersonId: emp.globalPersonId,
        placeId: null,
        punchId: null,
      });
    }

    const fitnessIssues = await this.fitness.listFloorIssues(
      organizationId,
      employmentIds,
    );
    const empById = new Map(employments.map((e) => [e.id, e]));
    for (const issue of fitnessIssues) {
      const emp = empById.get(issue.employmentId);
      if (!emp) continue;
      cards.push({
        kind: "FITNESS_ISSUE",
        employmentId: emp.id,
        globalPersonId: emp.globalPersonId,
        placeId: null,
        punchId: null,
        fitnessKind: issue.kind,
        fitnessStatus: issue.status,
      });
    }

    const suspiciousQueue =
      await this.prisma.workforceAttendancePunch.findMany({
        where: {
          organizationId,
          reviewStatus: WorkforceAttendanceReviewStatus.SUSPICIOUS,
          occurredAt: { gte: dayStart, lt: dayEnd },
          ...(opts?.placeId ? { placeId: opts.placeId } : {}),
        },
        orderBy: { occurredAt: "desc" },
        take: 100,
      });

    const groups = {
      ARRIVED: cards.filter((c) => c.kind === "ARRIVED"),
      SHIFT_STARTED_NO_IN: cards.filter(
        (c) => c.kind === "SHIFT_STARTED_NO_IN",
      ),
      NOT_ARRIVED: cards.filter((c) => c.kind === "NOT_ARRIVED"),
      STILL_INSIDE: cards.filter((c) => c.kind === "STILL_INSIDE"),
      LEFT_EARLY: cards.filter((c) => c.kind === "LEFT_EARLY"),
      LATE: cards.filter((c) => c.kind === "LATE"),
      OPEN_BREAK: cards.filter((c) => c.kind === "OPEN_BREAK"),
      PENDING_REQUEST: cards.filter((c) => c.kind === "PENDING_REQUEST"),
      FITNESS_ISSUE: cards.filter((c) => c.kind === "FITNESS_ISSUE"),
    };

    const personIds = [
      ...new Set(cards.map((c) => c.globalPersonId).filter(Boolean)),
    ];
    const persons =
      personIds.length > 0
        ? await this.employments.resolvePersonProfiles(
            organizationId,
            personIds,
          )
        : {};

    return {
      date: dateYmd,
      groups,
      persons,
      suspiciousCount: suspiciousQueue.length,
      suspicious: suspiciousQueue.map((p) => ({
        id: p.id,
        employmentId: p.employmentId,
        placeId: p.placeId,
        personRef: p.personRef,
        direction: p.direction,
        occurredAt: p.occurredAt.toISOString(),
        reviewReasons: p.reviewReasons,
        allowOutside:
          placeById.get(p.placeId)?.allowOutside === true &&
          p.reviewReasons.includes("OUTSIDE_RADIUS"),
      })),
    };
  }

  async getPunchDetail(organizationId: string, punchId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const punch = await this.prisma.workforceAttendancePunch.findFirst({
      where: { id: punchId, organizationId },
      include: { place: true },
    });
    if (!punch) throw new NotFoundException("Punch not found");
    const journal = await this.prisma.workforceAttendancePunchJournal.findMany(
      {
        where: { organizationId, punchId },
        orderBy: { createdAt: "asc" },
      },
    );
    return { punch, journal };
  }

  async acceptPunch(
    organizationId: string,
    punchId: string,
    actorUserId: string,
    dto: { reason: string; occurredAt?: string },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const reason = dto.reason?.trim() ?? "";
    if (reason.length < 1) {
      throw new BadRequestException("reason is required");
    }
    const punch = await this.prisma.workforceAttendancePunch.findFirst({
      where: { id: punchId, organizationId },
    });
    if (!punch) throw new NotFoundException("Punch not found");
    if (punch.reviewStatus !== WorkforceAttendanceReviewStatus.SUSPICIOUS) {
      throw new BadRequestException("Only SUSPICIOUS punches can be accepted");
    }
    let afterJson: { occurredAt?: string } | undefined;
    if (dto.occurredAt?.trim()) {
      if (Number.isNaN(Date.parse(dto.occurredAt))) {
        throw new BadRequestException("occurredAt must be parseable ISO");
      }
      afterJson = { occurredAt: dto.occurredAt.trim() };
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.workforceAttendancePunchJournal.create({
        data: {
          organizationId,
          punchId,
          actorUserId,
          action: WorkforceAttendanceJournalAction.ACCEPT,
          reason: reason.slice(0, 512),
          beforeJson: {
            reviewStatus: punch.reviewStatus,
            reviewReasons: punch.reviewReasons,
            occurredAt: punch.occurredAt.toISOString(),
          },
          afterJson: afterJson ?? {
            reviewStatus: WorkforceAttendanceReviewStatus.ACCEPTED,
          },
        },
      });
      await tx.workforceAttendancePunch.update({
        where: { id: punchId },
        data: {
          reviewStatus: WorkforceAttendanceReviewStatus.ACCEPTED,
        },
      });
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ATTENDANCE_PUNCH_ACCEPT",
      entityType: "WorkforceAttendancePunch",
      entityId: punchId,
      payload: { reason, occurredAtOverlay: afterJson?.occurredAt ?? null },
    });
    return this.getPunchDetail(organizationId, punchId);
  }
}
