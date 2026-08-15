import { Injectable, Logger } from "@nestjs/common";
import {
  satelliteWorkforceAbsenceApprovedSchema,
  satelliteWorkforceAbsenceCancelledSchema,
  satelliteWorkforceAbsenceUpdatedSchema,
  type SatelliteWorkforceAbsenceApprovedEvent,
  type SatelliteWorkforceAbsenceCancelledEvent,
  type SatelliteWorkforceAbsenceUpdatedEvent,
} from "@era/contracts";
import { AbsenceSource } from "@erafinance/database";
import { AbsenceTypesService } from "../hr/absence-types.service";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";

type WorkforceKind =
  | "VACATION"
  | "SICK"
  | "UNPAID"
  | "SOCIAL_LEAVE"
  | "EDUCATIONAL_LEAVE"
  | "BUSINESS_TRIP"
  | "ADMINISTRATIVE";

/**
 * Orchestrator absence kind → Finance AbsenceType.code (seeded by AbsenceTypesService,
 * TK AZ set). ADMINISTRATIVE is unpaid leave, so it reuses UNPAID_LEAVE. BUSINESS_TRIP
 * is an attendance record (employee stays paid, off-site), not a payroll leave, so it has
 * no Finance mirror and is intentionally omitted (see upsertMirror skip).
 */
const KIND_TO_CODE: Partial<Record<WorkforceKind, string>> = {
  VACATION: "LABOR_LEAVE",
  SICK: "SICK_LEAVE",
  UNPAID: "UNPAID_LEAVE",
  SOCIAL_LEAVE: "SOCIAL_LEAVE",
  EDUCATIONAL_LEAVE: "EDUCATIONAL_LEAVE",
  ADMINISTRATIVE: "UNPAID_LEAVE",
};

function parseDateOnly(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

@Injectable()
export class WorkforceAbsenceSyncService {
  private readonly logger = new Logger(WorkforceAbsenceSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly absenceTypes: AbsenceTypesService,
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async handleApproved(
    organizationId: string,
    raw: unknown,
  ): Promise<{ meta?: Record<string, unknown> }> {
    const event = satelliteWorkforceAbsenceApprovedSchema.parse(raw);
    return this.upsertMirror(organizationId, event);
  }

  async handleUpdated(
    organizationId: string,
    raw: unknown,
  ): Promise<{ meta?: Record<string, unknown> }> {
    const event = satelliteWorkforceAbsenceUpdatedSchema.parse(raw);
    return this.upsertMirror(organizationId, event);
  }

  async handleCancelled(
    organizationId: string,
    raw: unknown,
  ): Promise<{ meta?: Record<string, unknown> }> {
    const event = satelliteWorkforceAbsenceCancelledSchema.parse(raw);
    if (!(await this.hasHrFull(organizationId))) {
      this.logger.log(
        `Skip WORKFORCE_ABSENCE_CANCELLED org=${organizationId} (no hr_full)`,
      );
      return { meta: { skipped: true, reason: "no_hr_full" } };
    }

    const cpAbsenceId = event.payload.cpAbsenceId;
    const existing = await this.prisma.absence.findFirst({
      where: { organizationId, cpAbsenceId },
    });
    if (!existing) {
      return { meta: { skipped: true, reason: "mirror_not_found" } };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.absence.update({
        where: { id: existing.id },
        data: {
          approved: false,
          deletedAt: new Date(),
          deletedReason: "CP_CANCELLED",
        },
      });
      await tx.timesheetEntry.updateMany({
        where: {
          employeeId: existing.employeeId,
          lockedFromAbsence: true,
          dayDate: { gte: existing.startDate, lte: existing.endDate },
        },
        data: { lockedFromAbsence: false },
      });
    });

    return { meta: { cpAbsenceId, action: "cancelled" } };
  }

  private async upsertMirror(
    organizationId: string,
    event:
      | SatelliteWorkforceAbsenceApprovedEvent
      | SatelliteWorkforceAbsenceUpdatedEvent,
  ): Promise<{ meta?: Record<string, unknown> }> {
    if (!(await this.hasHrFull(organizationId))) {
      this.logger.log(
        `Skip ${event.type} org=${organizationId} (no hr_full)`,
      );
      return { meta: { skipped: true, reason: "no_hr_full" } };
    }

    const payload = event.payload;
    const employeeId = payload.financeEmployeeId?.trim();
    if (!employeeId) {
      this.logger.warn(
        `Skip ${event.type} cpAbsence=${payload.cpAbsenceId}: no financeEmployeeId`,
      );
      return { meta: { skipped: true, reason: "no_finance_employee" } };
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });
    if (!employee) {
      this.logger.warn(
        `Skip ${event.type}: employee ${employeeId} not found in org ${organizationId}`,
      );
      return { meta: { skipped: true, reason: "employee_not_found" } };
    }

    if (!KIND_TO_CODE[payload.kind as WorkforceKind]) {
      this.logger.log(
        `Skip ${event.type} cpAbsence=${payload.cpAbsenceId}: kind ${payload.kind} is not a payroll leave`,
      );
      return {
        meta: { skipped: true, reason: "kind_not_payroll_leave", kind: payload.kind },
      };
    }
    const absenceTypeId = await this.resolveAbsenceTypeId(
      organizationId,
      payload.kind as WorkforceKind,
    );
    const startDate = parseDateOnly(payload.startDate);
    const endDate = parseDateOnly(payload.endDate);

    const row = await this.prisma.absence.upsert({
      where: { cpAbsenceId: payload.cpAbsenceId },
      create: {
        organizationId,
        employeeId,
        absenceTypeId,
        startDate,
        endDate,
        note: (payload.note ?? "").trim(),
        approved: true,
        cpAbsenceId: payload.cpAbsenceId,
        cpEmploymentId: payload.employmentId,
        source: AbsenceSource.CP_EVENT,
      },
      update: {
        employeeId,
        absenceTypeId,
        startDate,
        endDate,
        note: (payload.note ?? "").trim(),
        approved: true,
        cpEmploymentId: payload.employmentId,
        deletedAt: null,
        deletedReason: null,
        source: AbsenceSource.CP_EVENT,
      },
    });

    return {
      meta: {
        cpAbsenceId: payload.cpAbsenceId,
        absenceId: row.id,
        action: "upserted",
      },
    };
  }

  private async hasHrFull(organizationId: string): Promise<boolean> {
    return this.subscriptionAccess.hasModule(
      organizationId,
      ModuleEntitlement.HR_FULL,
    );
  }

  private async resolveAbsenceTypeId(
    organizationId: string,
    kind: WorkforceKind,
  ): Promise<string> {
    const code = KIND_TO_CODE[kind];
    if (!code) {
      throw new Error(`Absence kind ${kind} has no Finance mapping`);
    }
    const types = await this.absenceTypes.listOrSeed(organizationId);
    const match = types.find((t) => t.code === code);
    if (!match) {
      throw new Error(`Absence type ${code} missing for org ${organizationId}`);
    }
    return match.id;
  }
}
