"use strict";
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const rows = await p.reservation.findMany({
    where: {
      status: { in: ["CONFIRMED", "IN_HOUSE", "OPTION"] },
      roomId: { not: null },
    },
    select: {
      resNo: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      room: { select: { roomNumber: true } },
    },
    orderBy: [{ room: { roomNumber: "asc" } }, { checkInDate: "asc" }],
  });

  const byRoom = {};
  for (const r of rows) {
    const n = r.room.roomNumber;
    (byRoom[n] ||= []).push(r);
  }

  let overlaps = 0;
  for (const [room, list] of Object.entries(byRoom)) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.checkInDate < b.checkOutDate && b.checkInDate < a.checkOutDate) {
          overlaps++;
          console.log(
            "OVERLAP",
            room,
            a.resNo,
            a.checkInDate.toISOString(),
            a.checkOutDate.toISOString(),
            b.resNo,
            b.checkInDate.toISOString(),
            b.checkOutDate.toISOString(),
          );
        }
      }
    }
  }

  console.log("sample times (first 8):");
  for (const r of rows.slice(0, 8)) {
    console.log(
      r.room.roomNumber,
      r.status,
      r.checkInDate.toISOString(),
      "->",
      r.checkOutDate.toISOString(),
    );
  }

  const room203 = byRoom["203"] || [];
  console.log("room 203 chain:", room203.length);
  for (const r of room203) {
    console.log(" ", r.status, r.checkInDate.toISOString(), "->", r.checkOutDate.toISOString());
  }

  console.log({ totalPlanBars: rows.length, overlaps });
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
