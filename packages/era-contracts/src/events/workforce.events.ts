import { z } from "zod";
import { satelliteEventBaseSchema } from "./common";

export const WORKFORCE_ABSENCE_APPROVED = "WORKFORCE_ABSENCE_APPROVED" as const;
export const WORKFORCE_ABSENCE_CANCELLED = "WORKFORCE_ABSENCE_CANCELLED" as const;
export const WORKFORCE_ABSENCE_UPDATED = "WORKFORCE_ABSENCE_UPDATED" as const;

export const workforceAbsenceKindSchema = z.enum([
  "VACATION",
  "SICK",
  "UNPAID",
  "SOCIAL_LEAVE",
  "EDUCATIONAL_LEAVE",
  "BUSINESS_TRIP",
  "ADMINISTRATIVE",
]);

export const workforceAbsenceEventPayloadSchema = z.object({
  cpAbsenceId: z.string().uuid(),
  organizationId: z.string().uuid(),
  employmentId: z.string().uuid(),
  globalPersonId: z.string().uuid(),
  financeEmployeeId: z.string().uuid().optional(),
  kind: workforceAbsenceKindSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
  approvedAt: z.string().min(1).optional(),
  approvedByUserId: z.string().uuid().optional(),
  cancelledAt: z.string().min(1).optional(),
  cancelledByUserId: z.string().uuid().optional(),
});

export const satelliteWorkforceAbsenceApprovedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(WORKFORCE_ABSENCE_APPROVED),
    globalPersonId: z.string().uuid(),
    payload: workforceAbsenceEventPayloadSchema,
  });

export const satelliteWorkforceAbsenceCancelledSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(WORKFORCE_ABSENCE_CANCELLED),
    globalPersonId: z.string().uuid(),
    payload: workforceAbsenceEventPayloadSchema,
  });

export const satelliteWorkforceAbsenceUpdatedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(WORKFORCE_ABSENCE_UPDATED),
    globalPersonId: z.string().uuid(),
    payload: workforceAbsenceEventPayloadSchema,
  });

export type SatelliteWorkforceAbsenceApprovedEvent = z.infer<
  typeof satelliteWorkforceAbsenceApprovedSchema
>;
export type SatelliteWorkforceAbsenceCancelledEvent = z.infer<
  typeof satelliteWorkforceAbsenceCancelledSchema
>;
export type SatelliteWorkforceAbsenceUpdatedEvent = z.infer<
  typeof satelliteWorkforceAbsenceUpdatedSchema
>;

export function isSatelliteWorkforceAbsenceApproved(
  data: unknown,
): data is SatelliteWorkforceAbsenceApprovedEvent {
  return satelliteWorkforceAbsenceApprovedSchema.safeParse(data).success;
}

export function isSatelliteWorkforceAbsenceCancelled(
  data: unknown,
): data is SatelliteWorkforceAbsenceCancelledEvent {
  return satelliteWorkforceAbsenceCancelledSchema.safeParse(data).success;
}

export function isSatelliteWorkforceAbsenceUpdated(
  data: unknown,
): data is SatelliteWorkforceAbsenceUpdatedEvent {
  return satelliteWorkforceAbsenceUpdatedSchema.safeParse(data).success;
}

export function isWorkforceAbsenceOutboundEvent(data: unknown): boolean {
  return (
    isSatelliteWorkforceAbsenceApproved(data) ||
    isSatelliteWorkforceAbsenceCancelled(data) ||
    isSatelliteWorkforceAbsenceUpdated(data)
  );
}

export const WORKFORCE_ORG_UNIT_UPSERTED = "WORKFORCE_ORG_UNIT_UPSERTED" as const;
export const WORKFORCE_ORG_UNIT_ARCHIVED = "WORKFORCE_ORG_UNIT_ARCHIVED" as const;
export const WORKFORCE_POSITION_UPSERTED = "WORKFORCE_POSITION_UPSERTED" as const;
export const WORKFORCE_EMPLOYMENT_TRANSFERRED = "WORKFORCE_EMPLOYMENT_TRANSFERRED" as const;
export const WORKFORCE_EMPLOYMENT_HIRED = "WORKFORCE_EMPLOYMENT_HIRED" as const;
export const WORKFORCE_EMPLOYMENT_TERMINATED = "WORKFORCE_EMPLOYMENT_TERMINATED" as const;

