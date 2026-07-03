import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  WORKFORCE_TIMESHEET_APPROVED,
  satelliteWorkforceTimesheetBatchImportedSchema,
} from "@era/contracts";
import { Prisma } from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { SatelliteEventsService } from "../../satellite-events/satellite-events.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceScopeService } from "./workforce-scope.service";

function parseDateOnly(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

@Injectable()
export class WorkforceTimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly scope: WorkforceScopeService,
    private readonly audit: WorkforceAuditService,
    private readonly satelliteEvents: SatelliteEventsService,
  ) {}

  async handleBatchImported(raw: unknown): Promise<{ created: number }> {
    const event = satelliteWorkforceTimesheetBatchImportedSchema.parse(raw);
    const organizationId = event.payload.organizationId;
    await this.entitlement.assertWorkforceHub(organizationId);
    let created = 0;

    for (const row of event.payload.entries) {
      if (!row.cpEmploymentId) continue;
      const employment = await this.prisma.workforceEmployment.findFirst({
        where: { id: row.cpEmploymentId, organizationId, status: "ACTIVE" },
      });
      if (!employment) continue;
      await this.prisma.workforceTimesheetEntry.create({
        data: {
          organizationId,
          employmentId: employment.id,
          workDate: parseDateOnly(row.workDate),
          hours: new Prisma.Decimal(row.hours),
          source: "construction_csv",
          sourceRef: row.sourceEntryId ?? row.workerRef,
          status: "DRAFT",
        },
      });
      created += 1;
    }
    return { created };
  }

  async listDraft(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    return this.prisma.workforceTimesheetEntry.findMany({
      where: { organizationId, status: "DRAFT" },
      include: {
        employment: { include: { orgUnit: true, position: true } },
      },
      orderBy: { workDate: "asc" },
      take: 500,
    });
  }

  async approveBatch(
    organizationId: string,
    actorUserId: string,
    entryIds: string[],
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const entries = await this.prisma.workforceTimesheetEntry.findMany({
      where: {
        id: { in: entryIds },
        organizationId,
        status: "DRAFT",
      },
      include: { employment: true },
    });
    if (entries.length === 0) {
      throw new BadRequestException("No draft timesheet entries to approve");
    }

    const approvedAt = new Date().toISOString();
    await this.prisma.workforceTimesheetEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { status: "APPROVED" },
    });

    const rows = entries.map((e) => ({
      cpTimesheetEntryId: e.id,
      cpEmploymentId: e.employmentId,
      globalPersonId: e.employment.globalPersonId,
      financeEmployeeId: e.employment.financeEmployeeId ?? undefined,
      workDate: e.workDate.toISOString().slice(0, 10),
      hours: Number(e.hours),
    }));

    await this.audit.log({
      organizationId,
      workforceScopeId: link.workforceScopeId,
      actorUserId,
      action: "TIMESHEET_APPROVE",
      entityType: "TIMESHEET_BATCH",
      entityId: entryIds.join(","),
      payload: { count: entries.length },
    });

    await this.satelliteEvents.enqueue({
      type: WORKFORCE_TIMESHEET_APPROVED,
      organizationId: link.workforceScope.anchorOrganizationId,
      correlationId: `ts-approve:${Date.now()}`,
      occurredAt: approvedAt,
      payload: {
        organizationId: link.workforceScope.anchorOrganizationId,
        cpTimesheetEntryIds: entries.map((e) => e.id),
        approvedByUserId: actorUserId,
        approvedAt,
        rows,
      },
    });

    return { approved: entries.length };
  }

  async getEntry(organizationId: string, id: string) {
    const row = await this.prisma.workforceTimesheetEntry.findFirst({
      where: { id, organizationId },
      include: { employment: true },
    });
    if (!row) throw new NotFoundException("Timesheet entry not found");
    return row;
  }
}
