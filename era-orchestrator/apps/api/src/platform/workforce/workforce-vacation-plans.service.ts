import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WORKFORCE_VACATION_PLAN_APPROVED } from "@era/contracts";
import {
  WorkforceEmploymentStatus,
  WorkforceVacationPlanStatus,
} from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { SatelliteEventsService } from "../../satellite-events/satellite-events.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import type {
  CreateWorkforceVacationPlanDto,
  ListWorkforceVacationPlansQueryDto,
  RejectWorkforceVacationPlanDto,
  UpdateWorkforceVacationPlanDto,
  VacationPlanLineDto,
} from "./dto/workforce-vacation-plan.dto";

function parseDateOnly(iso: string): Date {
  const d = iso.slice(0, 10);
  return new Date(`${d}T00:00:00.000Z`);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class WorkforceVacationPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly audit: WorkforceAuditService,
    private readonly satelliteEvents: SatelliteEventsService,
    private readonly scopeService: WorkforceScopeService,
  ) {}

  async list(
    organizationId: string,
    query: ListWorkforceVacationPlansQueryDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scopeService.resolveScopeForCommercialOrg(organizationId);
    const scope = link.workforceScope;
    return this.prisma.workforceVacationPlan.findMany({
      where: {
        workforceScopeId: scope.id,
        ...(query.year != null ? { year: query.year } : {}),
        ...(query.orgUnitId ? { orgUnitId: query.orgUnitId } : {}),
      },
      include: {
        orgUnit: true,
        lines: { include: { employment: true } },
      },
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    });
  }

  async getOne(organizationId: string, id: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scopeService.resolveScopeForCommercialOrg(organizationId);
    const scope = link.workforceScope;
    const row = await this.prisma.workforceVacationPlan.findFirst({
      where: { id, workforceScopeId: scope.id },
      include: {
        orgUnit: true,
        lines: { include: { employment: true } },
      },
    });
    if (!row) throw new NotFoundException("Vacation plan not found");
    return row;
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateWorkforceVacationPlanDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scopeService.resolveScopeForCommercialOrg(organizationId);
    const scope = link.workforceScope;
    await this.assertLines(organizationId, scope.id, dto.orgUnitId, dto.lines);

    const submit = dto.submit === true;
    const now = new Date();
    const row = await this.prisma.workforceVacationPlan.create({
      data: {
        workforceScopeId: scope.id,
        year: dto.year,
        orgUnitId: dto.orgUnitId ?? null,
        status: submit
          ? WorkforceVacationPlanStatus.SUBMITTED
          : WorkforceVacationPlanStatus.DRAFT,
        submittedByUserId: submit ? actorUserId : null,
        submittedAt: submit ? now : null,
        lines: {
          create: dto.lines.map((l) => ({
            employmentId: l.employmentId,
            startDate: parseDateOnly(l.startDate),
            endDate: parseDateOnly(l.endDate),
            days: l.days,
          })),
        },
      },
      include: { lines: true, orgUnit: true },
    });

    await this.audit.log({
      organizationId,
      workforceScopeId: scope.id,
      actorUserId,
      action: submit ? "VACATION_PLAN_SUBMITTED" : "VACATION_PLAN_CREATED",
      entityType: "WorkforceVacationPlan",
      entityId: row.id,
      payload: { year: row.year, orgUnitId: row.orgUnitId },
    });

    return row;
  }

  async update(
    organizationId: string,
    id: string,
    actorUserId: string,
    dto: UpdateWorkforceVacationPlanDto,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const existing = await this.getOne(organizationId, id);
    if (
      existing.status !== WorkforceVacationPlanStatus.DRAFT &&
      existing.status !== WorkforceVacationPlanStatus.REJECTED
    ) {
      throw new BadRequestException("Only DRAFT/REJECTED plans can be edited");
    }
    if (!dto.lines) return existing;

    await this.assertLines(
      organizationId,
      existing.workforceScopeId,
      existing.orgUnitId ?? undefined,
      dto.lines,
    );

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.workforceVacationPlanLine.deleteMany({ where: { planId: id } });
      return tx.workforceVacationPlan.update({
        where: { id },
        data: {
          status: WorkforceVacationPlanStatus.DRAFT,
          rejectedAt: null,
          rejectionReason: null,
          lines: {
            create: dto.lines!.map((l) => ({
              employmentId: l.employmentId,
              startDate: parseDateOnly(l.startDate),
              endDate: parseDateOnly(l.endDate),
              days: l.days,
            })),
          },
        },
        include: { lines: true, orgUnit: true },
      });
    });

    await this.audit.log({
      organizationId,
      workforceScopeId: existing.workforceScopeId,
      actorUserId,
      action: "VACATION_PLAN_UPDATED",
      entityType: "WorkforceVacationPlan",
      entityId: id,
      payload: { lineCount: dto.lines.length },
    });

    return row;
  }

  async submit(organizationId: string, id: string, actorUserId: string) {
    const existing = await this.getOne(organizationId, id);
    if (
      existing.status !== WorkforceVacationPlanStatus.DRAFT &&
      existing.status !== WorkforceVacationPlanStatus.REJECTED
    ) {
      throw new BadRequestException("Only DRAFT/REJECTED plans can be submitted");
    }
    const now = new Date();
    const row = await this.prisma.workforceVacationPlan.update({
      where: { id },
      data: {
        status: WorkforceVacationPlanStatus.SUBMITTED,
        submittedByUserId: actorUserId,
        submittedAt: now,
        rejectedAt: null,
        rejectionReason: null,
      },
      include: { lines: true, orgUnit: true },
    });

    await this.audit.log({
      organizationId,
      workforceScopeId: existing.workforceScopeId,
      actorUserId,
      action: "VACATION_PLAN_SUBMITTED",
      entityType: "WorkforceVacationPlan",
      entityId: id,
      payload: {},
    });

    return row;
  }

  async approve(organizationId: string, id: string, actorUserId: string) {
    const existing = await this.getOne(organizationId, id);
    if (existing.status !== WorkforceVacationPlanStatus.SUBMITTED) {
      throw new BadRequestException("Only SUBMITTED plans can be approved");
    }
    const now = new Date();
    const row = await this.prisma.workforceVacationPlan.update({
      where: { id },
      data: {
        status: WorkforceVacationPlanStatus.APPROVED,
        approvedByUserId: actorUserId,
        approvedAt: now,
      },
      include: {
        lines: { include: { employment: true } },
        orgUnit: true,
      },
    });

    await this.audit.log({
      organizationId,
      workforceScopeId: existing.workforceScopeId,
      actorUserId,
      action: "VACATION_PLAN_APPROVED",
      entityType: "WorkforceVacationPlan",
      entityId: id,
      payload: {},
    });

    await this.emitApproved(organizationId, row, now, actorUserId);
    return row;
  }

  async reject(
    organizationId: string,
    id: string,
    actorUserId: string,
    dto: RejectWorkforceVacationPlanDto,
  ) {
    const existing = await this.getOne(organizationId, id);
    if (existing.status !== WorkforceVacationPlanStatus.SUBMITTED) {
      throw new BadRequestException("Only SUBMITTED plans can be rejected");
    }
    const now = new Date();
    const row = await this.prisma.workforceVacationPlan.update({
      where: { id },
      data: {
        status: WorkforceVacationPlanStatus.REJECTED,
        rejectedAt: now,
        rejectionReason: (dto.rejectionReason ?? "").trim() || null,
      },
      include: { lines: true, orgUnit: true },
    });

    await this.audit.log({
      organizationId,
      workforceScopeId: existing.workforceScopeId,
      actorUserId,
      action: "VACATION_PLAN_REJECTED",
      entityType: "WorkforceVacationPlan",
      entityId: id,
      payload: { rejectionReason: row.rejectionReason },
    });

    return row;
  }

  private async assertLines(
    organizationId: string,
    workforceScopeId: string,
    orgUnitId: string | undefined,
    lines: VacationPlanLineDto[],
  ) {
    for (const line of lines) {
      const start = parseDateOnly(line.startDate);
      const end = parseDateOnly(line.endDate);
      if (end < start) {
        throw new BadRequestException("endDate must be >= startDate");
      }
      const emp = await this.prisma.workforceEmployment.findFirst({
        where: {
          id: line.employmentId,
          organizationId,
          workforceScopeId,
          status: WorkforceEmploymentStatus.ACTIVE,
          ...(orgUnitId ? { orgUnitId } : {}),
        },
      });
      if (!emp) {
        throw new BadRequestException(
          `Active employment required: ${line.employmentId}`,
        );
      }
    }
  }

  private async emitApproved(
    organizationId: string,
    plan: {
      id: string;
      year: number;
      orgUnitId: string | null;
      lines: Array<{
        employmentId: string;
        startDate: Date;
        endDate: Date;
        days: number;
        employment: {
          globalPersonId: string;
          financeEmployeeId: string | null;
        };
      }>;
    },
    approvedAt: Date,
    actorUserId: string,
  ) {
    const payload = {
      cpVacationPlanId: plan.id,
      organizationId,
      year: plan.year,
      orgUnitId: plan.orgUnitId ?? undefined,
      approvedAt: approvedAt.toISOString(),
      approvedByUserId: actorUserId,
      lines: plan.lines.map((l) => ({
        employmentId: l.employmentId,
        globalPersonId: l.employment.globalPersonId,
        ...(l.employment.financeEmployeeId
          ? { financeEmployeeId: l.employment.financeEmployeeId }
          : {}),
        startDate: isoDay(l.startDate),
        endDate: isoDay(l.endDate),
        days: l.days,
      })),
    };

    await this.satelliteEvents.enqueue({
      type: WORKFORCE_VACATION_PLAN_APPROVED,
      organizationId,
      correlationId: `${plan.id}:APPROVED:${approvedAt.getTime()}`,
      occurredAt: approvedAt.toISOString(),
      payload,
    });
  }
}
