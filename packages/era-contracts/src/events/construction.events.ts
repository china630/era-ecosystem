import { z } from "zod";
import { satelliteEventBaseSchema } from "./common";

export const SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED =
  "SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED" as const;

export const satelliteConstructionProgressActSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED),
    payload: z.object({
      projectId: z.string(),
      actId: z.string(),
      amountNet: z.number(),
      currency: z.literal("AZN"),
      periodKey: z.string().optional(),
    }),
  });

export type SatelliteConstructionProgressActEvent = z.infer<
  typeof satelliteConstructionProgressActSchema
>;

export function isSatelliteConstructionProgressActApproved(
  data: unknown,
): data is SatelliteConstructionProgressActEvent {
  return satelliteConstructionProgressActSchema.safeParse(data).success;
}
