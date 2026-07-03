import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  WORKFORCE_ABSENCE_APPROVED,
  WORKFORCE_ABSENCE_CANCELLED,
  WORKFORCE_ABSENCE_UPDATED,
} from "@era/contracts";
import {
  WorkforceAbsenceKind,
  WorkforceAbsenceStatus,
  WorkforceEmploymentStatus,
} from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { SatelliteEventsService } from "../../satellite-events/satellite-events.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import type {
  CreateWorkforceAbsenceDto,
  ListWorkforceAbsencesQueryDto,
  RejectWorkforceAbsenceDto,
  UpdateWorkforceAbsenceDto,
} from "./dto/workforce-absence.dto";

function parseDateOnly(iso: string): Date {
  const d = iso.slice(0, 10);
  return new Date(`${d}T00:00:00.000Z`);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class WorkforceAbsencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly audit: WorkforceAuditService,
    private readonly satelliteEvents: SatelliteEventsService,
  ) {}

  async list(
    organizationId: string,
    query: ListWorkforceAbsencesQueryDto,
    orgUnitIds?: string[] | null,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const dateFrom = query.dateFrom
      ? parseDateOnly(query.dateFrom)
      : undefined;
    const dateTo = query.dateTo ? parseDateOnly(query.dateTo) : undefined;
    return this.prisma.workforceAbsence.findMany({
      where: {
        organizationId,
        ...(query.employmentId ? { employmentId: query.employmentId } : {}),
        ...(orgUnitIds != null
          ? orgUnitIds.length === 0
            ? { id: { in: [] } }
            : { employment: { orgUnitId: { in: orgUnitIds } } }
          : {}),
        ...(dateFrom || dateTo
          ? {
              startDate: dateTo ? { lte: dateTo } : undefined,
              endDate: dateFrom ? { gte: dateFrom } : undefined,
            }
          : {}),
      },
      include: { employment: { include: { orgUnit: true, position: true } } },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });
  }

  async getOne(organizationId: string, id: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const row = await this.prisma.workforceAbsence.findFirst({
      where: { id, organizationId },
      include: { employment: true },
    });
    if (!row) throw new NotFoundException("Absence not found");
    return row;
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateWorkforceAbsenceDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const employment = await this.prisma.workforceEmployment.findFirst({
      where: {
        id: dto.employmentId,
        organizationId,
        status: WorkforceEmploymentStatus.ACTIVE,
      },
    });
    if (!employment) {
      throw new BadRequestException("Active employment required");
    }

    const start = parseDateOnly(dto.startDate);
    const end = parseDateOnly(dto.endDate);
    this.assertDateRange(start, end);
    await this.assertNoOverlap(organizationId, dto.employmentId, start, end, null);

    const submit = dto.submit === true;
    const now = new Date();
    const row = await this.prisma.workforceAbsence.create({
      data: {
        organizationId,
        employmentId: dto.employmentId,
        kind: dto.kind,
        startDate: start,
        endDate: end,
        note: (dto.note ?? "").trim(),
        status: submit
          ? WorkforceAbsenceStatus.SUBMITTED
          : WorkforceAbsenceStatus.DRAFT,
        ...(submit
          ? {
              submittedAt: now,
              submittedByUserId: actorUserId,
            }
          : {}),
      },
      include: { employment: true },
    });

    await this.audit.log({
      organizationId,
      actorUserId,
      action: submit ? "ABSENCE_SUBMITTED" : "ABSENCE_CREATED",
      entityType: "ABSENCE",
      entityId: row.id,
      payload: {
        kind: row.kind,
        startDate: isoDay(row.startDate),
        endDate: isoDay(row.endDate),
      },
    });

    return row;
  }

  async submit(organizationId: string, id: string, actorUserId: string) {
    const row = await this.getOne(organizationId, id);
    if (row.status !== WorkforceAbsenceStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT absences can be submitted");
    }
    await this.assertNoOverlap(
      organizationId,
      row.employmentId,
      row.startDate,
      row.endDate,
      id,
    );
    const updated = await this.prisma.workforceAbsence.update({
      where: { id },
      data: {
        status: WorkforceAbsenceStatus.SUBMITTED,
        submittedAt: new Date(),
        submittedByUserId: actorUserId,
      },
      include: { employment: true },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ABSENCE_SUBMITTED",
      entityType: "ABSENCE",
      entityId: id,
    });
    return updated;
  }

  async approve(organizationId: string, id: string, actorUserId: string) {
    const row = await this.getOne(organizationId, id);
    if (row.status !== WorkforceAbsenceStatus.SUBMITTED) {
      throw new BadRequestException("Only SUBMITTED absences can be approved");
    }
    await this.assertNoOverlap(
      organizationId,
      row.employmentId,
      row.startDate,
      row.endDate,
      id,
    );
    const approvedAt = new Date();
    const updated = await this.prisma.workforceAbsence.update({
      where: { id },
      data: {
        status: WorkforceAbsenceStatus.APPROVED,
        approvedAt,
        approvedByUserId: actorUserId,
      },
      include: { employment: true },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ABSENCE_APPROVED",
      entityType: "ABSENCE",
      entityId: id,
    });
    await this.emitAbsenceEvent(
      WORKFORCE_ABSENCE_APPROVED,
      updated,
      approvedAt,
      actorUserId,
    );
    return updated;
  }

  async reject(
    organizationId: string,
    id: string,
    actorUserId: string,
    dto: RejectWorkforceAbsenceDto,
  ) {
    const row = await this.getOne(organizationId, id);
    if (row.status !== WorkforceAbsenceStatus.SUBMITTED) {
      throw new BadRequestException("Only SUBMITTED absences can be rejected");
    }
    const updated = await this.prisma.workforceAbsence.update({
      where: { id },
      data: {
        status: WorkforceAbsenceStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedByUserId: actorUserId,
        rejectionReason: (dto.rejectionReason ?? "").trim() || null,
      },
      include: { employment: true },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ABSENCE_REJECTED",
      entityType: "ABSENCE",
      entityId: id,
      payload: { rejectionReason: updated.rejectionReason },
    });
    return updated;
  }

  async cancel(organizationId: string, id: string, actorUserId: string) {
    const row = await this.getOne(organizationId, id);
    if (row.status !== WorkforceAbsenceStatus.APPROVED) {
      throw new BadRequestException("Only APPROVED absences can be cancelled");
    }
    const cancelledAt = new Date();
    const updated = await this.prisma.workforceAbsence.update({
      where: { id },
      data: {
        status: WorkforceAbsenceStatus.CANCELLED,
        cancelledAt,
        cancelledByUserId: actorUserId,
      },
      include: { employment: true },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ABSENCE_CANCELLED",
      entityType: "ABSENCE",
      entityId: id,
    });
    await this.emitAbsenceEvent(
      WORKFORCE_ABSENCE_CANCELLED,
      updated,
      cancelledAt,
      actorUserId,
    );
    return updated;
  }

  async update(
    organizationId: string,
    id: string,
    actorUserId: string,
    dto: UpdateWorkforceAbsenceDto,
  ) {
    const row = await this.getOne(organizationId, id);
    if (
      row.status !== WorkforceAbsenceStatus.DRAFT &&
      row.status !== WorkforceAbsenceStatus.SUBMITTED &&
      row.status !== WorkforceAbsenceStatus.APPROVED
    ) {
      throw new BadRequestException("Absence cannot be edited in this status");
    }

    const start = dto.startDate ? parseDateOnly(dto.startDate) : row.startDate;
    const end = dto.endDate ? parseDateOnly(dto.endDate) : row.endDate;
    this.assertDateRange(start, end);
    await this.assertNoOverlap(
      organizationId,
      row.employmentId,
      start,
      end,
      id,
    );

    const kindChanged =
      dto.kind != null && dto.kind !== row.kind;
    const datesChanged =
      dto.startDate != null || dto.endDate != null
        ? isoDay(start) !== isoDay(row.startDate) ||
          isoDay(end) !== isoDay(row.endDate)
        : false;

    const updated = await this.prisma.workforceAbsence.update({
      where: { id },
      data: {
        ...(dto.kind != null ? { kind: dto.kind } : {}),
        ...(dto.startDate != null ? { startDate: start } : {}),
        ...(dto.endDate != null ? { endDate: end } : {}),
        ...(dto.note != null ? { note: dto.note.trim() } : {}),
      },
      include: { employment: true },
    });

    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ABSENCE_UPDATED",
      entityType: "ABSENCE",
      entityId: id,
      payload: dto as unknown as Record<string, unknown>,
    });

    if (
      row.status === WorkforceAbsenceStatus.APPROVED &&
      (kindChanged || datesChanged)
    ) {
      await this.emitAbsenceEvent(
        WORKFORCE_ABSENCE_UPDATED,
        updated,
        updated.approvedAt ?? new Date(),
        actorUserId,
      );
    }

    return updated;
  }

  private assertDateRange(start: Date, end: Date): void {
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException("endDate must be on or after startDate");
    }
  }

  private async assertNoOverlap(
    organizationId: string,
    employmentId: string,
    start: Date,
    end: Date,
    excludeId: string | null,
  ): Promise<void> {
    const overlap = await this.prisma.workforceAbsence.findFirst({
      where: {
        organizationId,
        employmentId,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        status: {
          in: [
            WorkforceAbsenceStatus.SUBMITTED,
            WorkforceAbsenceStatus.APPROVED,
          ],
        },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlap) {
      throw new BadRequestException({
        code: "ABSENCE_OVERLAP",
        message: "Overlapping absence exists for this employment",
        conflict: {
          id: overlap.id,
          kind: overlap.kind,
          startDate: isoDay(overlap.startDate),
          endDate: isoDay(overlap.endDate),
        },
      });
    }
  }

  private async emitAbsenceEvent(
    type:
      | typeof WORKFORCE_ABSENCE_APPROVED
      | typeof WORKFORCE_ABSENCE_CANCELLED
      | typeof WORKFORCE_ABSENCE_UPDATED,
    absence: {
      id: string;
      organizationId: string;
      employmentId: string;
      kind: WorkforceAbsenceKind;
      startDate: Date;
      endDate: Date;
      note: string;
      employment: {
        globalPersonId: string;
        financeEmployeeId: string | null;
      };
    },
    actionAt: Date,
    actorUserId: string,
  ): Promise<void> {
    const payload = {
      cpAbsenceId: absence.id,
      organizationId: absence.organizationId,
      employmentId: absence.employmentId,
      globalPersonId: absence.employment.globalPersonId,
      ...(absence.employment.financeEmployeeId
        ? { financeEmployeeId: absence.employment.financeEmployeeId }
        : {}),
      kind: absence.kind as "VACATION" | "SICK" | "UNPAID",
      startDate: isoDay(absence.startDate),
      endDate: isoDay(absence.endDate),
      note: absence.note || undefined,
      ...(type === WORKFORCE_ABSENCE_APPROVED ||
      type === WORKFORCE_ABSENCE_UPDATED
        ? {
            approvedAt: actionAt.toISOString(),
            approvedByUserId: actorUserId,
          }
        : {}),
      ...(type === WORKFORCE_ABSENCE_CANCELLED
        ? {
            cancelledAt: actionAt.toISOString(),
            cancelledByUserId: actorUserId,
          }
        : {}),
    };

    const correlationId = `${absence.id}:${type}:${actionAt.getTime()}`;
    await this.satelliteEvents.enqueue({
      type,
      organizationId: absence.organizationId,
      correlationId,
      occurredAt: actionAt.toISOString(),
      globalPersonId: absence.employment.globalPersonId,
      payload,
    });
  }
}
