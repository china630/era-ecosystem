import { z } from "zod";
import { satelliteEventBaseSchema } from "./common";

export const SATELLITE_WHOLESALE_ORDER_CONFIRMED =
  "SATELLITE_WHOLESALE_ORDER_CONFIRMED" as const;

export const satelliteWholesaleOrderConfirmedSchema =
  satelliteEventBaseSchema.extend({
    type: z.literal(SATELLITE_WHOLESALE_ORDER_CONFIRMED),
    payload: z.object({
      orderId: z.string(),
      buyerCounterpartyId: z.string(),
      amountNet: z.number(),
      currency: z.literal("AZN"),
      lineCount: z.number().int().nonnegative(),
    }),
  });

export type SatelliteWholesaleOrderConfirmedEvent = z.infer<
  typeof satelliteWholesaleOrderConfirmedSchema
>;

export function isSatelliteWholesaleOrderConfirmed(
  data: unknown,
): data is SatelliteWholesaleOrderConfirmedEvent {
  return satelliteWholesaleOrderConfirmedSchema.safeParse(data).success;
}
