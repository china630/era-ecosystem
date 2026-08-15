/**
 * Idempotent DEMO-WEEK seed from Nafta Randevular week export
 * (prisma/seed-data/nafta/randevular-week.json — Jul 13–19 2026).
 * Remaps source dayOffset onto Asia/Baku today..+6 (skips Sundays).
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const PREFIX = "DEMO-WEEK";
const ORG =
  process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
  process.env.ERA_CLINIC_ORGANIZATION_ID?.trim() ||
  "demo-clinic-org";

const DEFAULT_DURATION_MIN = 15;
const SLOT_MINUTES = 5;

function alignDuration(durationMin) {
  const raw = Math.max(1, Math.floor(Number(durationMin) || 0));
  return Math.ceil(raw / SLOT_MINUTES) * SLOT_MINUTES;
}

function bakuYmd(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekdaySun0(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function bakuDateAt(ymd, hour, minute) {
  return new Date(
    `${ymd}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+04:00`,
  );
}

function slugCode(prefix, name) {
  const core = String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 40);
  return `${prefix}-${core || "X"}`;
}

function parseHm(time) {
  const [h, m] = time.split(":").map(Number);
  return { h, m };
}

/** Map source dayOffset 0..6 onto open Baku dates starting today (skip Sunday). */
function buildDayMap() {
  const map = new Map();
  let cursor = bakuYmd();
  let src = 0;
  while (src <= 6) {
    if (weekdaySun0(cursor) === 0) {
      cursor = addDaysYmd(cursor, 1);
      continue;
    }
    map.set(src, cursor);
    src += 1;
    cursor = addDaysYmd(cursor, 1);
  }
  return map;
}

