/**
 * Debug turnover flags for rooms 203 / 301. Run: node scripts/debug-room-plan-shapes.mjs
 */
import { PrismaClient } from '@prisma/client';

const HOTEL_TZ = 'Asia/Baku';

function calendarDateKey(iso) {
  if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = iso instanceof Date ? iso : new Date(iso);
  return new Intl.DateTimeFormat('en-CA', { timeZone: HOTEL_TZ }).format(d);
}

function parseCalendarDate(iso) {
  const key = calendarDateKey(iso);
  return new Date(`${key}T12:00:00+04:00`);
}

function stayOverlaps(a, b) {
  const aCi = parseCalendarDate(a.checkInDate).getTime();
  const aCo = parseCalendarDate(a.checkOutDate).getTime();
  const bCi = parseCalendarDate(b.checkInDate).getTime();
  const bCo = parseCalendarDate(b.checkOutDate).getTime();
  return aCi < bCo && bCi < aCo;
}

function hasTurnoverStart(bar, roomBars) {
  const checkInKey = calendarDateKey(bar.checkInDate);
  return roomBars.some((other) => {
    if (other.id === bar.id) return false;
    if (stayOverlaps(bar, other)) return false;
    const otherCiKey = calendarDateKey(other.checkInDate);
    const otherCoKey = calendarDateKey(other.checkOutDate);
    return otherCoKey === checkInKey && otherCiKey < otherCoKey;
  });
}

const prisma = new PrismaClient();

const TARGET = '2026-06-06';
const ROOMS = ['203', '301'];
const LIST_ALL = true;

try {
  const rooms = await prisma.room.findMany({
    where: { roomNumber: { in: ROOMS } },
    select: { id: true, roomNumber: true },
  });

  for (const room of rooms) {
    const reservations = await prisma.reservation.findMany({
      where: {
        roomId: room.id,
        status: { in: ['CONFIRMED', 'IN_HOUSE', 'OPTION'] },
        ...(LIST_ALL
          ? {}
          : {
              checkInDate: { lte: new Date(`${TARGET}T23:59:59Z`) },
              checkOutDate: { gte: new Date(`${TARGET}T00:00:00Z`) },
            }),
      },
      include: { guest: { select: { fullName: true } } },
      orderBy: { checkInDate: 'asc' },
    });

    console.log(`\n=== Room ${room.roomNumber} (${reservations.length} res on/near ${TARGET}) ===`);
    const bars = reservations.map((r) => ({
      id: r.id.slice(0, 8),
      guest: r.guest.fullName,
      ci: calendarDateKey(r.checkInDate),
      co: calendarDateKey(r.checkOutDate),
      rawCi: r.checkInDate.toISOString(),
      rawCo: r.checkOutDate.toISOString(),
      sameDay: calendarDateKey(r.checkInDate) === calendarDateKey(r.checkOutDate),
    }));

    for (const b of bars) {
      const r = reservations.find((x) => x.id.startsWith(b.id)) ?? reservations[0];
      const full = reservations.find((x) => x.guest.fullName === b.guest && calendarDateKey(x.checkInDate) === b.ci);
      const row = full ?? r;
      const turnoverStart = hasTurnoverStart(row, reservations);
      const others = reservations
        .filter((o) => o.id !== row.id && calendarDateKey(o.checkOutDate) === calendarDateKey(row.checkInDate))
        .map((o) => `${o.guest.fullName} out ${calendarDateKey(o.checkOutDate)} (in ${calendarDateKey(o.checkInDate)})`);
      console.log({
        ...b,
        turnoverStart,
        matchedPriorCheckout: others,
        overlaps: reservations
          .filter((o) => o.id !== row.id && stayOverlaps(row, o))
          .map((o) => o.guest.fullName),
      });
    }
  }
} finally {
  await prisma.$disconnect();
}
