import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PLAN_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'OPTION'];

const rows = await prisma.reservation.findMany({
  where: { status: { in: PLAN_STATUSES }, roomId: { not: null } },
  select: {
    resNo: true,
    status: true,
    checkInDate: true,
    checkOutDate: true,
    room: { select: { roomNumber: true } },
    guest: { select: { fullName: true } },
  },
  orderBy: [{ room: { roomNumber: 'asc' } }, { checkInDate: 'asc' }],
});

const byRoom = {};
for (const r of rows) {
  const n = r.room.roomNumber;
  (byRoom[n] ??= []).push(r);
}

const fmt = (d) => d.toISOString().slice(0, 10);
let issues = 0;
for (const [room, list] of Object.entries(byRoom)) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.checkInDate < b.checkOutDate && b.checkInDate < a.checkOutDate) {
        console.log(
          'OVERLAP',
          room,
          a.resNo,
          fmt(a.checkInDate),
          fmt(a.checkOutDate),
          a.guest.fullName,
          'vs',
          b.resNo,
          fmt(b.checkInDate),
          fmt(b.checkOutDate),
          b.guest.fullName,
        );
        issues++;
      }
    }
  }
}
console.log(issues ? `FAIL: ${issues} overlap(s)` : 'OK: no plan-status overlaps per room');
await prisma.$disconnect();
process.exit(issues ? 1 : 0);
