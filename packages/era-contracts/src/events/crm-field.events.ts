import { z } from "zod";
import { satelliteEventBaseSchema } from "./common";

export const SATELLITE_CRM_LEAD_CONVERTED =
  "SATELLITE_CRM_LEAD_CONVERTED" as const;

export const satelliteCrmLeadConvertedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_CRM_LEAD_CONVERTED),
  payload: z.object({
    leadId: z.string(),
    counterpartyId: z.string().optional(),
    channel: z.enum(["whatsapp", "instagram", "visit", "phone", "other"]),
    estimatedAmount: z.number().optional(),
    currency: z.literal("AZN").optional(),
  }),
});

export type SatelliteCrmLeadConvertedEvent = z.infer<
  typeof satelliteCrmLeadConvertedSchema
>;

export function isSatelliteCrmLeadConverted(
  data: unknown,
): data is SatelliteCrmLeadConvertedEvent {
  return satelliteCrmLeadConvertedSchema.safeParse(data).success;
}

export const SATELLITE_CRM_VISIT_LOGGED =
  "SATELLITE_CRM_VISIT_LOGGED" as const;

export const satelliteCrmVisitLoggedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_CRM_VISIT_LOGGED),
  payload: z.object({
    visitId: z.string(),
    leadId: z.string(),
    channel: z
      .enum(["whatsapp", "instagram", "visit", "phone", "other"])
      .optional(),
  }),
});

export type SatelliteCrmVisitLoggedEvent = z.infer<
  typeof satelliteCrmVisitLoggedSchema
>;

export function isSatelliteCrmVisitLogged(
  data: unknown,
): data is SatelliteCrmVisitLoggedEvent {
  return satelliteCrmVisitLoggedSchema.safeParse(data).success;
}
