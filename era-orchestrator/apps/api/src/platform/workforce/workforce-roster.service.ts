import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  WorkforceDayOverrideKind,
  WorkforceEmploymentStatus,
  WorkforcePlaceStatus,
  WorkforceTimesheetEntryStatus,
  WorkforceTimesheetEntryType,
  WorkforceTimesheetStatus,
} from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import {
  applyDayOverride,
  isoDayUtc,
  resolveCycleSlot,
  resolvedFromCycleSlot,
  type RosterTapeSlot,
  utcFromYmd,
  SEED_CYCLES,
  SEED_SHIFT_TYPES,
} from "./roster-cycle.util";
import { staffCodeFromEmployment } from "./workforce-staff-login";
import {
  addBakuDays,
  bakuCivilUtcDate,
  todayBakuYmd,
} from "@era/satellite-kit/time";
import type {
  CreateWorkforceBrigadeDto,
  CreateWorkforceDayOverrideDto,
  CreateWorkforcePlaceDto,
  CreateWorkforceShiftAssignmentDto,
  CreateWorkforceShiftCycleDto,
  CreateWorkforceShiftTypeDto,
  CycleSlotDto,
  LeaveWorkforceBrigadeMembersDto,
  ListBrigadeMembershipsQueryDto,
  TransferWorkforceBrigadeMembersDto,
  UpdateWorkforceBrigadeDto,
  UpdateWorkforcePlaceDto,
  UpdateWorkforceShiftAssignmentDto,
  UpdateWorkforceShiftCycleDto,
  UpdateWorkforceShiftTypeDto,
} from "./dto/workforce-roster.dto";

const MATERIALIZE_CHUNK = 25;

function parseDateOnly(iso: string): Date {
  return utcFromYmd(iso.slice(0, 10));
}

function monthBoundsUtc(year: number, month: number): {
  lastDay: number;
} {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { lastDay };
}

function dayDateUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function entryKey(employmentId: string, workDate: Date): string {
  return `${employmentId}|${isoDayUtc(workDate)}`;
}

function isCellImmutable(existing: {
  lockedFromAbsence?: boolean;
  status?: WorkforceTimesheetEntryStatus | string;
} | null | undefined): boolean {
  if (!existing) return false;
  if (existing.lockedFromAbsence) return true;
  return existing.status === WorkforceTimesheetEntryStatus.APPROVED;
}

function assignmentRangesOverlap(
  fromA: string,
  toA: string | null,
  fromB: string,
  toB: string | null,
): boolean {
  const endA = toA ?? "9999-12-31";
  const endB = toB ?? "9999-12-31";
  return fromA <= endB && fromB <= endA;
}