export const workforceOrgUnitPayloadSchema = z.object({
  cpOrgUnitId: z.string().uuid(),
  workforceScopeId: z.string().uuid(),
  anchorOrganizationId: z.string().uuid(),
  parentCpOrgUnitId: z.string().uuid().optional(),
  name: z.string().min(1),
  code: z.string().optional(),
  costCenterCode: z.string().optional(),
  managerEmploymentId: z.string().uuid().optional(),
});

export const workforcePositionPayloadSchema = z.object({
  cpPositionId: z.string().uuid(),
  cpOrgUnitId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().optional(),
  totalSlots: z.number().int().positive(),
});

export const workforceEmploymentTransferPayloadSchema = z.object({
  cpEmploymentId: z.string().uuid(),
  organizationId: z.string().uuid(),
  globalPersonId: z.string().uuid(),
  financeEmployeeId: z.string().uuid().optional(),
  fromOrgUnitId: z.string().uuid().optional(),
  toOrgUnitId: z.string().uuid(),
  fromPositionId: z.string().uuid().optional(),
  toPositionId: z.string().uuid(),
});

export const workforceEmploymentHiredPayloadSchema = z.object({
  cpEmploymentId: z.string().uuid(),
  organizationId: z.string().uuid(),
  globalPersonId: z.string().uuid(),
  orgUnitId: z.string().uuid(),
  positionId: z.string().uuid(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fullName: z.string().min(1),
  positionTitle: z.string().optional(),
  orgUnitName: z.string().optional(),
  financeEmployeeId: z.string().uuid().optional(),
});

export const workforceEmploymentTerminatedPayloadSchema = z.object({
  cpEmploymentId: z.string().uuid(),
  organizationId: z.string().uuid(),
  globalPersonId: z.string().uuid(),
  financeEmployeeId: z.string().uuid().optional(),
});

export const satelliteWorkforceOrgUnitUpsertedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(WORKFORCE_ORG_UNIT_UPSERTED),
    payload: workforceOrgUnitPayloadSchema,
  });

export const satelliteWorkforceOrgUnitArchivedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(WORKFORCE_ORG_UNIT_ARCHIVED),
    payload: workforceOrgUnitPayloadSchema,
  });

export const satelliteWorkforcePositionUpsertedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(WORKFORCE_POSITION_UPSERTED),
    payload: workforcePositionPayloadSchema,
  });

export const satelliteWorkforceEmploymentTransferredSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(WORKFORCE_EMPLOYMENT_TRANSFERRED),
    globalPersonId: z.string().uuid(),
    payload: workforceEmploymentTransferPayloadSchema,
  });

export const satelliteWorkforceEmploymentHiredSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(WORKFORCE_EMPLOYMENT_HIRED),
    globalPersonId: z.string().uuid(),
    payload: workforceEmploymentHiredPayloadSchema,
  });

export const satelliteWorkforceEmploymentTerminatedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(WORKFORCE_EMPLOYMENT_TERMINATED),
    globalPersonId: z.string().uuid(),
    payload: workforceEmploymentTerminatedPayloadSchema,
  });

export function isSatelliteWorkforceOrgUnitUpserted(
  data: unknown,
): data is z.infer<typeof satelliteWorkforceOrgUnitUpsertedSchema> {
  return satelliteWorkforceOrgUnitUpsertedSchema.safeParse(data).success;
}

export function isSatelliteWorkforceOrgUnitArchived(
  data: unknown,
): data is z.infer<typeof satelliteWorkforceOrgUnitArchivedSchema> {
  return satelliteWorkforceOrgUnitArchivedSchema.safeParse(data).success;
}

export function isSatelliteWorkforcePositionUpserted(
  data: unknown,
): data is z.infer<typeof satelliteWorkforcePositionUpsertedSchema> {
  return satelliteWorkforcePositionUpsertedSchema.safeParse(data).success;
}

export function isSatelliteWorkforceEmploymentTransferred(
  data: unknown,
): data is z.infer<typeof satelliteWorkforceEmploymentTransferredSchema> {
  return satelliteWorkforceEmploymentTransferredSchema.safeParse(data).success;
}

export function isSatelliteWorkforceEmploymentHired(
  data: unknown,
): data is z.infer<typeof satelliteWorkforceEmploymentHiredSchema> {
  return satelliteWorkforceEmploymentHiredSchema.safeParse(data).success;
}

