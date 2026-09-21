import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
  WorkforceAttendancePunchStatus,
  WorkforceTimesheetEntryStatus,
  WorkforceTimesheetEntryType,
  WorkforceTimesheetStatus,
} from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { bakuYmd, cycleSlotIndex, utcFromYmd } from "./roster-cycle.util";
import { csvFromWorkforceImportBody } from "./workforce-xlsx";

const REBUILD_EMPLOYMENT_CHUNK = 240;
const DEFAULT_HOUR_CAP = 24;

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

function hoursBetween(inAt: Date, outAt: Date, cap: number): number {
  const ms = outAt.getTime() - inAt.getTime();
  if (ms <= 0) return 0;
  const h = ms / (60 * 60 * 1000);
  return Math.min(h, cap);
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly audit: WorkforceAuditService,
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
      if (direction !== "IN" && direction !== "OUT") {
        throw new BadRequestException(`Row ${i + 1}: direction must be IN|OUT`);
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
        employmentId: { not: null },
        occurredAt: { gte: windowStart, lte: windowEnd },
      },
      orderBy: [{ employmentId: "asc" }, { occurredAt: "asc" }],
    });

    const byEmp = new Map<string, typeof punches>();
    for (const p of punches) {
      if (!p.employmentId) continue;
      const list = byEmp.get(p.employmentId) ?? [];
      list.push(p);
      byEmp.set(p.employmentId, list);
    }

    const shiftTypes = await this.prisma.workforceShiftType.findMany({
      where: { organizationId },
    });
    const shiftCapById = new Map(
      shiftTypes.map((s) => [
        s.id,
        Number(s.defaultHours) > 0 ? Number(s.defaultHours) : DEFAULT_HOUR_CAP,
      ]),
    );
    const nightTypeIds = new Set(
      shiftTypes.filter((s) => s.isNight).map((s) => s.id),
    );

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
          shiftCapById,
          nightTypeIds,
          usePlannedIfOpen: opts?.usePlannedIfOpen === true,
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
    shiftCapById: Map<string, number>;
    nightTypeIds: Set<string>;
    usePlannedIfOpen: boolean;
  }) {
    let pairsWritten = 0;
    let cellsUpserted = 0;
    let cellsSkippedApproved = 0;
    let cellsSkippedAbsence = 0;
    let openLeft = 0;
    let monthsSkipped = 0;

    const pending = [...input.punches];
    const used = new Set<string>();

    const resolveCapAndNight = async (
      workDate: Date,
      workYmd: string,
    ): Promise<{
      cap: number;
      isNight: boolean;
      assignmentPlaceId: string | null;
      plannedHours: number | null;
    }> => {
      const assignment = await this.prisma.workforceShiftAssignment.findFirst({
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
              slots: { include: { shiftType: true }, orderBy: { slotIndex: "asc" } },
            },
          },
        },
      });
      if (!assignment?.cycle?.slots?.length) {
        return {
          cap: DEFAULT_HOUR_CAP,
          isNight: false,
          assignmentPlaceId: assignment?.placeId ?? null,
          plannedHours: null,
        };
      }
      const slots = [...assignment.cycle.slots].sort(
        (a, b) => a.slotIndex - b.slotIndex,
      );
      const anchorYmd = bakuYmd(assignment.cycle.cycleAnchor);
      const idx = cycleSlotIndex(anchorYmd, workYmd, slots.length);
      const slot = slots[idx];
      const shiftTypeId = slot?.shiftTypeId ?? null;
      const isNight = shiftTypeId
        ? input.nightTypeIds.has(shiftTypeId)
        : false;
      const cap = shiftTypeId
        ? (input.shiftCapById.get(shiftTypeId) ?? DEFAULT_HOUR_CAP)
        : DEFAULT_HOUR_CAP;
      const plannedHours =
        slot?.shiftTypeId && slot.shiftType
          ? Number(slot.shiftType.defaultHours) || null
          : null;
      return {
        cap,
        isNight,
        assignmentPlaceId: assignment.placeId,
        plannedHours: slot?.shiftTypeId ? plannedHours : 0,
      };
    };

    const upsertFaceidCell = async (
      workDate: Date,
      hours: number,
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
          hours: roundHours(hours),
          type: WorkforceTimesheetEntryType.WORK,
          lockedFromAbsence: false,
          source: "faceid",
          sourceRef: pairId,
          status: WorkforceTimesheetEntryStatus.DRAFT,
        },
        update: {
          hours: roundHours(hours),
          type: WorkforceTimesheetEntryType.WORK,
          source: "faceid",
          sourceRef: pairId,
          status: WorkforceTimesheetEntryStatus.DRAFT,
        },
      });
      return "ok";
    };

    let i = 0;
    while (i < pending.length) {
      const punch = pending[i]!;
      if (
        used.has(punch.id) ||
        punch.direction !== WorkforceAttendanceDirection.IN
      ) {
        i += 1;
        continue;
      }
      const outIdx = pending.findIndex(
        (q, j) =>
          j > i &&
          !used.has(q.id) &&
          q.direction === WorkforceAttendanceDirection.OUT &&
          q.placeId === punch.placeId &&
          q.occurredAt.getTime() > punch.occurredAt.getTime(),
      );
      if (outIdx < 0) {
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
      const out = pending[outIdx]!;
      const workYmd = bakuYmd(punch.occurredAt);
      const workDate = utcFromYmd(workYmd);
      if (
        workDate.getTime() < input.from.getTime() ||
        workDate.getTime() > input.to.getTime()
      ) {
        // Outside rebuild window — leave for another run; do not mark used
        i += 1;
        continue;
      }

      const resolved = await resolveCapAndNight(workDate, workYmd);
      // Night OUT next calendar day → hours on IN date (workYmd from IN)
      void resolved.isNight;

      const hours = hoursBetween(
        punch.occurredAt,
        out.occurredAt,
        resolved.cap,
      );
      const pairId = punch.id;
      const placeMismatch =
        punch.placeMismatch ||
        (resolved.assignmentPlaceId != null &&
          resolved.assignmentPlaceId !== punch.placeId);

      await this.prisma.workforceAttendancePunch.update({
        where: { id: punch.id },
        data: {
          status: WorkforceAttendancePunchStatus.PAIRED,
          pairId,
          hoursAttributed: roundHours(hours),
          workDate,
          placeMismatch,
        },
      });
      await this.prisma.workforceAttendancePunch.update({
        where: { id: out.id },
        data: {
          status: WorkforceAttendancePunchStatus.PAIRED,
          pairId,
          hoursAttributed: roundHours(hours),
          workDate,
          placeMismatch,
        },
      });
      used.add(punch.id);
      used.add(out.id);
      pairsWritten += 1;

      const cell = await upsertFaceidCell(workDate, hours, pairId);
      if (cell === "ok") cellsUpserted += 1;
      else if (cell === "approved") cellsSkippedApproved += 1;
      else if (cell === "absence") cellsSkippedAbsence += 1;
      else if (cell === "month") monthsSkipped += 1;
      i += 1;
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
        const resolved = await resolveCapAndNight(workDate, workYmd);
        if (resolved.plannedHours == null || resolved.plannedHours <= 0) {
          continue;
        }
        const cell = await upsertFaceidCell(
          workDate,
          resolved.plannedHours,
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
}
