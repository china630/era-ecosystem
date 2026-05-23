import { Prisma } from '@prisma/client';

export function toDecimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function decimalToNumber(value: Prisma.Decimal | { toNumber(): number } | number | string): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  return value.toNumber();
}

export function countNights(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
