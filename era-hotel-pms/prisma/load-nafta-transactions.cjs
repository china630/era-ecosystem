"use strict";
/**
 * Volume transaction loader for hotel FO (guests / reservations / folios).
 * Stay policy: check-in 14:00, check-out 12:00 Asia/Baku.
 * Per-room date ranges must not overlap (adjacent turnover allowed).
 *
 * Run after reference/master seed:
 *   node prisma/load-nafta-transactions.cjs
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20260718);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

const FIRST = [
  "Elcin", "Resad", "Kamran", "Nigar", "Aysel", "Leyla", "Murad", "Orxan", "Gunel", "Sebine",
  "Tural", "Vusal", "Ceyhun", "Aygun", "Fidan", "Ramil", "Elnur", "Samir", "Nermin", "Zaur",
  "Ivan", "Elena", "Sergey", "Olga", "Dmitri", "Natalia", "Andrei", "Marina", "Alexei", "Tatiana",
];
const LAST = [
  "Aliyev", "Mammadov", "Huseynov", "Guliyev", "Hasanov", "Ibrahimov", "Rahimov", "Jafarov",
  "Karimov", "Abbasov", "Suleymanov", "Nabiyev", "Ivanov", "Petrov", "Smirnov", "Popov",
  "Volkov", "Sokolov", "Kuznetsov", "Morozov",
];
const guestName = () => `${pick(FIRST)} ${pick(LAST)}`;

const BB = { "STD-TWN": 80, "STD-DBL": 80, "STD-TRP": 95, JS: 96, DLX: 102 };
const FB = { "STD-TWN": 130, "STD-DBL": 130, "STD-TRP": 145, JS: 146, DLX: 152 };

function hotelDateKey(d = new Date()) {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(d);
}

function addHotelDays(key, days) {
  const noon = new Date(`${hotelDateKey(key)}T08:00:00.000Z`);
  noon.setUTCDate(noon.getUTCDate() + days);
  return hotelDateKey(noon);
}

function stayCheckIn(key) {
  return new Date(`${hotelDateKey(key)}T14:00:00.000+04:00`);
}

function stayCheckOut(key) {
  return new Date(`${hotelDateKey(key)}T12:00:00.000+04:00`);
}

function staysOverlap(aIn, aOut, bIn, bOut) {
  return aIn.getTime() < bOut.getTime() && bIn.getTime() < aOut.getTime();
}

function nightCount(ci, co) {
  const a = new Date(`${hotelDateKey(ci)}T08:00:00.000Z`);
  const b = new Date(`${hotelDateKey(co)}T08:00:00.000Z`);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
}

/** @type {Map<string, Array<{ checkIn: Date, checkOut: Date }>>} */
const roomSlots = new Map();

function roomFree(roomId, checkIn, checkOut) {
  const slots = roomSlots.get(roomId) ?? [];
  return !slots.some((s) => staysOverlap(s.checkIn, s.checkOut, checkIn, checkOut));
}

function occupy(roomId, checkIn, checkOut) {
  const slots = roomSlots.get(roomId) ?? [];
  slots.push({ checkIn, checkOut });
  roomSlots.set(roomId, slots);
}

function tryPickRoom(candidates, checkIn, checkOut) {
  const shuffled = [...candidates].sort(() => rnd() - 0.5);
  for (const room of shuffled) {
    if (roomFree(room.id, checkIn, checkOut)) return room;
  }
  return null;
}

