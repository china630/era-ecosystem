import { PrismaClient } from '@prisma/client';

const rooms = process.argv.slice(2);
if (!rooms.length) {
  console.error('Usage: node scripts/list-room-reservations.mjs 301 204');
  process.exit(1);
}

const prisma = new PrismaClient();
const rows = await prisma.reservation.findMany({
  where: { room: { roomNumber: { in: rooms } } },
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
for (const x of rows) {
  console.log(
    x.room.roomNumber,
    x.resNo,
    x.status,
    x.checkInDate.toISOString().slice(0, 10),
    x.checkOutDate.toISOString().slice(0, 10),
    x.guest.fullName,
  );
}
await prisma.$disconnect();
