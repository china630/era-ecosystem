"use strict";
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DIR = path.join(__dirname, "seed-data", "nafta");
const read = (n) => JSON.parse(fs.readFileSync(path.join(DIR, n), "utf8"));

async function main() {
  const catalog = read("catalog.json");
  const labs = read("lab-tests.json");
  const procTypes = read("procedure-types.json");
  const cabinets = read("cabinets.json");
  const patients = read("patients.json");
  const practitioners = read("practitioners.json");
  const appts = read("appointments.json");

  // tenant
  await prisma.tenant.upsert({
    where: { code: "default" },
    update: { name: "Nafta Clinic" },
    create: { code: "default", name: "Nafta Clinic",
      enabledPresets: ["outpatient", "sanatorium_clinical", "inpatient_day"] },
  });

  // practitioners
  for (const p of practitioners) {
    await prisma.practitioner.upsert({
      where: { code: p.code },
      update: { fullName: p.fullName, specialty: p.specialty, active: true },
      create: { code: p.code, fullName: p.fullName, specialty: p.specialty },
    });
  }

  // rooms + one ROOM resource each
  const cabToResource = {};
  for (const c of cabinets) {
    const room = await prisma.room.upsert({
      where: { code: c.code }, update: { name: c.name }, create: { code: c.code, name: c.name },
    });
    const rescode = "RES-" + c.code.replace(/^CAB-/, "");
    const res = await prisma.resource.upsert({
      where: { code: rescode },
      update: { name: c.name, roomId: room.id, kind: "ROOM" },
      create: { code: rescode, name: c.name, kind: "ROOM", capacity: 1, roomId: room.id },
    });
    cabToResource[c.code] = res.id;
  }

  // procedure types
  const procTypeByCode = {};
  for (const p of procTypes) {
    const pt = await prisma.procedureType.upsert({
      where: { code: p.code },
      update: { name: p.name, durationMin: p.durationMin, resourceKind: "ROOM" },
      create: { code: p.code, name: p.name, durationMin: p.durationMin, resourceKind: "ROOM" },
    });
    procTypeByCode[p.code] = pt.id;
  }

  // service catalog (prices) + labs
  let svc = 0;
  for (const c of catalog) {
    const desc = c.nameRu || c.nameAz;
    const amount = c.price == null ? 0 : c.price;
    await prisma.serviceCatalogCache.upsert({
      where: { code: c.code },
      update: {
        description: desc,
        descriptionAz: c.nameAz || null,
        descriptionRu: c.nameRu || null,
        descriptionEn: c.nameEn || null,
        amount,
        kind: "PROCEDURE",
        syncedAt: new Date(),
      },
      create: {
        code: c.code,
        description: desc,
        descriptionAz: c.nameAz || null,
        descriptionRu: c.nameRu || null,
        descriptionEn: c.nameEn || null,
        amount,
        kind: "PROCEDURE",
      },
    });
    svc++;
  }
  for (const l of labs) {
    const name = l.name || l.code;
    const ascii = /^[\x20-\x7E]+$/.test(name);
    await prisma.serviceCatalogCache.upsert({
      where: { code: l.code },
      update: {
        description: name,
        descriptionAz: name,
        descriptionRu: name,
        descriptionEn: ascii ? name : null,
        amount: l.price,
        kind: "LAB",
        syncedAt: new Date(),
      },
      create: {
        code: l.code,
        description: name,
        descriptionAz: name,
        descriptionRu: name,
        descriptionEn: ascii ? name : null,
        amount: l.price,
        kind: "LAB",
      },
    });
    svc++;
  }

  // patients
  const patByCode = {};
  for (const p of patients) {
    const pr = await prisma.patientRef.upsert({
      where: { refCode: p.refCode },
      update: { fullName: p.fullName },
      create: { refCode: p.refCode, fullName: p.fullName, nationality: "AZ" },
    });
    patByCode[p.refCode] = pr.id;
  }

  // procedure orders: clear demo window then insert
  const winStart = new Date("2026-07-13T00:00:00+04:00");
  const winEnd = new Date("2026-07-20T00:00:00+04:00");
  await prisma.procedureOrder.deleteMany({ where: { scheduledAt: { gte: winStart, lt: winEnd } } });

  const data = [];
  for (const a of appts) {
    const scheduledAt = new Date(`${a.date}T${a.time}:00+04:00`);
    data.push({
      patientRefId: patByCode[a.patientRefCode],
      procedureTypeId: procTypeByCode[a.procedureCode] || null,
      procedureCode: a.procedureCode,
      procedureName: a.procedureName,
      scheduledAt,
      resourceId: cabToResource[a.cabinetCode] || null,
      amountNet: a.amount || 0,
      status: a.status,
      patientOrigin: "IN_HOUSE",
    });
  }
  // chunked insert
  let ins = 0;
  for (let i = 0; i < data.length; i += 500) {
    const chunk = data.slice(i, i + 500);
    await prisma.procedureOrder.createMany({ data: chunk });
    ins += chunk.length;
  }

  const counts = {
    practitioners: await prisma.practitioner.count(),
    rooms: await prisma.room.count(),
    resources: await prisma.resource.count(),
    procedureTypes: await prisma.procedureType.count(),
    serviceCatalog: svc,
    patients: await prisma.patientRef.count(),
    procedureOrders: await prisma.procedureOrder.count(),
    ordersInserted: ins,
  };
  console.log("CLINIC SEED OK", JSON.stringify(counts, null, 1));
}
main().catch((e) => { console.error("SEED ERR", e); process.exit(1); }).finally(() => prisma.$disconnect());