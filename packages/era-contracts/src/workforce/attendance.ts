import { z } from "zod";

/** Vendor-agnostic attendance punch direction (Wave 6). */
export const workforceAttendanceDirectionSchema = z.enum(["IN", "OUT"]);
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
 * Single punch from tablet / FaceID / CSV.
 * `personRef` is vendor staff id / FIN / badge — mapped via WorkforceAttendanceIdentity.
 */
export const workforceAttendancePunchItemSchema = z.object({
  occurredAt: workforceAttendanceOccurredAtSchema,
  direction: workforceAttendanceDirectionSchema,
  personRef: z.string().trim().min(1).max(128),
  externalId: z.string().trim().min(1).max(128).optional(),
  /** Override device place when device is shared across posts. */
  placeCode: z.string().trim().min(1).max(64).optional(),
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
