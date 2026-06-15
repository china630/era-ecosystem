import { z } from "zod";
import { patientOriginSchema, satelliteEventBaseSchema } from "./common";

export const clinicConsumptionLineSchema = z.object({
  sku: z.string().min(1),
  qty: z.number().positive(),
  description: z.string().optional(),
});

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

export const SATELLITE_CLINIC_PROCEDURE_COMPLETED =
  "SATELLITE_CLINIC_PROCEDURE_COMPLETED" as const;

export const satelliteClinicProcedureCompletedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(SATELLITE_CLINIC_PROCEDURE_COMPLETED),
    payload: z.object({
      visitId: z.string().optional(),
      episodeId: z.string().optional(),
      patientRef: z.string(),
      patientOrigin: patientOriginSchema,
      procedureCode: z.string(),
      amountNet: z.number(),
      currency: z.literal("AZN"),
      lines: z.array(clinicConsumptionLineSchema).min(1),
      reservationId: z.string().optional(),
      roomNumber: z.string().optional(),
    }),
  });

export type SatelliteClinicProcedureCompletedEvent = z.infer<
  typeof satelliteClinicProcedureCompletedSchema
>;

export function isSatelliteClinicProcedureCompleted(
  data: unknown,
): data is SatelliteClinicProcedureCompletedEvent {
  return satelliteClinicProcedureCompletedSchema.safeParse(data).success;
}

export const SATELLITE_CLINIC_PRESCRIPTION_ISSUED =
  "SATELLITE_CLINIC_PRESCRIPTION_ISSUED" as const;

export const satelliteClinicPrescriptionIssuedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(SATELLITE_CLINIC_PRESCRIPTION_ISSUED),
    payload: z.object({
      visitId: z.string(),
      patientRef: z.string(),
      patientOrigin: patientOriginSchema,
      lines: z.array(
        z.object({
          sku: z.string().min(1),
          qty: z.number().positive(),
          rxRequired: z.boolean().optional(),
          description: z.string().optional(),
        }),
      ).min(1),
      currency: z.literal("AZN"),
    }),
  });

export type SatelliteClinicPrescriptionIssuedEvent = z.infer<
  typeof satelliteClinicPrescriptionIssuedSchema
>;

export function isSatelliteClinicPrescriptionIssued(
  data: unknown,
): data is SatelliteClinicPrescriptionIssuedEvent {
  return satelliteClinicPrescriptionIssuedSchema.safeParse(data).success;
}

export const SATELLITE_CLINIC_WARD_DAY_CHARGE =
  "SATELLITE_CLINIC_WARD_DAY_CHARGE" as const;

export const satelliteClinicWardDayChargeSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(SATELLITE_CLINIC_WARD_DAY_CHARGE),
    payload: z.object({
      admissionId: z.string(),
      patientRef: z.string(),
      wardCode: z.string(),
      bedCode: z.string(),
      chargeDate: z.string(),
      serviceCode: z.string(),
      amountNet: z.number(),
      currency: z.literal("AZN"),
    }),
  });

export type SatelliteClinicWardDayChargeEvent = z.infer<
  typeof satelliteClinicWardDayChargeSchema
>;

export function isSatelliteClinicWardDayCharge(
  data: unknown,
): data is SatelliteClinicWardDayChargeEvent {
  return satelliteClinicWardDayChargeSchema.safeParse(data).success;
}
