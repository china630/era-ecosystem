import type { Prisma, ReservationStatus } from '@prisma/client';

/** Front-desk queues on the reservation list. Order is the chip order. */
export const RESERVATION_QUEUE_CODES = [
  'bookings',
  'dueIn',
  'inHouse',
  'dueOut',
  'departed',
  'noShow',
  'cancel',
  'all',
] as const;

export type ReservationQueue = (typeof RESERVATION_QUEUE_CODES)[number];

const OPEN_STATUSES: ReservationStatus[] = ['OPTION', 'CONFIRMED'];

export function isReservationQueue(value: string | null | undefined): value is ReservationQueue {
  return RESERVATION_QUEUE_CODES.includes(value as ReservationQueue);
}

/** Queues whose window is already one civil day. The date pickers do not apply. */
export function queueIgnoresDates(queue: ReservationQueue): boolean {
  return queue === 'dueIn' || queue === 'dueOut';
}

function dayStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function dayEnd(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999Z`);
}

function arrivalRange(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter | undefined {
  if (!dateFrom && !dateTo) return undefined;
  const range: Prisma.DateTimeFilter = {};
  if (dateFrom) range.gte = dayStart(dateFrom);
  if (dateTo) range.lte = dayEnd(dateTo);
  return range;
}

/**
 * Who the reservation list shows for one chip.
 * `today` is the hotel civil date (YYYY-MM-DD).
 * `overdue` is the night-audit tail: open stays whose arrival is already before `today`.
 */
export function reservationQueueWhere(input: {
  queue: ReservationQueue;
  today: string;
  overdue?: boolean;
  dateFrom?: string;
  dateTo?: string;
}): Prisma.ReservationWhereInput {
  const queue = input.queue;
  const today = input.today;
  const dateFrom = queueIgnoresDates(queue) ? undefined : input.dateFrom?.trim() || undefined;
  const dateTo = queueIgnoresDates(queue) ? undefined : input.dateTo?.trim() || undefined;

  if (queue === 'bookings') {
    if (input.overdue) {
      const range: Prisma.DateTimeFilter = { lt: dayStart(today) };
      if (dateFrom) range.gte = dayStart(dateFrom);
      if (dateTo) range.lte = dayEnd(dateTo);
      return { status: { in: OPEN_STATUSES }, checkInDate: range };
    }
    const from = dateFrom && dateFrom > today ? dateFrom : today;
    const range: Prisma.DateTimeFilter = { gte: dayStart(from) };
    if (dateTo) range.lte = dayEnd(dateTo);
    return { status: { in: OPEN_STATUSES }, checkInDate: range };
  }

  if (queue === 'dueIn') {
    return {
      status: { in: OPEN_STATUSES },
      checkInDate: { gte: dayStart(today), lte: dayEnd(today) },
    };
  }

  if (queue === 'inHouse') {
    const and: Prisma.ReservationWhereInput[] = [{ status: 'IN_HOUSE' }];
    if (dateFrom) and.push({ checkOutDate: { gt: dayStart(dateFrom) } });
    if (dateTo) and.push({ checkInDate: { lte: dayEnd(dateTo) } });
    return { AND: and };
  }

  if (queue === 'dueOut') {
    return {
      status: 'IN_HOUSE',
      checkOutDate: { gte: dayStart(today), lte: dayEnd(today) },
    };
  }

  if (queue === 'departed') {
    const range = arrivalRange(dateFrom, dateTo);
    return { status: 'CHECKED_OUT', ...(range ? { checkOutDate: range } : {}) };
  }

  if (queue === 'noShow') {
    const range = arrivalRange(dateFrom, dateTo);
    return { status: 'NO_SHOW', ...(range ? { checkInDate: range } : {}) };
  }

  if (queue === 'cancel') {
    const range = arrivalRange(dateFrom, dateTo);
    return { status: 'CANCELLED', ...(range ? { checkInDate: range } : {}) };
  }

  const range = arrivalRange(dateFrom, dateTo);
  return range ? { checkInDate: range } : {};
}