async function wipeDemoWeek() {
  const patients = await prisma.patientRef.findMany({
    where: { refCode: { startsWith: `${PREFIX}-` } },
    select: { id: true },
  });
  const patientIds = patients.map((p) => p.id);
  const episodes = await prisma.clinicalEpisode.findMany({
    where: {
      OR: [
        { reservationId: { startsWith: PREFIX } },
        ...(patientIds.length ? [{ patientRefId: { in: patientIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const episodeIds = episodes.map((e) => e.id);
  const orders = await prisma.procedureOrder.findMany({
    where: {
      OR: [
        { reservationId: { startsWith: PREFIX } },
        ...(patientIds.length ? [{ patientRefId: { in: patientIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);

  if (orderIds.length) {
    await prisma.procedureAllocation.deleteMany({
      where: { procedureOrderId: { in: orderIds } },
    });
    await prisma.resourceBooking.deleteMany({
      where: { procedureOrderId: { in: orderIds } },
    });
    await prisma.procedureOrder.deleteMany({ where: { id: { in: orderIds } } });
  }
  if (episodeIds.length) {
    await prisma.programProcedureBalance.deleteMany({
      where: { instance: { episodeId: { in: episodeIds } } },
    });
    await prisma.programInstance.deleteMany({ where: { episodeId: { in: episodeIds } } });
    await prisma.clinicalComplaint.deleteMany({ where: { episodeId: { in: episodeIds } } });
    await prisma.clinicalDiagnosis.deleteMany({ where: { episodeId: { in: episodeIds } } });
    await prisma.clinicalEpisode.deleteMany({ where: { id: { in: episodeIds } } });
  }
  if (patientIds.length) {
    const admissions = await prisma.inpatientAdmission.findMany({
      where: { patientRefId: { in: patientIds } },
      select: { id: true },
    });
    const admissionIds = admissions.map((a) => a.id);
    if (admissionIds.length) {
      await prisma.bedAssignment.deleteMany({ where: { admissionId: { in: admissionIds } } });
      try {
        await prisma.inpatientDailyCharge.deleteMany({
          where: { admissionId: { in: admissionIds } },
        });
      } catch {
        /* optional */
      }
      await prisma.inpatientAdmission.deleteMany({ where: { id: { in: admissionIds } } });
    }
    await prisma.bedAssignment.deleteMany({ where: { patientRefId: { in: patientIds } } });
    await prisma.patientContraindication.deleteMany({
      where: { patientRefId: { in: patientIds } },
    });
    await prisma.patientRef.deleteMany({ where: { id: { in: patientIds } } });
  }

  // Free beds that DEMO-WEEK occupied
  await prisma.bed.updateMany({
    where: { status: "OCCUPIED", code: { in: ["A1", "A2"] } },
    data: { status: "AVAILABLE" },
  });

  console.log("DEMO-WEEK wipe done", {
    patients: patientIds.length,
    episodes: episodeIds.length,
    orders: orderIds.length,
  });
}

async function ensureResource(roomName, cache) {
  if (cache.has(roomName)) return cache.get(roomName);
  const code = slugCode("RES", roomName);
  let row = await prisma.resource.findUnique({ where: { code } });
  if (!row) {
    row = await prisma.resource.create({
      data: {
        code,
        name: roomName,
        kind: "ROOM",
        capacity: 1,
      },
    });
  }
  cache.set(roomName, row);
  return row;
}

function loadRandevuProcedureMap() {
  const mapPath = path.join(__dirname, "seed-data", "nafta", "randevu-procedure-map.json");
  if (!fs.existsSync(mapPath)) return new Map();
  const raw = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  return new Map(Object.entries(raw));
}

async function ensureProcedureType(procedureName, cache, nameToCode) {
  if (cache.has(procedureName)) return cache.get(procedureName);
  const code = nameToCode.get(procedureName) || slugCode("SVC", procedureName);
  let row = await prisma.procedureType.findUnique({ where: { code } });
  if (!row) {
    // Prefer commercial name from catalog when available
    const catalog = await prisma.serviceCatalogCache.findUnique({ where: { code } });
    row = await prisma.procedureType.create({
      data: {
        code,
        name: catalog?.descriptionAz || catalog?.description || procedureName,
        durationMin: alignDuration(DEFAULT_DURATION_MIN),
        afterLunchAllowed: true,
      },
    });
    if (!catalog) {
      await prisma.serviceCatalogCache.create({
        data: {
          code,
          description: procedureName,
          descriptionAz: procedureName,
          descriptionRu: procedureName,
          amount: 0,
          kind: "PROCEDURE",
        },
      });
    }
  } else if (row.durationMin % SLOT_MINUTES !== 0) {
    row = await prisma.procedureType.update({
      where: { id: row.id },
      data: { durationMin: alignDuration(row.durationMin) },
    });
  }
  cache.set(procedureName, row);
  return row;
}

async function main() {
  const jsonPath = path.join(__dirname, "seed-data", "nafta", "randevular-week.json");
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Missing ${jsonPath} — export Randevular week first`);
  }
  const appointments = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  if (!Array.isArray(appointments) || appointments.length === 0) {
    throw new Error("randevular-week.json empty");
  }

  await wipeDemoWeek();

  const dayMap = buildDayMap();
  const template =
    (await prisma.programTemplate.findFirst({ where: { code: "DETOX-7" } })) ||
    (await prisma.programTemplate.findFirst());
  if (!template) throw new Error("No ProgramTemplate — run seed-vnext first");

  const practitioners = await prisma.practitioner.findMany({
    orderBy: { code: "asc" },
    take: 12,
  });
  if (!practitioners.length) throw new Error("No practitioners");

  const icd =
    (await prisma.icdCode.findFirst({ where: { code: "M54.5" } })) ||
    (await prisma.icdCode.findFirst());

  const resourceCache = new Map();
  const procCache = new Map();
  const patientCache = new Map();
  const episodeCache = new Map();
  const nameToCode = loadRandevuProcedureMap();
  console.log("Randevu procedure map entries:", nameToCode.size);

  let orderCount = 0;
  let skippedLunch = 0;
  let skippedClosed = 0;
  let skippedLate = 0;

  // Stable patient numbering
  const uniqueNames = [...new Set(appointments.map((a) => a.patientName))];
  uniqueNames.forEach((name, idx) => {
    patientCache.set(name, { pending: true, n: idx + 1 });
  });

  for (const name of uniqueNames) {
    const n = patientCache.get(name).n;
    const refCode = `${PREFIX}-P${String(n).padStart(4, "0")}`;
    const reservationId = `${PREFIX}-RES-${String(n).padStart(4, "0")}`;
    const patient = await prisma.patientRef.create({
      data: {
        refCode,
        fullName: name,
        phone: `+99450${String(1000000 + n).slice(-7)}`,
        nationality: "AZ",
        sex: n % 2 === 0 ? "FEMALE" : "MALE",
        birthDate: new Date(Date.UTC(1965 + (n % 35), n % 12, 1 + (n % 27))),
        bloodGroup: ["A_POS", "B_POS", "O_POS", "AB_POS"][n % 4],
        anamnesisText: `Randevular demo anamnesis for ${name}.`,
        anamnesisUpdatedAt: new Date(),
      },
    });

    const firstYmd = dayMap.get(0) || bakuYmd();
    const lastYmd = dayMap.get(6) || addDaysYmd(firstYmd, 6);
    const episode = await prisma.clinicalEpisode.create({
      data: {
        organizationId: ORG,
        patientRefId: patient.id,
        patientOrigin: n % 5 === 0 ? "WALK_IN" : "IN_HOUSE",
        programCode: template.code,
        reservationId,
        roomNumber: String(200 + (n % 40)),
        status: "OPEN",
        checkupCompletedAt: bakuDateAt(firstYmd, 8, 15),
      },
    });

    await prisma.clinicalComplaint.create({
      data: {
        episodeId: episode.id,
        text: "Sanatorium program — imported from Randevular week",
      },
    });
    await prisma.clinicalDiagnosis.create({
      data: {
        episodeId: episode.id,
        icdCodeId: icd?.id,
        icdCodeText: icd?.code ?? "M54.5",
        description: "Demo week diagnosis",
      },
    });

    await prisma.programInstance.create({
      data: {
        templateId: template.id,
        episodeId: episode.id,
        programCode: template.code,
        reservationId,
        startsOn: bakuDateAt(firstYmd, 0, 0),
        endsOn: bakuDateAt(lastYmd, 0, 0),
        procedureLines: {
          create: [
            { procedureCode: "MASSAGE", quotaTotal: 10, quotaUsed: 0 },
            { procedureCode: "USG", quotaTotal: 3, quotaUsed: 0 },
          ],
        },
      },
    });

    patientCache.set(name, { patient, episode, reservationId, n });
    episodeCache.set(name, episode);
  }

  // Minimum turnover break between consecutive procedures on the same resource.
  const MIN_GAP_MIN = 5;
  // Track last booking end per resource+day so demo data reflects the gap.
  const lastEndByResourceDay = new Map();
  // Place appointments in chronological order so the gap shift is stable.
  const orderedAppointments = [...appointments].sort(
    (a, b) => a.dayOffset - b.dayOffset || a.time.localeCompare(b.time),
  );

  for (const appt of orderedAppointments) {
    const ymd = dayMap.get(appt.dayOffset);
    if (!ymd) {
      skippedClosed += 1;
      continue;
    }
    const { h, m } = parseHm(appt.time);
    if (h >= 13 && h < 14) {
      skippedLunch += 1;
      continue;
    }

    const { patient, reservationId } = patientCache.get(appt.patientName);
    const resource = await ensureResource(appt.roomName, resourceCache);
    const procType = await ensureProcedureType(appt.procedureName, procCache, nameToCode);
    const pract = practitioners[orderCount % practitioners.length];
    const duration = alignDuration(procType.durationMin || DEFAULT_DURATION_MIN);
    let startsAt = bakuDateAt(ymd, h, m);
    const gapKey = `${resource.id}|${ymd}`;
    const prevEnd = lastEndByResourceDay.get(gapKey);
    if (prevEnd && startsAt.getTime() < prevEnd.getTime() + MIN_GAP_MIN * 60_000) {
      startsAt = new Date(prevEnd.getTime() + MIN_GAP_MIN * 60_000);
    }
    // A procedure must finish before lunch OR start after it — never overlap 13:00-14:00.
    const lunchStart = bakuDateAt(ymd, 13, 0);
    const lunchEnd = bakuDateAt(ymd, 14, 0);
    let endsAt = new Date(startsAt.getTime() + duration * 60_000);
    if (startsAt.getTime() < lunchEnd.getTime() && endsAt.getTime() > lunchStart.getTime()) {
      startsAt = new Date(lunchEnd.getTime());
      endsAt = new Date(startsAt.getTime() + duration * 60_000);
    }
    // End of day: allow at most a 10-min overrun past 18:00, otherwise drop.
    const dayEndCap = bakuDateAt(ymd, 18, 10);
    if (endsAt.getTime() > dayEndCap.getTime()) {
      skippedLate += 1;
      continue;
    }
    lastEndByResourceDay.set(gapKey, endsAt);
    const isPastMorning = ymd === dayMap.get(0) && h < 11;
    const status = isPastMorning && orderCount % 7 === 0 ? "COMPLETED" : "SCHEDULED";

    const order = await prisma.procedureOrder.create({
      data: {
        patientRefId: patient.id,
        procedureTypeId: procType.id,
        procedureCode: procType.code,
        procedureName: procType.name,
        scheduledAt: startsAt,
        endsAt,
        resourceId: resource.id,
        amountNet: 20,
        status,
        patientOrigin: "IN_HOUSE",
        reservationId,
        completedAt: status === "COMPLETED" ? endsAt : undefined,
      },
    });
    orderCount += 1;

    await prisma.resourceBooking.create({
      data: {
        resourceId: resource.id,
        practitionerId: pract.id,
        procedureOrderId: order.id,
        startsAt,
        endsAt,
      },
    });

    await prisma.procedureAllocation.createMany({
      data: [
        {
          procedureOrderId: order.id,
          role: "LOCATION",
          resourceId: resource.id,
          startsAt,
          endsAt,
        },
        {
          procedureOrderId: order.id,
          role: "STAFF",
          practitionerId: pract.id,
          startsAt,
          endsAt,
        },
      ],
    });
  }

  const ward = await prisma.ward.findFirst({
    where: { code: "WARD-A" },
    include: { beds: true },
  });
  if (ward?.beds?.length) {
    const demoPatients = await prisma.patientRef.findMany({
      where: { refCode: { startsWith: `${PREFIX}-P` } },
      take: Math.min(2, ward.beds.length),
      orderBy: { refCode: "asc" },
    });
    for (let i = 0; i < demoPatients.length; i += 1) {
      const bed = ward.beds[i];
      const admission = await prisma.inpatientAdmission.create({
        data: { patientRefId: demoPatients[i].id, status: "ADMITTED" },
      });
      await prisma.bedAssignment.create({
        data: {
          bedId: bed.id,
          patientRefId: demoPatients[i].id,
          admissionId: admission.id,
        },
      });
      await prisma.bed.update({
        where: { id: bed.id },
        data: { status: "OCCUPIED" },
      });
    }
  }

  console.log("DEMO-WEEK seed OK", {
    today: bakuYmd(),
    dayMap: Object.fromEntries(dayMap),
    patients: uniqueNames.length,
    episodes: uniqueNames.length,
    orderCount,
    resources: resourceCache.size,
    procedureTypes: procCache.size,
    skippedLunch,
    skippedClosed,
    skippedLate,
    org: ORG,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