export function isSatelliteWorkforceEmploymentTerminated(
  data: unknown,
): data is z.infer<typeof satelliteWorkforceEmploymentTerminatedSchema> {
  return satelliteWorkforceEmploymentTerminatedSchema.safeParse(data).success;
}

export function isWorkforceOrgOutboundEvent(data: unknown): boolean {
  return (
    isSatelliteWorkforceOrgUnitUpserted(data) ||
    isSatelliteWorkforceOrgUnitArchived(data) ||
    isSatelliteWorkforcePositionUpserted(data) ||
    isSatelliteWorkforceEmploymentTransferred(data) ||
    isSatelliteWorkforceEmploymentHired(data) ||
    isSatelliteWorkforceEmploymentTerminated(data)
  );
}

export const WORKFORCE_TIMESHEET_BATCH_IMPORTED =
  "WORKFORCE_TIMESHEET_BATCH_IMPORTED" as const;
export const WORKFORCE_TIMESHEET_APPROVED = "WORKFORCE_TIMESHEET_APPROVED" as const;

export const workforceTimesheetRowSchema = z.object({
  cpEmploymentId: z.string().uuid().optional(),
  workerRef: z.string().min(1),
  hours: z.number().min(0),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceEntryId: z.string().optional(),
});

export const workforceTimesheetBatchImportedPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  projectId: z.string().min(1),
  entries: z.array(workforceTimesheetRowSchema).min(1),
});

export const workforceTimesheetApprovedPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  cpTimesheetEntryIds: z.array(z.string().uuid()).min(1),
  approvedByUserId: z.string().uuid(),
  approvedAt: z.string().min(1),
  rows: z.array(
    z.object({
      cpTimesheetEntryId: z.string().uuid(),
      cpEmploymentId: z.string().uuid(),
      globalPersonId: z.string().uuid(),
      financeEmployeeId: z.string().uuid().optional(),
      workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      hours: z.number().min(0),
    }),
  ),
});

export const satelliteWorkforceTimesheetBatchImportedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(WORKFORCE_TIMESHEET_BATCH_IMPORTED),
    payload: workforceTimesheetBatchImportedPayloadSchema,
  });

export const satelliteWorkforceTimesheetApprovedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(WORKFORCE_TIMESHEET_APPROVED),
    globalPersonId: z.string().uuid().optional(),
    payload: workforceTimesheetApprovedPayloadSchema,
  });

export function isSatelliteWorkforceTimesheetBatchImported(
  data: unknown,
): data is z.infer<typeof satelliteWorkforceTimesheetBatchImportedSchema> {
  return satelliteWorkforceTimesheetBatchImportedSchema.safeParse(data).success;
}

export function isSatelliteWorkforceTimesheetApproved(
  data: unknown,
): data is z.infer<typeof satelliteWorkforceTimesheetApprovedSchema> {
  return satelliteWorkforceTimesheetApprovedSchema.safeParse(data).success;
}

export function isWorkforceTimesheetOutboundEvent(data: unknown): boolean {
  return isSatelliteWorkforceTimesheetApproved(data);
}

export const WORKFORCE_VACATION_PLAN_APPROVED =
  "WORKFORCE_VACATION_PLAN_APPROVED" as const;

export const workforceVacationPlanLineSchema = z.object({
  employmentId: z.string().uuid(),
  globalPersonId: z.string().uuid(),
  financeEmployeeId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().positive(),
});

export const workforceVacationPlanApprovedPayloadSchema = z.object({
  cpVacationPlanId: z.string().uuid(),
  organizationId: z.string().uuid(),
  year: z.number().int(),
  orgUnitId: z.string().uuid().optional(),
  approvedAt: z.string().min(1),
  approvedByUserId: z.string().uuid(),
  lines: z.array(workforceVacationPlanLineSchema).min(1),
});

export const satelliteWorkforceVacationPlanApprovedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(WORKFORCE_VACATION_PLAN_APPROVED),
    payload: workforceVacationPlanApprovedPayloadSchema,
  });

export type SatelliteWorkforceVacationPlanApprovedEvent = z.infer<
  typeof satelliteWorkforceVacationPlanApprovedSchema
>;

export function isSatelliteWorkforceVacationPlanApproved(
  data: unknown,
): data is SatelliteWorkforceVacationPlanApprovedEvent {
  return satelliteWorkforceVacationPlanApprovedSchema.safeParse(data).success;
}
