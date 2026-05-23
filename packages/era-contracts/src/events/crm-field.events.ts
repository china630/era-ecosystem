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