@Injectable()
export class WorkforceRosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly audit: WorkforceAuditService,
  ) {}

  // ── Places ──────────────────────────────────────────────────────────

  async listPlaces(organizationId: string, status?: WorkforcePlaceStatus) {
    await this.entitlement.assertWorkforceHub(organizationId);
    return this.prisma.workforcePlace.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
  }

  async createPlace(
    organizationId: string,
    actorUserId: string,
    dto: CreateWorkforcePlaceDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const code = dto.code.trim().toUpperCase();
    try {
      const row = await this.prisma.workforcePlace.create({
        data: {
          organizationId,
          code,
          name: dto.name.trim(),
          responsibleOrgUnitId: dto.responsibleOrgUnitId ?? null,
        },
      });
      await this.audit.log({
        organizationId,
        actorUserId,
        action: "ROSTER_PLACE_CREATE",
        entityType: "PLACE",
        entityId: row.id,
        payload: { code: row.code },
      });
      return row;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Place code already exists");
      }
      throw e;
    }
  }

  async updatePlace(
    organizationId: string,
    id: string,
    actorUserId: string,
    dto: UpdateWorkforcePlaceDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const existing = await this.prisma.workforcePlace.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Place not found");
    const row = await this.prisma.workforcePlace.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.status != null ? { status: dto.status } : {}),
        ...(dto.responsibleOrgUnitId !== undefined
          ? { responsibleOrgUnitId: dto.responsibleOrgUnitId }
          : {}),
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ROSTER_PLACE_UPDATE",
      entityType: "PLACE",
      entityId: id,
      payload: dto as Record<string, unknown>,
    });
    return row;
  }

  async archivePlace(
    organizationId: string,
    id: string,
    actorUserId: string,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const existing = await this.prisma.workforcePlace.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Place not found");
    const assigned = await this.prisma.workforceShiftAssignment.count({
      where: { placeId: id, organizationId },
    });
    if (assigned > 0) {
      throw new BadRequestException(
        "Cannot archive a place that is used on shift assignments",
      );
    }
    return this.updatePlace(organizationId, id, actorUserId, {
      status: WorkforcePlaceStatus.ARCHIVED,
    });
  }

  // ── Shift types ─────────────────────────────────────────────────────

  async listShiftTypes(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    await this.ensureDefaults(organizationId);
    return this.prisma.workforceShiftType.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
    });
  }

  async createShiftType(
    organizationId: string,
    actorUserId: string,
    dto: CreateWorkforceShiftTypeDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    try {
      const row = await this.prisma.workforceShiftType.create({
        data: {
          organizationId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          startMinute: dto.startMinute,
          endMinute: dto.endMinute,
          breakMinutes: dto.breakMinutes ?? 0,
          isNight: dto.isNight ?? false,
          defaultHours: dto.defaultHours ?? 8,
        },
      });
      await this.audit.log({
        organizationId,
        actorUserId,
        action: "ROSTER_SHIFT_TYPE_CREATE",
        entityType: "SHIFT_TYPE",
        entityId: row.id,
        payload: { code: row.code },
      });
      return row;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Shift type code already exists");
      }
      throw e;
    }
  }

  async updateShiftType(
    organizationId: string,
    id: string,
    actorUserId: string,
    dto: UpdateWorkforceShiftTypeDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const existing = await this.prisma.workforceShiftType.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Shift type not found");
    const row = await this.prisma.workforceShiftType.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.startMinute != null ? { startMinute: dto.startMinute } : {}),
        ...(dto.endMinute != null ? { endMinute: dto.endMinute } : {}),
        ...(dto.breakMinutes != null ? { breakMinutes: dto.breakMinutes } : {}),
        ...(dto.isNight != null ? { isNight: dto.isNight } : {}),
        ...(dto.defaultHours != null ? { defaultHours: dto.defaultHours } : {}),
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ROSTER_SHIFT_TYPE_UPDATE",
      entityType: "SHIFT_TYPE",
      entityId: id,
      payload: dto as Record<string, unknown>,
    });
    return row;
  }

  // ── Cycles ──────────────────────────────────────────────────────────

  async listCycles(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    await this.ensureDefaults(organizationId);
    return this.prisma.workforceShiftCycle.findMany({
      where: { organizationId },
      include: {
        slots: { orderBy: { slotIndex: "asc" }, include: { shiftType: true } },
      },
      orderBy: { code: "asc" },
    });
  }

  async createCycle(
    organizationId: string,
    actorUserId: string,
    dto: CreateWorkforceShiftCycleDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    this.assertSlots(dto.slots);
    try {
      const row = await this.prisma.workforceShiftCycle.create({
        data: {
          organizationId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          cycleAnchor: parseDateOnly(dto.cycleAnchor),
          slots: {
            create: dto.slots.map((s) => ({
              organizationId,
              slotIndex: s.slotIndex,
              shiftTypeId: s.shiftTypeId ?? null,
            })),
          },
        },
        include: {
          slots: { orderBy: { slotIndex: "asc" }, include: { shiftType: true } },
        },
      });
      await this.audit.log({
        organizationId,
        actorUserId,
        action: "ROSTER_CYCLE_CREATE",
        entityType: "SHIFT_CYCLE",
        entityId: row.id,
        payload: { code: row.code, slotCount: dto.slots.length },
      });
      return row;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Cycle code already exists");
      }
      throw e;
    }
  }

  async updateCycle(
    organizationId: string,
    id: string,
    actorUserId: string,
    dto: UpdateWorkforceShiftCycleDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const existing = await this.prisma.workforceShiftCycle.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Cycle not found");
    if (dto.slots) this.assertSlots(dto.slots);

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.slots) {
        await tx.workforceShiftCycleSlot.deleteMany({ where: { cycleId: id } });
        await tx.workforceShiftCycleSlot.createMany({
          data: dto.slots.map((s) => ({
            organizationId,
            cycleId: id,
            slotIndex: s.slotIndex,
            shiftTypeId: s.shiftTypeId ?? null,
          })),
        });
      }
      return tx.workforceShiftCycle.update({
        where: { id },
        data: {
          ...(dto.name != null ? { name: dto.name.trim() } : {}),
          ...(dto.cycleAnchor != null
            ? { cycleAnchor: parseDateOnly(dto.cycleAnchor) }
            : {}),
        },
        include: {
          slots: {
            orderBy: { slotIndex: "asc" },
            include: { shiftType: true },
          },
        },
      });
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ROSTER_CYCLE_UPDATE",
      entityType: "SHIFT_CYCLE",
      entityId: id,
      payload: dto as Record<string, unknown>,
    });
    return row;
  }

  // ── Brigades ────────────────────────────────────────────────────────

  async listBrigades(organizationId: string, asOfRaw?: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const asOf = this.parseYmd(asOfRaw?.trim() || todayBakuYmd());
    const asOfDate = bakuCivilUtcDate(asOf);
    const brigades = await this.prisma.workforceBrigade.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
    });
    const members = await this.prisma.workforceBrigadeMember.findMany({
      where: {
        organizationId,
        effectiveFrom: { lte: asOfDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
      },
      include: {
        employment: {
          select: {
            id: true,
            globalPersonId: true,
            status: true,
          },
        },
      },
    });
    const byBrigade = new Map<string, typeof members>();
    for (const m of members) {
      const list = byBrigade.get(m.brigadeId) ?? [];
      list.push(m);
      byBrigade.set(m.brigadeId, list);
    }
    return brigades.map((b) => {
      const roster = byBrigade.get(b.id) ?? [];
      return {
        ...b,
        asOf,
        members: roster.map((m) => this.serializeMember(m)),
        _count: { members: roster.length },
      };
    });
  }

  async listBrigadeMembers(
    organizationId: string,
    brigadeId: string,
    asOfRaw?: string,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const brigade = await this.prisma.workforceBrigade.findFirst({
      where: { id: brigadeId, organizationId },
    });
    if (!brigade) throw new NotFoundException("Brigade not found");
    const asOf = this.parseYmd(asOfRaw?.trim() || todayBakuYmd());
    const asOfDate = bakuCivilUtcDate(asOf);
    const members = await this.prisma.workforceBrigadeMember.findMany({
      where: {
        organizationId,
        brigadeId,
        effectiveFrom: { lte: asOfDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
      },
      include: {
        employment: {
          select: {
            id: true,
            globalPersonId: true,
            status: true,
          },
        },
      },
      orderBy: { effectiveFrom: "asc" },
    });
    return {
      brigadeId,
      asOf,
      items: members.map((m) => this.serializeMember(m)),
    };
  }

  async listBrigadeMemberships(
    organizationId: string,
    query: ListBrigadeMembershipsQueryDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: Prisma.WorkforceBrigadeMemberWhereInput = { organizationId };
    if (query.employmentId) where.employmentId = query.employmentId;
    if (query.brigadeId) where.brigadeId = query.brigadeId;
    if (query.from || query.to) {
      const fromYmd = query.from ? this.parseYmd(query.from) : "0001-01-01";
      const toYmd = query.to ? this.parseYmd(query.to) : "9999-12-31";
      if (fromYmd > toYmd) {
        throw new BadRequestException("from must be on or before to");
      }
      const fromDate = bakuCivilUtcDate(fromYmd);
      const toDate = bakuCivilUtcDate(toYmd);
      where.AND = [
        { effectiveFrom: { lte: toDate } },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: fromDate } }] },
      ];
    } else {
      const windowFrom = bakuCivilUtcDate(addBakuDays(todayBakuYmd(), -90));
      where.OR = [
        { effectiveTo: null },
        { effectiveTo: { gte: windowFrom } },
      ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.workforceBrigadeMember.count({ where }),
      this.prisma.workforceBrigadeMember.findMany({
        where,
        include: {
          brigade: { select: { id: true, code: true, name: true } },
          leftToBrigade: { select: { id: true, code: true, name: true } },
          employment: {
            select: { id: true, globalPersonId: true },
          },
        },
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((m) => ({
        id: m.id,
        employmentId: m.employmentId,
        staffCode: staffCodeFromEmployment(m.employmentId),
        globalPersonId: m.employment.globalPersonId,
        brigade: m.brigade,
        leftToBrigade: m.leftToBrigade,
        effectiveFrom: isoDayUtc(m.effectiveFrom),
        effectiveTo: m.effectiveTo ? isoDayUtc(m.effectiveTo) : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async createBrigade(
    organizationId: string,
    actorUserId: string,
    dto: CreateWorkforceBrigadeDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const employmentIds = [...new Set(dto.employmentIds ?? [])];
    await this.assertEmploymentsInOrg(organizationId, employmentIds);
    await this.assertEmploymentsActive(organizationId, employmentIds);
    const fromYmd = this.parseYmd(dto.effectiveFrom?.trim() || todayBakuYmd());
    this.assertEffectiveFromCap(fromYmd);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const brigade = await tx.workforceBrigade.create({
          data: {
            organizationId,
            code: dto.code.trim().toUpperCase(),
            name: dto.name.trim(),
          },
        });
        for (const employmentId of employmentIds) {
          await this.openMembership(tx, {
            organizationId,
            employmentId,
            brigadeId: brigade.id,
            fromYmd,
            leftToBrigadeId: null,
          });
        }
        return brigade;
      });
      await this.audit.log({
        organizationId,
        actorUserId,
        action: "ROSTER_BRIGADE_CREATE",
        entityType: "BRIGADE",
        entityId: created.id,
        payload: { code: created.code, memberCount: employmentIds.length },
      });
      const listed = await this.listBrigades(organizationId, fromYmd);
      return (
        listed.find((b) => b.id === created.id) ?? {
          ...created,
          asOf: fromYmd,
          members: [],
          _count: { members: 0 },
        }
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Brigade code already exists");
      }
      throw e;
    }
  }

  async updateBrigade(
    organizationId: string,
    id: string,
    actorUserId: string,
    dto: UpdateWorkforceBrigadeDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const existing = await this.prisma.workforceBrigade.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Brigade not found");
    const updated = await this.prisma.workforceBrigade.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ROSTER_BRIGADE_UPDATE",
      entityType: "BRIGADE",
      entityId: id,
      payload: { name: updated.name },
    });
    const listed = await this.listBrigades(organizationId);
    return listed.find((b) => b.id === id) ?? updated;
  }

  async transferBrigadeMembers(
    organizationId: string,
    actorUserId: string,
    dto: TransferWorkforceBrigadeMembersDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const employmentIds = [...new Set(dto.employmentIds)];
    const fromYmd = this.parseYmd(dto.effectiveFrom);
    this.assertEffectiveFromCap(fromYmd);
    await this.assertEmploymentsInOrg(organizationId, employmentIds);
    await this.assertEmploymentsActive(organizationId, employmentIds);
    const toBrigade = await this.prisma.workforceBrigade.findFirst({
      where: { id: dto.toBrigadeId, organizationId },
    });
    if (!toBrigade) throw new BadRequestException("Target brigade not found");
    if (dto.fromBrigadeId) {
      const fromBrigade = await this.prisma.workforceBrigade.findFirst({
        where: { id: dto.fromBrigadeId, organizationId },
      });
      if (!fromBrigade) {
        throw new BadRequestException("Source brigade not found");
      }
    }
    await this.assertNoApprovedTimesheetOverlap(
      organizationId,
      employmentIds,
      fromYmd,
    );
    const moved: string[] = [];
    const skipped: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const employmentId of employmentIds) {
        const result = await this.applyTransfer(tx, {
          organizationId,
          employmentId,
          toBrigadeId: dto.toBrigadeId,
          fromBrigadeId: dto.fromBrigadeId,
          fromYmd,
        });
        if (result === "skipped") skipped.push(employmentId);
        else moved.push(employmentId);
      }
    });
    const rematerializeSuggested = await this.rematerializeSuggested(
      organizationId,
      moved,
      fromYmd,
    );
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ROSTER_BRIGADE_TRANSFER",
      entityType: "BRIGADE",
      entityId: dto.toBrigadeId,
      payload: {
        count: moved.length,
        employmentIds: moved,
        toBrigadeId: dto.toBrigadeId,
        fromBrigadeId: dto.fromBrigadeId ?? null,
        effectiveFrom: fromYmd,
        rematerializeSuggested,
      },
    });
    return {
      movedCount: moved.length,
      skippedCount: skipped.length,
      employmentIds: moved,
      toBrigadeId: dto.toBrigadeId,
      effectiveFrom: fromYmd,
      rematerializeSuggested,
    };
  }

  async leaveBrigadeMembers(
    organizationId: string,
    actorUserId: string,
    dto: LeaveWorkforceBrigadeMembersDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const employmentIds = [...new Set(dto.employmentIds)];
    const fromYmd = this.parseYmd(dto.effectiveFrom);
    this.assertEffectiveFromCap(fromYmd);
    await this.assertEmploymentsInOrg(organizationId, employmentIds);
    if (dto.fromBrigadeId) {
      const fromBrigade = await this.prisma.workforceBrigade.findFirst({
        where: { id: dto.fromBrigadeId, organizationId },
      });
      if (!fromBrigade) {
        throw new BadRequestException("Source brigade not found");
      }
    }
    await this.assertNoApprovedTimesheetOverlap(
      organizationId,
      employmentIds,
      fromYmd,
    );
    const left: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const employmentId of employmentIds) {
        await this.applyLeave(tx, {
          organizationId,
          employmentId,
          fromBrigadeId: dto.fromBrigadeId,
          fromYmd,
        });
        left.push(employmentId);
      }
    });
    const rematerializeSuggested = await this.rematerializeSuggested(
      organizationId,
      left,
      fromYmd,
    );
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ROSTER_BRIGADE_LEAVE",
      entityType: "BRIGADE_MEMBER",
      entityId: dto.fromBrigadeId ?? left[0] ?? organizationId,
      payload: {
        count: left.length,
        employmentIds: left,
        fromBrigadeId: dto.fromBrigadeId ?? null,
        effectiveFrom: fromYmd,
        rematerializeSuggested,
      },
    });
    return {
      leftCount: left.length,
      employmentIds: left,
      effectiveFrom: fromYmd,
      rematerializeSuggested,
    };
  }

  // ── Assignments ─────────────────────────────────────────────────────

  async listAssignments(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    return this.prisma.workforceShiftAssignment.findMany({
      where: { organizationId },
      include: {
        place: true,
        cycle: true,
        employment: { include: { orgUnit: true } },
        brigade: true,
      },
      orderBy: [{ effectiveFrom: "desc" }],
    });
  }

  async createAssignment(
    organizationId: string,
    actorUserId: string,
    dto: CreateWorkforceShiftAssignmentDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const hasEmp = Boolean(dto.employmentId);
    const hasBrigade = Boolean(dto.brigadeId);
    if (hasEmp === hasBrigade) {
      throw new BadRequestException(
        "Assignment requires exactly one of employmentId or brigadeId",
      );
    }
    await this.assertPlaceCycle(organizationId, dto.placeId, dto.cycleId);
    if (dto.employmentId) {
      await this.assertEmploymentsInOrg(organizationId, [dto.employmentId]);
    }
    if (dto.brigadeId) {
      const b = await this.prisma.workforceBrigade.findFirst({
        where: { id: dto.brigadeId, organizationId },
      });
      if (!b) throw new BadRequestException("Brigade not found in organization");
    }
    await this.assertAssignmentNoOverlap(organizationId, {
      employmentId: dto.employmentId ?? null,
      brigadeId: dto.brigadeId ?? null,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo ?? null,
    });
    const row = await this.prisma.workforceShiftAssignment.create({
      data: {
        organizationId,
        placeId: dto.placeId,
        cycleId: dto.cycleId,
        employmentId: dto.employmentId ?? null,
        brigadeId: dto.brigadeId ?? null,
        effectiveFrom: parseDateOnly(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? parseDateOnly(dto.effectiveTo) : null,
      },
      include: { place: true, cycle: true, employment: true, brigade: true },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ROSTER_ASSIGNMENT_CREATE",
      entityType: "SHIFT_ASSIGNMENT",
      entityId: row.id,
      payload: {
        placeId: row.placeId,
        cycleId: row.cycleId,
        employmentId: row.employmentId,
        brigadeId: row.brigadeId,
      },
    });
    return row;
  }

  async updateAssignment(
    organizationId: string,
    id: string,
    actorUserId: string,
    dto: UpdateWorkforceShiftAssignmentDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const existing = await this.prisma.workforceShiftAssignment.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Assignment not found");
    if (dto.placeId || dto.cycleId) {
      await this.assertPlaceCycle(
        organizationId,
        dto.placeId ?? existing.placeId,
        dto.cycleId ?? existing.cycleId,
      );
    }
    const nextFrom = dto.effectiveFrom
      ? dto.effectiveFrom
      : isoDayUtc(existing.effectiveFrom);
    const nextTo =
      dto.effectiveTo !== undefined
        ? dto.effectiveTo
        : existing.effectiveTo
          ? isoDayUtc(existing.effectiveTo)
          : null;
    await this.assertAssignmentNoOverlap(
      organizationId,
      {
        employmentId: existing.employmentId,
        brigadeId: existing.brigadeId,
        effectiveFrom: nextFrom,
        effectiveTo: nextTo,
      },
      existing.id,
    );
    const row = await this.prisma.workforceShiftAssignment.update({
      where: { id },
      data: {
        ...(dto.placeId != null ? { placeId: dto.placeId } : {}),
        ...(dto.cycleId != null ? { cycleId: dto.cycleId } : {}),
        ...(dto.effectiveFrom != null
          ? { effectiveFrom: parseDateOnly(dto.effectiveFrom) }
          : {}),
        ...(dto.effectiveTo !== undefined
          ? {
              effectiveTo: dto.effectiveTo
                ? parseDateOnly(dto.effectiveTo)
                : null,
            }
          : {}),
      },
      include: { place: true, cycle: true, employment: true, brigade: true },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ROSTER_ASSIGNMENT_UPDATE",
      entityType: "SHIFT_ASSIGNMENT",
      entityId: id,
      payload: dto as Record<string, unknown>,
    });
    return row;
  }

  // ── Day overrides ───────────────────────────────────────────────────

  async listOverrides(
    organizationId: string,
    from?: string,
    to?: string,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    return this.prisma.workforceDayOverride.findMany({
      where: {
        organizationId,
        ...(from || to
          ? {
              workDate: {
                ...(from ? { gte: parseDateOnly(from) } : {}),
                ...(to ? { lte: parseDateOnly(to) } : {}),
              },
            }
          : {}),
      },
      include: { place: true, shiftType: true, employment: true },
      orderBy: { workDate: "asc" },
    });
  }

  async upsertOverride(
    organizationId: string,
    actorUserId: string,
    dto: CreateWorkforceDayOverrideDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    await this.assertEmploymentsInOrg(organizationId, [dto.employmentId]);
    if (
      dto.kind === WorkforceDayOverrideKind.EXTRA ||
      dto.kind === WorkforceDayOverrideKind.SWAP
    ) {
      if (!dto.shiftTypeId) {
        throw new BadRequestException(
          "EXTRA/SWAP override requires shiftTypeId",
        );
      }
      if (!dto.placeId?.trim()) {
        throw new BadRequestException(
          "EXTRA/SWAP override requires placeId (Place, not OrgUnit)",
        );
      }
    }
    const workDate = parseDateOnly(dto.workDate);
    const row = await this.prisma.workforceDayOverride.upsert({
      where: {
        employmentId_workDate: {
          employmentId: dto.employmentId,
          workDate,
        },
      },
      create: {
        organizationId,
        employmentId: dto.employmentId,
        workDate,
        kind: dto.kind,
        placeId: dto.placeId ?? null,
        shiftTypeId: dto.shiftTypeId ?? null,
        note: dto.note ?? null,
      },
      update: {
        kind: dto.kind,
        placeId: dto.placeId ?? null,
        shiftTypeId: dto.shiftTypeId ?? null,
        note: dto.note ?? null,
      },
      include: { place: true, shiftType: true },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ROSTER_DAY_OVERRIDE_UPSERT",
      entityType: "DAY_OVERRIDE",
      entityId: row.id,
      payload: { kind: dto.kind, workDate: dto.workDate },
    });
    return row;
  }

  async deleteOverride(
    organizationId: string,
    id: string,
    actorUserId: string,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const existing = await this.prisma.workforceDayOverride.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Override not found");
    await this.prisma.workforceDayOverride.delete({ where: { id } });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ROSTER_DAY_OVERRIDE_DELETE",
      entityType: "DAY_OVERRIDE",
      entityId: id,
      payload: {},
    });
    return { ok: true };
  }

  // ── Defaults seed ───────────────────────────────────────────────────

  async ensureDefaults(organizationId: string) {
    const existingTypes = await this.prisma.workforceShiftType.findMany({
      where: { organizationId },
      select: { code: true },
    });
    const existingTypeCodes = new Set(existingTypes.map((t) => t.code));
    const missingTypes = SEED_SHIFT_TYPES.filter(
      (t) => !existingTypeCodes.has(t.code),
    );
    if (missingTypes.length) {
      await this.prisma.workforceShiftType.createMany({
        data: missingTypes.map((t) => ({
          organizationId,
          code: t.code,
          name: t.name,
          startMinute: t.startMinute,
          endMinute: t.endMinute,
          breakMinutes: t.breakMinutes,
          isNight: t.isNight,
          defaultHours: t.defaultHours,
        })),
      });
    }
    const types = await this.prisma.workforceShiftType.findMany({
      where: { organizationId },
    });
    const byCode = new Map(types.map((t) => [t.code, t]));

    const existingCycles = await this.prisma.workforceShiftCycle.findMany({
      where: { organizationId },
      select: { code: true },
    });
    const existingCodes = new Set(existingCycles.map((c) => c.code));
    const anchor = utcFromYmd("2026-01-05"); // Monday
    let seededCycles = 0;
    for (const def of SEED_CYCLES) {
      if (existingCodes.has(def.code)) continue;
      await this.prisma.workforceShiftCycle.create({
        data: {
          organizationId,
          code: def.code,
          name: def.name,
          cycleAnchor: anchor,
          slots: {
            create: def.tape.map((code, slotIndex) => {
              if (code === "OFF") {
                return { organizationId, slotIndex, shiftTypeId: null };
              }
              const st = byCode.get(code);
              if (!st) {
                throw new BadRequestException(
                  `Seed shift type ${code} missing`,
                );
              }
              return {
                organizationId,
                slotIndex,
                shiftTypeId: st.id,
              };
            }),
          },
        },
      });
      seededCycles += 1;
    }
    return {
      types: byCode.size,
      seeded: missingTypes.length > 0 || seededCycles > 0,
      seededTypes: missingTypes.length,
      seededCycles,
    };
  }

  /**
   * Read-only person × day plan for the roster UI grid (does not write timesheet).
   */
  async previewMonth(
    organizationId: string,
    year: number,
    month: number,
    opts?: { placeId?: string; orgUnitId?: string },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      throw new BadRequestException("Invalid year/month");
    }
    const { lastDay } = monthBoundsUtc(year, month);
    const employments = await this.prisma.workforceEmployment.findMany({
      where: {
        organizationId,
        status: WorkforceEmploymentStatus.ACTIVE,
        ...(opts?.orgUnitId ? { orgUnitId: opts.orgUnitId } : {}),
      },
      select: {
        id: true,
        orgUnitId: true,
        globalPersonId: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const [assignments, brigadeMembers, cycles, overrides, shiftTypes, places] =
      await Promise.all([
        this.prisma.workforceShiftAssignment.findMany({
          where: {
            organizationId,
            ...(opts?.placeId ? { placeId: opts.placeId } : {}),
          },
        }),
        this.prisma.workforceBrigadeMember.findMany({
          where: { organizationId },
        }),
        this.prisma.workforceShiftCycle.findMany({
          where: { organizationId },
          include: {
            slots: {
              orderBy: { slotIndex: "asc" },
              include: { shiftType: true },
            },
          },
        }),
        this.prisma.workforceDayOverride.findMany({
          where: {
            organizationId,
            workDate: {
              gte: dayDateUtc(year, month, 1),
              lte: dayDateUtc(year, month, lastDay),
            },
          },
          include: { shiftType: true },
        }),
        this.prisma.workforceShiftType.findMany({
          where: { organizationId },
        }),
        this.prisma.workforcePlace.findMany({
          where: { organizationId },
        }),
      ]);

    const ctx = this.buildResolveContext({
      assignments,
      brigadeMembers,
      cycles,
      overrides,
      shiftTypes,
      places,
    });

    const rows = employments.map((emp) => {
      const cells: Array<{
        day: number;
        type: "WORK" | "OFF" | null;
        hours: number;
        placeId: string | null;
        placeCode: string | null;
        shiftTypeCode: string | null;
        fromOverride: boolean;
      }> = [];
      for (let d = 1; d <= lastDay; d++) {
        const workDate = dayDateUtc(year, month, d);
        const ymd = isoDayUtc(workDate);
        const resolved = this.resolveEmploymentDay(ctx, emp.id, ymd);
        if (!resolved) {
          cells.push({
            day: d,
            type: null,
            hours: 0,
            placeId: null,
            placeCode: null,
            shiftTypeCode: null,
            fromOverride: false,
          });
          continue;
        }
        // When filtering by place, blank cells that resolve to another place.
        if (opts?.placeId && resolved.placeId && resolved.placeId !== opts.placeId) {
          cells.push({
            day: d,
            type: null,
            hours: 0,
            placeId: resolved.placeId,
            placeCode: ctx.placeById.get(resolved.placeId)?.code ?? null,
            shiftTypeCode: resolved.shiftTypeId
              ? ctx.typeById.get(resolved.shiftTypeId)?.code ?? null
              : null,
            fromOverride: resolved.fromOverride,
          });
          continue;
        }
        cells.push({
          day: d,
          type: resolved.type,
          hours: resolved.hours,
          placeId: resolved.placeId,
          placeCode: resolved.placeId
            ? ctx.placeById.get(resolved.placeId)?.code ?? null
            : null,
          shiftTypeCode: resolved.shiftTypeId
            ? ctx.typeById.get(resolved.shiftTypeId)?.code ?? null
            : null,
          fromOverride: resolved.fromOverride,
        });
      }
      return {
        employmentId: emp.id,
        staffCode: staffCodeFromEmployment(emp.id),
        orgUnitId: emp.orgUnitId,
        globalPersonId: emp.globalPersonId,
        cells,
      };
    });

    return {
      year,
      month,
      lastDay,
      places: places.map((p) => ({ id: p.id, code: p.code, name: p.name })),
      rows,
    };
  }

  // ── Materialize ─────────────────────────────────────────────────────

  async materializeMonth(
    organizationId: string,
    timesheetId: string,
    actorUserId: string,
    opts?: { preserveManual?: boolean; overwriteFacts?: boolean },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const ts = await this.prisma.workforceTimesheet.findFirst({
      where: { id: timesheetId, organizationId },
    });
    if (!ts) throw new NotFoundException("Timesheet not found");
    if (ts.status !== WorkforceTimesheetStatus.DRAFT) {
      throw new ConflictException({
        code: "TIMESHEET_NOT_DRAFT",
        message: "Roster materialize requires a DRAFT month timesheet",
      });
    }

    const { year, month } = ts;
    const { lastDay } = monthBoundsUtc(year, month);
    const overwriteFacts = opts?.overwriteFacts === true;
    const preserveManual = opts?.preserveManual === true;

    const employments = await this.prisma.workforceEmployment.findMany({
      where: {
        organizationId,
        status: WorkforceEmploymentStatus.ACTIVE,
      },
      select: { id: true },
    });

    const [assignments, brigadeMembers, cycles, overrides, shiftTypes, places, existingRows] =
      await Promise.all([
        this.prisma.workforceShiftAssignment.findMany({
          where: { organizationId },
        }),
        this.prisma.workforceBrigadeMember.findMany({
          where: { organizationId },
        }),
        this.prisma.workforceShiftCycle.findMany({
          where: { organizationId },
          include: {
            slots: {
              orderBy: { slotIndex: "asc" },
              include: { shiftType: true },
            },
          },
        }),
        this.prisma.workforceDayOverride.findMany({
          where: {
            organizationId,
            workDate: {
              gte: dayDateUtc(year, month, 1),
              lte: dayDateUtc(year, month, lastDay),
            },
          },
          include: { shiftType: true },
        }),
        this.prisma.workforceShiftType.findMany({
          where: { organizationId },
        }),
        this.prisma.workforcePlace.findMany({
          where: { organizationId },
        }),
        this.prisma.workforceTimesheetEntry.findMany({
          where: { timesheetId, organizationId },
        }),
      ]);

    const ctx = this.buildResolveContext({
      assignments,
      brigadeMembers,
      cycles,
      overrides,
      shiftTypes,
      places,
    });
    const existingMap = new Map(
      existingRows.map((e) => [entryKey(e.employmentId, e.workDate), e]),
    );

    let cellsTouched = 0;
    let cellsSkippedLocked = 0;
    let cellsSkippedManual = 0;
    let cellsSkippedNoPlan = 0;

    const todayIso = todayBakuYmd();
    for (let i = 0; i < employments.length; i += MATERIALIZE_CHUNK) {
      const chunk = employments.slice(i, i + MATERIALIZE_CHUNK);
      await this.prisma.$transaction(async (tx) => {
        for (const emp of chunk) {
          for (let d = 1; d <= lastDay; d++) {
            const workDate = dayDateUtc(year, month, d);
            const ymd = isoDayUtc(workDate);
            if (ymd > todayIso) {
              continue;
            }
            const key = entryKey(emp.id, workDate);
            const existing = existingMap.get(key);
            if (isCellImmutable(existing)) {
              cellsSkippedLocked += 1;
              continue;
            }
            if (existing && !overwriteFacts) {
              cellsSkippedManual += 1;
              continue;
            }
            if (
              preserveManual &&
              existing &&
              (existing.source === "ops_grid" || existing.source === "faceid")
            ) {
              cellsSkippedManual += 1;
              continue;
            }

            const resolved = this.resolveEmploymentDay(ctx, emp.id, ymd);
            if (!resolved) {
              cellsSkippedNoPlan += 1;
              continue;
            }

            const type =
              resolved.type === "WORK"
                ? WorkforceTimesheetEntryType.WORK
                : WorkforceTimesheetEntryType.OFF;
            const hours = new Prisma.Decimal(resolved.hours);
            const sourceRef = resolved.assignmentId;

            await tx.workforceTimesheetEntry.upsert({
              where: {
                timesheetId_employmentId_workDate: {
                  timesheetId,
                  employmentId: emp.id,
                  workDate,
                },
              },
              create: {
                organizationId,
                timesheetId,
                employmentId: emp.id,
                workDate,
                type,
                hours,
                source: "roster_plan",
                sourceRef,
                status: "DRAFT",
                lockedFromAbsence: false,
              },
              update: {
                type,
                hours,
                source: "roster_plan",
                sourceRef,
                lockedFromAbsence: false,
              },
            });
            cellsTouched += 1;
          }
        }
      });
    }

    await this.audit.log({
      organizationId,
      actorUserId,
      action: "TIMESHEET_ROSTER_MATERIALIZED",
      entityType: "TIMESHEET",
      entityId: timesheetId,
      payload: {
        year,
        month,
        employmentCount: employments.length,
        cellsTouched,
        cellsSkippedLocked,
        cellsSkippedManual,
        cellsSkippedNoPlan,
        preserveManual,
        chunkSize: MATERIALIZE_CHUNK,
      },
    });

    return {
      timesheetId,
      year,
      month,
      cellsTouched,
      cellsSkippedLocked,
      cellsSkippedManual,
      cellsSkippedNoPlan,
      preserveManual,
    };
  }

  // ── helpers ─────────────────────────────────────────────────────────

  private buildResolveContext(input: {
    assignments: Array<{
      id: string;
      placeId: string;
      cycleId: string;
      employmentId: string | null;
      brigadeId: string | null;
      effectiveFrom: Date;
      effectiveTo: Date | null;
    }>;
    brigadeMembers: Array<{
      employmentId: string;
      brigadeId: string;
      effectiveFrom: Date;
      effectiveTo: Date | null;
    }>;
    cycles: Array<{
      id: string;
      cycleAnchor: Date;
      slots: Array<{
        shiftTypeId: string | null;
        shiftType: { id: string; code?: string; defaultHours: unknown } | null;
      }>;
    }>;
    overrides: Array<{
      employmentId: string;
      workDate: Date;
      kind: WorkforceDayOverrideKind;
      placeId: string | null;
      shiftTypeId: string | null;
      shiftType: { defaultHours: unknown } | null;
    }>;
    shiftTypes: Array<{ id: string; code: string; defaultHours: unknown }>;
    places: Array<{ id: string; code: string; name: string }>;
  }) {
    const cycleById = new Map(input.cycles.map((c) => [c.id, c]));
    const typeById = new Map(input.shiftTypes.map((t) => [t.id, t]));
    const placeById = new Map(input.places.map((p) => [p.id, p]));
    const memberships = input.brigadeMembers.map((m) => ({
      employmentId: m.employmentId,
      brigadeId: m.brigadeId,
      fromYmd: isoDayUtc(m.effectiveFrom),
      toYmd: m.effectiveTo ? isoDayUtc(m.effectiveTo) : null,
    }));
    const overrideByKey = new Map(
      input.overrides.map((o) => [entryKey(o.employmentId, o.workDate), o]),
    );
    const tapeFor = (cycleId: string): RosterTapeSlot[] => {
      const cycle = cycleById.get(cycleId);
      if (!cycle) return [];
      return cycle.slots.map((s) => {
        if (!s.shiftTypeId || !s.shiftType) return { kind: "OFF" as const };
        return {
          kind: "SHIFT" as const,
          shiftTypeId: s.shiftTypeId,
          defaultHours: Number(s.shiftType.defaultHours),
        };
      });
    };
    const pickAssignment = (employmentId: string, ymd: string) => {
      const brigadeIds = memberships
        .filter(
          (m) =>
            m.employmentId === employmentId &&
            m.fromYmd <= ymd &&
            (m.toYmd == null || ymd <= m.toYmd),
        )
        .map((m) => m.brigadeId);
      const candidates = input.assignments.filter((a) => {
        const from = isoDayUtc(a.effectiveFrom);
        const to = a.effectiveTo ? isoDayUtc(a.effectiveTo) : null;
        if (ymd < from) return false;
        if (to && ymd > to) return false;
        if (a.employmentId === employmentId) return true;
        if (a.brigadeId && brigadeIds.includes(a.brigadeId)) return true;
        return false;
      });
      if (!candidates.length) return null;
      candidates.sort((a, b) =>
        isoDayUtc(b.effectiveFrom).localeCompare(isoDayUtc(a.effectiveFrom)),
      );
      return candidates[0] ?? null;
    };
    return {
      cycleById,
      typeById,
      placeById,
      overrideByKey,
      tapeFor,
      pickAssignment,
    };
  }

  private resolveEmploymentDay(
    ctx: ReturnType<WorkforceRosterService["buildResolveContext"]>,
    employmentId: string,
    ymd: string,
  ) {
    const asg = ctx.pickAssignment(employmentId, ymd);
    const ov = ctx.overrideByKey.get(`${employmentId}|${ymd}`);
    if (!asg && !ov) return null;

    let resolved = asg
      ? resolvedFromCycleSlot(
          resolveCycleSlot(
            ctx.tapeFor(asg.cycleId),
            isoDayUtc(ctx.cycleById.get(asg.cycleId)!.cycleAnchor),
            ymd,
          ),
          asg.placeId,
          asg.id,
        )
      : {
          type: "OFF" as const,
          hours: 0,
          shiftTypeId: null as string | null,
          placeId: null as string | null,
          assignmentId: null as string | null,
          fromOverride: false,
        };

    if (ov) {
      const hoursFromType = ov.shiftTypeId
        ? Number(ctx.typeById.get(ov.shiftTypeId)?.defaultHours ?? 8)
        : null;
      resolved = applyDayOverride(resolved, {
        kind: ov.kind,
        placeId: ov.placeId,
        shiftTypeId: ov.shiftTypeId,
        defaultHours: hoursFromType,
      });
    }
    return resolved;
  }

  private assertSlots(slots: CycleSlotDto[]) {
    if (!slots.length) {
      throw new BadRequestException("Cycle requires at least one slot");
    }
    const indexes = slots.map((s) => s.slotIndex).sort((a, b) => a - b);
    for (let i = 0; i < indexes.length; i++) {
      if (indexes[i] !== i) {
        throw new BadRequestException(
          "Cycle slotIndex must be contiguous from 0",
        );
      }
    }
  }

  private parseYmd(raw: string): string {
    const ymd = raw.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      throw new BadRequestException("Date must be YYYY-MM-DD");
    }
    try {
      bakuCivilUtcDate(ymd);
    } catch {
      throw new BadRequestException("Date must be YYYY-MM-DD");
    }
    return ymd;
  }

  private assertEffectiveFromCap(fromYmd: string) {
    const cap = addBakuDays(todayBakuYmd(), 31);
    if (fromYmd > cap) {
      throw new BadRequestException(
        "effectiveFrom cannot be more than 31 Baku days ahead",
      );
    }
  }

  private monthsInRange(
    fromYmd: string,
    toYmd: string,
  ): Array<{ year: number; month: number }> {
    const [fy, fm] = fromYmd.split("-").map(Number);
    const [ty, tm] = toYmd.split("-").map(Number);
    const out: Array<{ year: number; month: number }> = [];
    let y = fy;
    let m = fm;
    while (y < ty || (y === ty && m <= tm)) {
      out.push({ year: y, month: m });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return out;
  }

  private serializeMember(m: {
    id: string;
    employmentId: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    employment: {
      globalPersonId: string | null;
      status?: string;
    };
  }) {
    return {
      id: m.id,
      employmentId: m.employmentId,
      effectiveFrom: isoDayUtc(m.effectiveFrom),
      effectiveTo: m.effectiveTo ? isoDayUtc(m.effectiveTo) : null,
      staffCode: staffCodeFromEmployment(m.employmentId),
      globalPersonId: m.employment.globalPersonId,
      status: m.employment.status,
    };
  }

  private intervalOverlaps(
    aFrom: string,
    aTo: string | null,
    bFrom: string,
    bTo: string | null,
  ): boolean {
    const aEnd = aTo ?? "9999-12-31";
    const bEnd = bTo ?? "9999-12-31";
    return aFrom <= bEnd && bFrom <= aEnd;
  }

  private async assertEmploymentsActive(
    organizationId: string,
    employmentIds: string[],
  ) {
    if (!employmentIds.length) return;
    const inactive = await this.prisma.workforceEmployment.count({
      where: {
        organizationId,
        id: { in: employmentIds },
        status: { not: WorkforceEmploymentStatus.ACTIVE },
      },
    });
    if (inactive > 0) {
      throw new BadRequestException(
        "One or more employments are not ACTIVE",
      );
    }
  }

  private async assertNoApprovedTimesheetOverlap(
    organizationId: string,
    employmentIds: string[],
    fromYmd: string,
  ) {
    const today = todayBakuYmd();
    if (fromYmd >= today) return;
    const toYmd = addBakuDays(today, -1);
    const months = this.monthsInRange(fromYmd, toYmd);
    if (!months.length) return;
    const approved = await this.prisma.workforceTimesheet.findMany({
      where: {
        organizationId,
        status: WorkforceTimesheetStatus.APPROVED,
        OR: months.map(({ year, month }) => ({ year, month })),
      },
      select: { id: true },
    });
    if (approved.length) {
      throw new ConflictException(
        "Cannot backdate brigade membership over an APPROVED timesheet month",
      );
    }
    const approvedCell = await this.prisma.workforceTimesheetEntry.findFirst({
      where: {
        organizationId,
        employmentId: { in: employmentIds },
        status: WorkforceTimesheetEntryStatus.APPROVED,
        workDate: {
          gte: bakuCivilUtcDate(fromYmd),
          lte: bakuCivilUtcDate(toYmd),
        },
      },
      select: { id: true },
    });
    if (approvedCell) {
      throw new ConflictException(
        "Cannot backdate brigade membership over an APPROVED timesheet cell",
      );
    }
  }

  private async rematerializeSuggested(
    organizationId: string,
    employmentIds: string[],
    fromYmd: string,
  ): Promise<boolean> {
    if (!employmentIds.length) return false;
    const count = await this.prisma.workforceTimesheetEntry.count({
      where: {
        organizationId,
        employmentId: { in: employmentIds },
        source: "roster_plan",
        status: WorkforceTimesheetEntryStatus.DRAFT,
        workDate: { gte: bakuCivilUtcDate(fromYmd) },
      },
    });
    return count > 0;
  }

  private async loadOpenMemberships(
    tx: Prisma.TransactionClient,
    organizationId: string,
    employmentId: string,
  ) {
    return tx.workforceBrigadeMember.findMany({
      where: { organizationId, employmentId, effectiveTo: null },
    });
  }

  private async assertNoIntervalOverlap(
    tx: Prisma.TransactionClient,
    organizationId: string,
    employmentId: string,
    fromYmd: string,
    toYmd: string | null,
    exceptId?: string,
  ) {
    const rows = await tx.workforceBrigadeMember.findMany({
      where: {
        organizationId,
        employmentId,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    for (const row of rows) {
      const rowFrom = isoDayUtc(row.effectiveFrom);
      const rowTo = row.effectiveTo ? isoDayUtc(row.effectiveTo) : null;
      if (this.intervalOverlaps(rowFrom, rowTo, fromYmd, toYmd)) {
        throw new ConflictException(
          "Brigade membership interval overlaps an existing interval",
        );
      }
    }
  }

  private async openMembership(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      employmentId: string;
      brigadeId: string;
      fromYmd: string;
      leftToBrigadeId: string | null;
    },
  ) {
    const opens = await this.loadOpenMemberships(
      tx,
      input.organizationId,
      input.employmentId,
    );
    if (opens.length > 1) {
      throw new ConflictException(
        "Employment has more than one open brigade membership",
      );
    }
    if (opens.length === 1) {
      throw new ConflictException(
        "Employment already has an open brigade membership",
      );
    }
    await this.assertNoIntervalOverlap(
      tx,
      input.organizationId,
      input.employmentId,
      input.fromYmd,
      null,
    );
    try {
      await tx.workforceBrigadeMember.create({
        data: {
          organizationId: input.organizationId,
          employmentId: input.employmentId,
          brigadeId: input.brigadeId,
          effectiveFrom: bakuCivilUtcDate(input.fromYmd),
          effectiveTo: null,
          leftToBrigadeId: input.leftToBrigadeId,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException(
          "Employment already has an open brigade membership",
        );
      }
      throw e;
    }
  }

  private async closeOpenMembership(
    tx: Prisma.TransactionClient,
    open: {
      id: string;
      employmentId: string;
      organizationId: string;
      brigadeId: string;
      effectiveFrom: Date;
    },
    fromYmd: string,
    leftToBrigadeId: string | null,
  ) {
    const openFrom = isoDayUtc(open.effectiveFrom);
    if (fromYmd <= openFrom) {
      throw new BadRequestException(
        "effectiveFrom must be after the open membership start",
      );
    }
    const lastDay = addBakuDays(fromYmd, -1);
    await tx.workforceBrigadeMember.update({
      where: { id: open.id },
      data: {
        effectiveTo: bakuCivilUtcDate(lastDay),
        leftToBrigadeId,
      },
    });
  }

  private async applyTransfer(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      employmentId: string;
      toBrigadeId: string;
      fromBrigadeId?: string;
      fromYmd: string;
    },
  ): Promise<"moved" | "skipped"> {
    const opens = await this.loadOpenMemberships(
      tx,
      input.organizationId,
      input.employmentId,
    );
    if (opens.length > 1) {
      throw new ConflictException(
        "Employment has more than one open brigade membership",
      );
    }
    const asOfDate = bakuCivilUtcDate(input.fromYmd);
    const already = await tx.workforceBrigadeMember.findFirst({
      where: {
        organizationId: input.organizationId,
        employmentId: input.employmentId,
        brigadeId: input.toBrigadeId,
        effectiveFrom: { lte: asOfDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
      },
    });
    if (already) return "skipped";
    const open = opens[0];
    if (input.fromBrigadeId) {
      if (!open || open.brigadeId !== input.fromBrigadeId) {
        throw new BadRequestException(
          "Employment is not an open member of the source brigade",
        );
      }
    }
    if (open) {
      await this.closeOpenMembership(
        tx,
        open,
        input.fromYmd,
        input.toBrigadeId,
      );
    }
    await this.openMembership(tx, {
      organizationId: input.organizationId,
      employmentId: input.employmentId,
      brigadeId: input.toBrigadeId,
      fromYmd: input.fromYmd,
      leftToBrigadeId: null,
    });
    return "moved";
  }

  private async applyLeave(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      employmentId: string;
      fromBrigadeId?: string;
      fromYmd: string;
    },
  ) {
    const opens = await this.loadOpenMemberships(
      tx,
      input.organizationId,
      input.employmentId,
    );
    if (opens.length > 1) {
      throw new ConflictException(
        "Employment has more than one open brigade membership",
      );
    }
    const open = opens[0];
    if (!open) {
      throw new BadRequestException(
        "Employment has no open brigade membership",
      );
    }
    if (input.fromBrigadeId && open.brigadeId !== input.fromBrigadeId) {
      throw new BadRequestException(
        "Employment is not an open member of the source brigade",
      );
    }
    await this.closeOpenMembership(tx, open, input.fromYmd, null);
  }

  private async assertEmploymentsInOrg(
    organizationId: string,
    employmentIds: string[],
  ) {
    if (!employmentIds.length) return;
    const count = await this.prisma.workforceEmployment.count({
      where: { organizationId, id: { in: employmentIds } },
    });
    if (count !== employmentIds.length) {
      throw new BadRequestException(
        "One or more employments are not in this organization",
      );
    }
  }

  private async assertPlaceCycle(
    organizationId: string,
    placeId: string,
    cycleId: string,
  ) {
    const [place, cycle] = await Promise.all([
      this.prisma.workforcePlace.findFirst({
        where: { id: placeId, organizationId },
      }),
      this.prisma.workforceShiftCycle.findFirst({
        where: { id: cycleId, organizationId },
      }),
    ]);
    if (!place) throw new BadRequestException("Place not found in organization");
    if (!cycle) throw new BadRequestException("Cycle not found in organization");
  }

  private async assertAssignmentNoOverlap(
    organizationId: string,
    input: {
      employmentId: string | null;
      brigadeId: string | null;
      effectiveFrom: string;
      effectiveTo: string | null;
    },
    excludeId?: string,
  ) {
    const from = this.parseYmd(input.effectiveFrom);
    const to = input.effectiveTo ? this.parseYmd(input.effectiveTo) : null;
    if (to && to < from) {
      throw new BadRequestException({
        code: "ASSIGNMENT_RANGE",
        message: "effectiveTo cannot be before effectiveFrom",
      });
    }
    const others = await this.prisma.workforceShiftAssignment.findMany({
      where: {
        organizationId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        ...(input.employmentId
          ? { employmentId: input.employmentId }
          : input.brigadeId
            ? { brigadeId: input.brigadeId }
            : { id: { in: [] } }),
      },
    });
    for (const o of others) {
      const oFrom = isoDayUtc(o.effectiveFrom);
      const oTo = o.effectiveTo ? isoDayUtc(o.effectiveTo) : null;
      if (assignmentRangesOverlap(from, to, oFrom, oTo)) {
        throw new ConflictException({
          code: "ASSIGNMENT_OVERLAP",
          message:
            "This brigade or person already has a shift assignment overlapping these dates",
        });
      }
    }
  }
}
