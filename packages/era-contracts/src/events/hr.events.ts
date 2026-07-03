import { z } from "zod";
import { satelliteEventBaseSchema } from "./common";

export const SATELLITE_STAFF_PROVISIONED = "STAFF_PROVISIONED" as const;
export const SATELLITE_STAFF_DEACTIVATED = "STAFF_DEACTIVATED" as const;
export const SATELLITE_STAFF_CLOCK_BATCH = "STAFF_CLOCK_BATCH" as const;

export const staffProvisionedPayloadSchema = z.object({
  cpEmploymentId: z.string().uuid(),
  financeEmployeeId: z.string().uuid().optional(),
  satelliteKey: z.string().min(1),
  satelliteRole: z.string().min(1),
  staffCode: z.string().min(1),
  fullName: z
    .string()
    .min(1)
    .describe("T3 ops cache stamp from MDM at provision time; not authoritative identity"),
  pin: z.string().optional(),
  login: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  positionTitle: z.string().optional(),
  orgUnitName: z.string().optional(),
  departmentName: z.string().optional(),
  roleBindingId: z.string().uuid().optional(),
});

export const staffDeactivatedPayloadSchema = z.object({
  cpEmploymentId: z.string().uuid(),
  financeEmployeeId: z.string().uuid().optional(),
  satelliteKey: z.string().min(1),
  staffCode: z.string().min(1),
  satelliteUserId: z.string().optional(),
  roleBindingId: z.string().uuid().optional(),
});

export const staffClockEventSchema = z.object({
  staffCode: z.string().min(1),
  eventType: z.enum(["CLOCK_IN", "CLOCK_OUT"]),
  clockedAt: z.string().min(1),
});

export const satelliteStaffProvisionedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_STAFF_PROVISIONED),
  payload: staffProvisionedPayloadSchema,
});

export const satelliteStaffDeactivatedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_STAFF_DEACTIVATED),
  payload: staffDeactivatedPayloadSchema,
});

export const satelliteStaffClockBatchSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_STAFF_CLOCK_BATCH),
  payload: z.object({
    satelliteKey: z.string().min(1),
    events: z.array(staffClockEventSchema).min(1),
  }),
});

export type SatelliteStaffProvisionedEvent = z.infer<
  typeof satelliteStaffProvisionedSchema
>;
export type SatelliteStaffDeactivatedEvent = z.infer<
  typeof satelliteStaffDeactivatedSchema
>;
export type SatelliteStaffClockBatchEvent = z.infer<
  typeof satelliteStaffClockBatchSchema
>;

export function isSatelliteStaffProvisioned(
  data: unknown,
): data is SatelliteStaffProvisionedEvent {
  return satelliteStaffProvisionedSchema.safeParse(data).success;
}

export function isSatelliteStaffDeactivated(
  data: unknown,
): data is SatelliteStaffDeactivatedEvent {
  return satelliteStaffDeactivatedSchema.safeParse(data).success;
}

export function isSatelliteStaffClockBatch(
  data: unknown,
): data is SatelliteStaffClockBatchEvent {
  return satelliteStaffClockBatchSchema.safeParse(data).success;
}

export function isFinanceOutboundStaffEvent(data: unknown): boolean {
  return isSatelliteStaffProvisioned(data) || isSatelliteStaffDeactivated(data);
}
