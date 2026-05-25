import { z } from "zod";
import { satelliteEventBaseSchema } from "./common";

export const SATELLITE_CLINIC_VISIT_COMPLETED =
  "SATELLITE_CLINIC_VISIT_COMPLETED" as const;

export const satelliteClinicVisitCompletedSchema = satelliteEventBaseSchema.extend(
  {
    type: z.literal(SATELLITE_CLINIC_VISIT_COMPLETED),
    payload: z.object({
      visitId: z.string(),
      patientRef: z.string(),
      serviceCodes: z.array(z.string()),
      amountNet: z.number(),
      currency: z.literal("AZN"),
    }),
  },
);

export type SatelliteClinicVisitCompletedEvent = z.infer<
  typeof satelliteClinicVisitCompletedSchema
>;

export function isSatelliteClinicVisitCompleted(
  data: unknown,
): data is SatelliteClinicVisitCompletedEvent {
  return satelliteClinicVisitCompletedSchema.safeParse(data).success;
}

export const SATELLITE_CLINIC_LAB_ORDER_COMPLETED =
  "SATELLITE_CLINIC_LAB_ORDER_COMPLETED" as const;

export const satelliteClinicLabOrderCompletedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(SATELLITE_CLINIC_LAB_ORDER_COMPLETED),
    payload: z.object({
      labOrderId: z.string(),
      patientRef: z.string(),
      testCode: z.string(),
      amountNet: z.number(),
      currency: z.literal("AZN"),
    }),
  });

export type SatelliteClinicLabOrderCompletedEvent = z.infer<
  typeof satelliteClinicLabOrderCompletedSchema
>;

export function isSatelliteClinicLabOrderCompleted(
  data: unknown,
): data is SatelliteClinicLabOrderCompletedEvent {
  return satelliteClinicLabOrderCompletedSchema.safeParse(data).success;
}
