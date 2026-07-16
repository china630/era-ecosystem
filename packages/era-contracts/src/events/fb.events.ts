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

/** Standalone / LOCAL_CASHIER sale — not emitted for hotel folio or hub settlement. */
export const SATELLITE_FB_SALE_COMPLETED =
  "SATELLITE_FB_SALE_COMPLETED" as const;

export const satelliteFbSaleCompletedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_FB_SALE_COMPLETED),
  payload: z.object({
    ticketId: z.string(),
    outletId: z.string(),
    outletCode: z.string().optional(),
    shiftId: z.string().optional(),
    receiptId: z.string(),
    amountNet: z.number(),
    currency: z.literal("AZN"),
    paymentMethod: z.string(),
    lineCount: z.number().int().nonnegative(),
  }),
});

export type SatelliteFbSaleCompletedEvent = z.infer<
  typeof satelliteFbSaleCompletedSchema
>;

export function isSatelliteFbSaleCompleted(
  data: unknown,
): data is SatelliteFbSaleCompletedEvent {
  return satelliteFbSaleCompletedSchema.safeParse(data).success;
}

export const SATELLITE_FB_SHIFT_CLOSED =
  "SATELLITE_FB_SHIFT_CLOSED" as const;

export const satelliteFbShiftClosedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_FB_SHIFT_CLOSED),
  payload: z.object({
    outletId: z.string(),
    outletCode: z.string().optional(),
    shiftId: z.string(),
    totalSales: z.number(),
    ticketCount: z.number().int().nonnegative(),
    currency: z.literal("AZN"),
  }),
});

export type SatelliteFbShiftClosedEvent = z.infer<
  typeof satelliteFbShiftClosedSchema
>;

export function isSatelliteFbShiftClosed(
  data: unknown,
): data is SatelliteFbShiftClosedEvent {
  return satelliteFbShiftClosedSchema.safeParse(data).success;
}
