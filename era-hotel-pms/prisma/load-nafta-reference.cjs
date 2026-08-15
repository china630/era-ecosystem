"use strict";
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const DIR = path.join(__dirname, "seed-data", "nafta");
const read = (n) => JSON.parse(fs.readFileSync(path.join(DIR, n), "utf8"));

const ROOM_TYPES = [
  { code: "STD-TWN", name: "Standart Twin",   adultCapacity: 2, childCapacity: 1, baseQuota: 36 },
  { code: "STD-DBL", name: "Standart Double", adultCapacity: 2, childCapacity: 1, baseQuota: 19 },
  { code: "JS",      name: "Junior Suit",     adultCapacity: 2, childCapacity: 1, baseQuota: 11 },
  { code: "DLX",     name: "Deluxe",          adultCapacity: 2, childCapacity: 2, baseQuota: 8 },
  { code: "STD-TRP", name: "Standart Triple", adultCapacity: 3, childCapacity: 1, baseQuota: 4 },
];
const BB = { "STD-TWN": 80, "STD-DBL": 80, "STD-TRP": 95, JS: 96, DLX: 102 };
const FB = { "STD-TWN": 130, "STD-DBL": 130, "STD-TRP": 145, JS: 146, DLX: 152 };
const PKG = [
  { code: "PKG-STANDART", name: "Standart müalicə paketi", price: 139 },
  { code: "PKG-PREMIUM",  name: "Premium paket",           price: 193 },
  { code: "PKG-DERMO",    name: "Dermo paket",             price: 180 },
  { code: "PKG-DETOKS",   name: "Detoks paket",            price: 178 },
];

async function purgeTransactions() {
  await prisma.folioPayment.deleteMany({});
  await prisma.folioCharge.deleteMany({});
  try { await prisma.fiscalDocument.deleteMany({}); } catch (_) {}
  try { await prisma.folioSettlement.deleteMany({}); } catch (_) {}
  try { await prisma.folioDeposit.deleteMany({}); } catch (_) {}
  await prisma.folio.deleteMany({});
  await prisma.stay.deleteMany({});
  try { await prisma.reservationDailyRate.deleteMany({}); } catch (_) {}
  try { await prisma.reservationGuest.deleteMany({}); } catch (_) {}
  try { await prisma.reservationNote.deleteMany({}); } catch (_) {}
  try { await prisma.reservationPackageLine.deleteMany({}); } catch (_) {}
  try { await prisma.reservationPaymentCard.deleteMany({}); } catch (_) {}
  try { await prisma.reservationTask.deleteMany({}); } catch (_) {}
  try { await prisma.banquetEvent.deleteMany({}); } catch (_) {}
  await prisma.reservation.deleteMany({});
  await prisma.guest.deleteMany({});
}

async function main() {
  const agencies = read("agencies.json");
  const rooms = read("rooms.json");

  await purgeTransactions();
  await prisma.roomTypeRate.deleteMany({});
  await prisma.ratePlanPackageLine.deleteMany({});
  try { await prisma.ratePlanProcedureInclusion.deleteMany({}); } catch (_) {}
  try { await prisma.ratePlanAddOn.deleteMany({}); } catch (_) {}
  try { await prisma.channelRateMapping.deleteMany({}); } catch (_) {}
  try { await prisma.channelRoomMapping.deleteMany({}); } catch (_) {}
  await prisma.contractPricingRule.deleteMany({});
  try { await prisma.housekeepingTask.deleteMany({}); } catch (_) {}
  try { await prisma.roomClosure.deleteMany({}); } catch (_) {}
  try { await prisma.minibarPosting.deleteMany({}); } catch (_) {}
  await prisma.room.deleteMany({});
  await prisma.ratePlan.deleteMany({});
  await prisma.roomType.deleteMany({});

  const meals = {};
  for (const m of [["BB", "Breakfast"], ["HB", "Half board"], ["FB", "Full board"]]) {
    meals[m[0]] = (await prisma.mealPlan.upsert({ where: { code: m[0] }, update: { name: m[1] }, create: { code: m[0], name: m[1] } })).id;
  }
  const types = {};
  for (const t of ROOM_TYPES) types[t.code] = (await prisma.roomType.create({ data: t })).id;
  for (const r of rooms) {
    await prisma.room.create({ data: {
      roomNumber: r.roomNumber, roomTypeId: types[r.typeCode], floor: r.floor,
      status: r.status, bedTypeCode: r.bedType || null, deleted: !!r.deleted, disabled: !!r.disabled,
    }});
  }
  const barBB = await prisma.ratePlan.create({ data: { code: "BAR-BB", name: "BAR — Bed & Breakfast", type: "BASE", mealPlanId: meals.BB, pricePerNight: BB["STD-TWN"] } });
  const barFB = await prisma.ratePlan.create({ data: { code: "BAR-FB", name: "BAR — Full Board", type: "BASE", mealPlanId: meals.FB, pricePerNight: FB["STD-TWN"] } });
  const revRoom = await prisma.revenueCode.findFirst({ where: { code: "ROOM" } });
  const revTreatment = await prisma.revenueCode.findFirst({ where: { code: "TREATMENT" } });
  const revBoard = await prisma.revenueCode.findFirst({ where: { code: "BOARD" } });
  for (const p of PKG) {
    const rp = await prisma.ratePlan.create({
      data: { code: p.code, name: p.name, type: "DERIVED", medicalFlag: true, mealPlanId: meals.FB, pricePerNight: p.price },
    });
    if (revRoom && revTreatment && revBoard) {
      await prisma.ratePlanPackageLine.createMany({
        data: [
          { ratePlanId: rp.id, revenueCodeId: revRoom.id, amount: Math.round(p.price * 0.5), sortOrder: 1 },
          { ratePlanId: rp.id, revenueCodeId: revTreatment.id, amount: Math.round(p.price * 0.33), sortOrder: 2 },
          { ratePlanId: rp.id, revenueCodeId: revBoard.id, amount: Math.round(p.price * 0.17), sortOrder: 3 },
        ],
      });
    }
  }

  const rateRows = [];
  const start = new Date(Date.UTC(2026, 6, 1)), end = new Date(Date.UTC(2026, 7, 31));
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = new Date(d);
    for (const t of ROOM_TYPES) {
      rateRows.push({ ratePlanId: barBB.id, roomTypeId: types[t.code], date, amount: BB[t.code], currencyCode: "AZN", source: "MANUAL" });
      rateRows.push({ ratePlanId: barFB.id, roomTypeId: types[t.code], date, amount: FB[t.code], currencyCode: "AZN", source: "MANUAL" });
    }
  }
  for (let i = 0; i < rateRows.length; i += 500) await prisma.roomTypeRate.createMany({ data: rateRows.slice(i, i + 500) });
  for (const a of agencies) await prisma.agency.upsert({ where: { code: a.code }, update: { name: a.name }, create: { code: a.code, name: a.name } });

  console.log("HOTEL REFERENCE OK", JSON.stringify({
    roomTypes: await prisma.roomType.count(), rooms: await prisma.room.count(),
    mealPlans: await prisma.mealPlan.count(), ratePlans: await prisma.ratePlan.count(),
    roomTypeRates: await prisma.roomTypeRate.count(), agencies: await prisma.agency.count(),
  }, null, 1));
}
main().catch((e) => { console.error("REF ERR", e); process.exit(1); }).finally(() => prisma.$disconnect());