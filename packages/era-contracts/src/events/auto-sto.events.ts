import { z } from "zod";
import { satelliteEventBaseSchema } from "./common";

export const SATELLITE_AUTO_WORK_ORDER_COMPLETED =
  "SATELLITE_AUTO_WORK_ORDER_COMPLETED" as const;

export const satelliteAutoWorkOrderCompletedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(SATELLITE_AUTO_WORK_ORDER_COMPLETED),
    payload: z.object({
      workOrderId: z.string(),
      vehiclePlate: z.string().optional(),
      laborAmount: z.number(),
      partsAmount: z.number(),
      currency: z.literal("AZN"),
    }),
  });

export type SatelliteAutoWorkOrderCompletedEvent = z.infer<
  typeof satelliteAutoWorkOrderCompletedSchema
>;

export function isSatelliteAutoWorkOrderCompleted(
  data: unknown,
): data is SatelliteAutoWorkOrderCompletedEvent {
  return satelliteAutoWorkOrderCompletedSchema.safeParse(data).success;
}
