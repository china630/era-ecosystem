import { z } from "zod";
import { satelliteEventBaseSchema } from "./common";

export const SATELLITE_LOGISTICS_TRIP_COMPLETED =
  "SATELLITE_LOGISTICS_TRIP_COMPLETED" as const;

export const satelliteLogisticsTripCompletedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(SATELLITE_LOGISTICS_TRIP_COMPLETED),
    payload: z.object({
      tripId: z.string(),
      vehicleId: z.string(),
      routeCode: z.string().optional(),
      freightAmount: z.number(),
      currency: z.literal("AZN"),
    }),
  });

export type SatelliteLogisticsTripCompletedEvent = z.infer<
  typeof satelliteLogisticsTripCompletedSchema
>;

export function isSatelliteLogisticsTripCompleted(
  data: unknown,
): data is SatelliteLogisticsTripCompletedEvent {
  return satelliteLogisticsTripCompletedSchema.safeParse(data).success;
}
