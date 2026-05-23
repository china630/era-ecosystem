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
