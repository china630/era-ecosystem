import { z } from "zod";

/** Vendor-agnostic attendance punch direction (Wave 6 + Wave 10 breaks). */
export const workforceAttendanceDirectionSchema = z.enum([
  "IN",
  "OUT",
  "BREAK_START",
  "BREAK_END",
]);
export type WorkforceAttendanceDirection = z.infer<
  typeof workforceAttendanceDirectionSchema
>;

/** ISO UTC or offset; also accepts bare ISO that Date.parse can read. */
export const workforceAttendanceOccurredAtSchema = z
  .string()
  .trim()
  .min(10)
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "occurredAt must be a parseable ISO datetime",
  });

/**
 * Single punch from tablet / FaceID / CSV / phone (Wave 9 optional GPS).
 * `personRef` is vendor staff id / FIN / badge — mapped via WorkforceAttendanceIdentity.
 */
export const workforceAttendancePunchItemSchema = z.object({
  occurredAt: workforceAttendanceOccurredAtSchema,
  direction: workforceAttendanceDirectionSchema,
  personRef: z.string().trim().min(1).max(128),
  externalId: z.string().trim().min(1).max(128).optional(),
  /** Override device place when device is shared across posts. */
  placeCode: z.string().trim().min(1).max(64).optional(),
  /** Wave 9 phone GPS at punch time only; omit = geofence check skipped. */
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
export type WorkforceAttendancePunchItem = z.infer<
  typeof workforceAttendancePunchItemSchema
>;

export const workforceAttendancePunchBatchSchema = z.object({
  punches: z.array(workforceAttendancePunchItemSchema).min(1).max(500),
});
export type WorkforceAttendancePunchBatch = z.infer<
  typeof workforceAttendancePunchBatchSchema
>;

export const WORKFORCE_ATTENDANCE_TOKEN_PREFIX = "att_";

export const workforceAttendanceReviewStatusSchema = z.enum([
  "CLEAR",
  "SUSPICIOUS",
  "ACCEPTED",
]);

export const workforceAttendanceReviewReasonSchema = z.enum([
  "OUTSIDE_RADIUS",
  "OUTSIDE_WINDOW",
  "MULTI_PLACE",
]);
