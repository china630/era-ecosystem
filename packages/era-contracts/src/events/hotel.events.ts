import { z } from "zod";

export const SATELLITE_HOTEL_RESERVATION_COMPLETED =
  "SATELLITE_HOTEL_RESERVATION_COMPLETED" as const;

export interface SatelliteHotelReservationCompletedEvent {
  type: typeof SATELLITE_HOTEL_RESERVATION_COMPLETED;
  organizationId: string;
  correlationId: string;
  occurredAt: string;
  payload: {
    reservationId: string;
    amountNet: number;
    guestVoen: string | null;
    currency: "AZN";
    paymentMethod: string;
    items: Array<{ sku: string; qty: number; price: number; itemType?: string }>;
  };
}

const reservationCompletedItemSchema = z.object({
  sku: z.string(),
  qty: z.number(),
  price: z.number(),
  itemType: z.string().optional(),
});

export const satelliteHotelReservationCompletedSchema = z.object({
  type: z.literal(SATELLITE_HOTEL_RESERVATION_COMPLETED),
  organizationId: z.string().min(1),
  correlationId: z.string().min(1),
  occurredAt: z.string().min(1),
  payload: z.object({
    reservationId: z.string().min(1),
    amountNet: z.number(),
    guestVoen: z.string().nullable(),
    currency: z.literal("AZN"),
    paymentMethod: z.string().min(1),
    items: z.array(reservationCompletedItemSchema),
  }),
});

export function isSatelliteHotelReservationCompleted(
  data: unknown,
): data is SatelliteHotelReservationCompletedEvent {
  return satelliteHotelReservationCompletedSchema.safeParse(data).success;
}

export const SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED =
  "SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED" as const;

export interface SatelliteHotelNightAuditClosedEvent {
  type: typeof SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED;
  organizationId: string;
  correlationId: string;
  occurredAt: string;
  payload: {
    businessDate: string;
    nightAuditId?: string;
    currency: "AZN";
    revenueLines: Array<{
      revenueCode: string;
      amount: number;
      glAccountCode: string;
    }>;
    paymentLines: Array<{ method: string; amount: number }>;
  };
}

const nightAuditRevenueLineSchema = z.object({
  revenueCode: z.string(),
  amount: z.number(),
  glAccountCode: z.string(),
});

export const satelliteHotelNightAuditClosedSchema = z.object({
  type: z.literal(SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED),
  organizationId: z.string().min(1),
  correlationId: z.string().min(1),
  occurredAt: z.string().min(1),
  payload: z.object({
    businessDate: z.string().min(1),
    nightAuditId: z.string().optional(),
    currency: z.literal("AZN"),
    revenueLines: z.array(nightAuditRevenueLineSchema),
    paymentLines: z.array(
      z.object({
        method: z.string(),
        amount: z.number(),
      }),
    ),
  }),
});

export function isSatelliteHotelNightAuditClosed(
  data: unknown,
): data is SatelliteHotelNightAuditClosedEvent {
  return satelliteHotelNightAuditClosedSchema.safeParse(data).success;
}
