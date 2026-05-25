import { z } from "zod";
import { satelliteEventBaseSchema } from "./common";

export const SATELLITE_RETAIL_SALE_COMPLETED =
  "SATELLITE_RETAIL_SALE_COMPLETED" as const;

export const RetailPreset = z.enum([
  "grocery",
  "apparel",
  "electronics",
  "pharmacy",
]);
export type RetailPreset = z.infer<typeof RetailPreset>;

export const satelliteRetailSaleCompletedSchema = satelliteEventBaseSchema.extend(
  {
    type: z.literal(SATELLITE_RETAIL_SALE_COMPLETED),
    payload: z.object({
      outletId: z.string(),
      registerId: z.string(),
      shiftId: z.string(),
      receiptId: z.string(),
      preset: RetailPreset,
      amountNet: z.number(),
      currency: z.literal("AZN"),
      paymentMethod: z.string(),
      lineCount: z.number().int().nonnegative(),
    }),
  },
);

export type SatelliteRetailSaleCompletedEvent = z.infer<
  typeof satelliteRetailSaleCompletedSchema
>;

export function isSatelliteRetailSaleCompleted(
  data: unknown,
): data is SatelliteRetailSaleCompletedEvent {
  return satelliteRetailSaleCompletedSchema.safeParse(data).success;
}

export const SATELLITE_RETAIL_SHIFT_CLOSED =
  "SATELLITE_RETAIL_SHIFT_CLOSED" as const;

export const satelliteRetailShiftClosedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_RETAIL_SHIFT_CLOSED),
  payload: z.object({
    outletId: z.string(),
    registerId: z.string(),
    shiftId: z.string(),
    preset: RetailPreset,
    totalSales: z.number(),
    receiptCount: z.number().int().nonnegative(),
    currency: z.literal("AZN"),
  }),
});

export type SatelliteRetailShiftClosedEvent = z.infer<
  typeof satelliteRetailShiftClosedSchema
>;

export function isSatelliteRetailShiftClosed(
  data: unknown,
): data is SatelliteRetailShiftClosedEvent {
  return satelliteRetailShiftClosedSchema.safeParse(data).success;
}
