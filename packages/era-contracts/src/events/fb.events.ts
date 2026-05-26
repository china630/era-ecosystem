import { z } from "zod";
import { satelliteEventBaseSchema } from "./common";

export const SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED =
  "SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED" as const;

export const fbConsumptionLineSchema = z.object({
  sku: z.string().min(1),
  qty: z.number().positive(),
  description: z.string().optional(),
});

export const satelliteFbStockConsumptionCompletedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED),
    payload: z.object({
      ticketId: z.string(),
      outletId: z.string(),
      outletCode: z.string().optional(),
      paymentMethod: z.string(),
      amountAzn: z.number(),
      currency: z.literal("AZN"),
      lines: z.array(fbConsumptionLineSchema).min(1),
    }),
  });

export type SatelliteFbStockConsumptionCompletedEvent = z.infer<
  typeof satelliteFbStockConsumptionCompletedSchema
>;

export function isSatelliteFbStockConsumptionCompleted(
  data: unknown,
): data is SatelliteFbStockConsumptionCompletedEvent {
  return satelliteFbStockConsumptionCompletedSchema.safeParse(data).success;
}