async function main() {
  await prisma.folioPayment.deleteMany({});
  await prisma.folioCharge.deleteMany({});
  await prisma.folio.deleteMany({});
  await prisma.stay.deleteMany({});
  try {
    await prisma.reservationDailyRate.deleteMany({});
  } catch (_) {}
  try {
    await prisma.reservationGuest.deleteMany({});
  } catch (_) {}
  try {
    await prisma.reservationNote.deleteMany({});
  } catch (_) {}
  await prisma.reservation.deleteMany({});
  await prisma.guest.deleteMany({});

  const todayKey = hotelDateKey();
  const types = await prisma.roomType.findMany();
  const allRooms = await prisma.room.findMany({ where: { deleted: false } });
  const roomsByType = {};
  for (const r of allRooms) (roomsByType[r.roomTypeId] = roomsByType[r.roomTypeId] || []).push(r);
  const plans = await prisma.ratePlan.findMany();
  const planByCode = Object.fromEntries(plans.map((p) => [p.code, p]));
  const mealBB = await prisma.mealPlan.findUnique({ where: { code: "BB" } });
  const mealFB = await prisma.mealPlan.findUnique({ where: { code: "FB" } });
  const revRoom = await prisma.revenueCode.findUnique({ where: { code: "ROOM" } });
  const deptAcc = await prisma.department.findUnique({ where: { code: "ACC" } });
  if (!mealBB || !mealFB || !revRoom || !deptAcc) {
    throw new Error("Missing master data (meal/revenue/department). Run reference seed first.");
  }
  const sources = await prisma.bookingSource.findMany();
  const agencies = await prisma.agency.findMany({ take: 60 });
  const PM = ["CASH", "CARD", "COMPANY_ACCOUNT"];
  const planPick = () => {
    const r = rnd();
    if (r < 0.45) return "PKG-STANDART";
    if (r < 0.65) return "BAR-FB";
    if (r < 0.85) return "BAR-BB";
    return pick(["PKG-PREMIUM", "PKG-DERMO", "PKG-DETOKS"]);
  };
  const nightly = (pc, tc, ad) =>
    pc === "BAR-BB" ? BB[tc] : pc === "BAR-FB" ? FB[tc] : Number(planByCode[pc].pricePerNight) * ad;
  const mealFor = (pc) => (pc === "BAR-BB" ? mealBB.id : mealFB.id);

  const reservations = [];
  let skipped = 0;

  const shuffled = [...allRooms].sort(() => rnd() - 0.5);
  const inHouseCount = Math.min(54, shuffled.length);
  for (let i = 0; i < inHouseCount; i++) {
    const room = shuffled[i];
    const t = types.find((x) => x.id === room.roomTypeId);
    const ciKey = addHotelDays(todayKey, -ri(1, 12));
    const coKey = addHotelDays(todayKey, ri(1, 10));
    const checkIn = stayCheckIn(ciKey);
    const checkOut = stayCheckOut(coKey);
    if (!roomFree(room.id, checkIn, checkOut)) {
      skipped++;
      continue;
    }
    occupy(room.id, checkIn, checkOut);
    reservations.push({
      t,
      room,
      plan: planPick(),
      checkIn,
      checkOut,
      status: "IN_HOUSE",
      adults: ri(1, 2),
    });
  }

  for (let i = 0; i < 45; i++) {
    const t = pick(types);
    const pool = roomsByType[t.id] || [];
    if (!pool.length) {
      skipped++;
      continue;
    }
    const ciKey = addHotelDays(todayKey, -ri(3, 10));
    let coKey = addHotelDays(ciKey, ri(2, 7));
    if (coKey > todayKey) coKey = todayKey;
    if (coKey <= ciKey) coKey = addHotelDays(ciKey, 1);
    const checkIn = stayCheckIn(ciKey);
    const checkOut = stayCheckOut(coKey);
    const room = tryPickRoom(pool, checkIn, checkOut);
    if (!room) {
      skipped++;
      continue;
    }
    occupy(room.id, checkIn, checkOut);
    reservations.push({
      t,
      room,
      plan: planPick(),
      checkIn,
      checkOut,
      status: "CHECKED_OUT",
      adults: ri(1, 2),
    });
  }

  for (let i = 0; i < 22; i++) {
    const t = pick(types);
    const pool = roomsByType[t.id] || [];
    if (!pool.length) {
      skipped++;
      continue;
    }
    const ciKey = addHotelDays(todayKey, ri(0, 7));
    const coKey = addHotelDays(ciKey, ri(3, 10));
    const checkIn = stayCheckIn(ciKey);
    const checkOut = stayCheckOut(coKey);
    const room = tryPickRoom(pool, checkIn, checkOut);
    if (!room) {
      skipped++;
      continue;
    }
    occupy(room.id, checkIn, checkOut);
    reservations.push({
      t,
      room,
      plan: planPick(),
      checkIn,
      checkOut,
      status: "CONFIRMED",
      adults: ri(1, 2),
    });
  }

  let charges = 0;
  let payments = 0;
  let folios = 0;
  let stays = 0;
  let counter = 0;
  const occupied = new Set();

  for (const r of reservations) {
    counter++;
    const g = await prisma.guest.create({
      data: {
        fullName: guestName(),
        nationality: rnd() < 0.6 ? "AZ" : "RU",
        phone: "+9945" + ri(10000000, 99999999),
      },
    });
    const useAgency = rnd() < 0.4 && agencies.length > 0;
    const nr = nightly(r.plan, r.t.code, r.adults);
    const nights = nightCount(r.checkIn, r.checkOut);
    const res = await prisma.reservation.create({
      data: {
        roomTypeId: r.t.id,
        roomId: r.room.id,
        guestId: g.id,
        ratePlanId: planByCode[r.plan].id,
        mealPlanId: mealFor(r.plan),
        sourceId: pick(sources).id,
        agencyId: useAgency ? pick(agencies).id : null,
        checkInDate: r.checkIn,
        checkOutDate: r.checkOut,
        status: r.status,
        paymentMethod: pick(PM),
        totalAmount: (nr * nights).toFixed(2),
        adults: r.adults,
        roomCount: 1,
        market: useAgency ? "Agency" : "Direct",
        segment: r.plan.startsWith("PKG") ? "Medical" : "Leisure",
        resNo: "NR-26-" + String(1000 + counter),
      },
    });
    if (r.status === "IN_HOUSE") occupied.add(r.room.id);
    if (r.status === "IN_HOUSE" || r.status === "CHECKED_OUT") {
      await prisma.stay.create({
        data: {
          reservationId: res.id,
          actualCheckIn: r.checkIn,
          actualCheckOut: r.status === "CHECKED_OUT" ? r.checkOut : null,
        },
      });
      stays++;
      const folio = await prisma.folio.create({
        data: {
          reservationId: res.id,
          type: "GUEST",
          status: r.status === "CHECKED_OUT" ? "CLOSED" : "OPEN",
        },
      });
      folios++;
      const lastNightKey =
        r.status === "CHECKED_OUT" ? hotelDateKey(r.checkOut) : todayKey;
      let sum = 0;
      for (
        let dk = hotelDateKey(r.checkIn);
        dk < lastNightKey;
        dk = addHotelDays(dk, 1)
      ) {
        await prisma.folioCharge.create({
          data: {
            folioId: folio.id,
            revenueCodeId: revRoom.id,
            departmentId: deptAcc.id,
            amount: nr.toFixed(2),
            qty: 1,
            description: `Room ${r.t.code} ${dk}`,
            businessDate: new Date(`${dk}T00:00:00.000Z`),
          },
        });
        sum += nr;
        charges++;
      }
      if (r.status === "CHECKED_OUT" && sum > 0) {
        await prisma.folioPayment.create({
          data: {
            folioId: folio.id,
            amount: sum.toFixed(2),
            paymentMethod: res.paymentMethod,
          },
        });
        payments++;
      }
    }
  }

  if (occupied.size) {
    await prisma.room.updateMany({
      where: { id: { in: [...occupied] } },
      data: { status: "OCCUPIED" },
    });
  }

  console.log(
    "HOTEL TX OK",
    JSON.stringify(
      {
        todayKey,
        stayPolicy: "checkIn 14:00 / checkOut 12:00 Asia/Baku",
        skippedNoRoom: skipped,
        guests: await prisma.guest.count(),
        reservations: await prisma.reservation.count(),
        inHouse: await prisma.reservation.count({ where: { status: "IN_HOUSE" } }),
        checkedOut: await prisma.reservation.count({ where: { status: "CHECKED_OUT" } }),
        confirmed: await prisma.reservation.count({ where: { status: "CONFIRMED" } }),
        occupiedRooms: occupied.size,
        folios,
        charges,
        payments,
        stays,
      },
      null,
      1,
    ),
  );
}

main()
  .catch((e) => {
    console.error("TX ERR", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
