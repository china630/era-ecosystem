import { Prisma } from '@prisma/client';
import { stayNights } from '@/lib/hotel-calendar';

export function toDecimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function decimalToNumber(value: Prisma.Decimal | { toNumber(): number } | number | string): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  return value.toNumber();
}

/** Tariff night count. Same Baku civil nights as the reservation card. */
export function countNights(checkIn: Date, checkOut: Date): number {
  return stayNights(checkIn, checkOut);
}
