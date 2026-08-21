/**
 * Idempotent DEMO-WEEK seed from Nafta Randevular week export
 * (prisma/seed-data/nafta/randevular-week.json — Jul 13–19 2026).
 *
 * Remaps source dayOffset (0..6) onto an open Asia/Baku window (skips Sundays),
 * tiling the week pattern across the range for a dense planner demo.
 *
 * Window (env override or default):
 *   DEMO_SANATORIUM_FROM=YYYY-MM-DD
 *   DEMO_SANATORIUM_TO=YYYY-MM-DD
 * Default: Monday of last week → Saturday of next week (Baku calendar).
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

/** Monday of calendar week containing `ymd` (Mon–Sun weeks). */
function mondayOfWeek(ymd) {
  const dow = weekdaySun0(ymd); // 0=Sun … 6=Sat
  const daysSinceMon = dow === 0 ? 6 : dow - 1;
  return addDaysYmd(ymd, -daysSinceMon);
}

function resolveDemoWindow() {
  const fromEnv = process.env.DEMO_SANATORIUM_FROM?.trim();
  const toEnv = process.env.DEMO_SANATORIUM_TO?.trim();
  if (fromEnv && toEnv) return { from: fromEnv, to: toEnv };
  const today = bakuYmd();
  const thisMon = mondayOfWeek(today);
  const lastMon = addDaysYmd(thisMon, -7);
  const nextSat = addDaysYmd(thisMon, 12); // next week's Saturday
  return { from: lastMon, to: nextSat };
}

/** Open (non-Sunday) Baku dates in [from, to] inclusive. */
function openDaysInRange(fromYmd, toYmd) {
  const days = [];
  let cursor = fromYmd;
  while (cursor <= toYmd) {
    if (weekdaySun0(cursor) !== 0) days.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return days;
}

/**
 * WO Randevular export often covers only Mon–Tue (dayOffset 0–1). Map each open
 * demo day to a source offset that actually has appointments (prefer weekday match,
 * else cycle available offsets) so the planner is dense Mon–Sat across the window.
 */
function sourceOffsetsPresent(appointments) {
  const set = new Set();
  for (const a of appointments) set.add(Number(a.dayOffset) || 0);
  return [...set].sort((a, b) => a - b);
}

function sourceOffsetForOpenDay(ymd, available) {
  if (!available.length) return 0;
  const dow = weekdaySun0(ymd); // Sun=0 … Sat=6
  const preferred = dow === 0 ? 6 : dow - 1; // Mon=0 … Sat=5
  if (available.includes(preferred)) return preferred;
  return available[preferred % available.length];
}

/** openYmd → source dayOffset used for that calendar day */
function buildOpenDaySourceMap(appointments) {
  const { from, to } = resolveDemoWindow();
  const openDays = openDaysInRange(from, to);
  const available = sourceOffsetsPresent(appointments);
  const map = new Map();
  for (const ymd of openDays) {
    map.set(ymd, sourceOffsetForOpenDay(ymd, available));
  }
  map._meta = {
    from,
    to,
    openDays: openDays.length,
    sourceOffsets: available,
  };
  return map;
}

/** Nafta doctors from WO export (hekimler) — ensure enough practitioners for STAFF allocations. */
const DEMO_DOCTORS = [
  { code: "DOC-RENA", fullName: "Rəna Kəngərli", specialty: "Chief physician" },
  { code: "DOC-KEMAL", fullName: "Kəmaləddin Sahmuradov", specialty: "Therapist" },
  { code: "DOC-AZADE", fullName: "Azadə Mustafayeva", specialty: "Doctor" },
  { code: "DOC-TURAN", fullName: "Turanə Məmmədzadə", specialty: "Cosmetologist" },
  { code: "DOC-RAFIQ", fullName: "Rafiq Huseynov", specialty: "Physiotherapist" },
  { code: "NURSE-LEYLA", fullName: "Leyla Qasımova", specialty: "Senior nurse" },
];

function inferStaffKind(p) {
  const blob = `${p.specialty || ""} ${p.code || ""}`.toLowerCase();
  if (blob.includes("nurse") || blob.startsWith("nr-") || blob.includes("nurse-")) return "NURSE";
  if (blob.includes("lab")) return "LAB";
  return "DOCTOR";
}

async function ensureDemoPractitioners() {
  const out = [];
  for (const d of DEMO_DOCTORS) {
    const staffKind = inferStaffKind(d);
    let row = await prisma.practitioner.findUnique({ where: { code: d.code } });
    if (!row) {
      row = await prisma.practitioner.create({
        data: {
          code: d.code,
          fullName: d.fullName,
          specialty: d.specialty,
          staffKind,
          active: true,
        },
      });
    } else if (row.staffKind !== staffKind) {
      row = await prisma.practitioner.update({
        where: { id: row.id },
        data: { staffKind },
      });
    }
    out.push(row);
  }
  const extra = await prisma.practitioner.findMany({
    where: { code: { notIn: DEMO_DOCTORS.map((x) => x.code) } },
    orderBy: { code: "asc" },
    take: 6,
  });
  return [...out, ...extra];
}

/** Minimal bootstrap when seed-vnext never ran (prod image without kit). */
async function ensureBootstrap() {
  let template = await prisma.programTemplate.findUnique({ where: { code: "DETOX-7" } });
  if (!template) {
    template = await prisma.programTemplate.create({
      data: {
        code: "DETOX-7",
        name: "Detox 7 days",
        durationDays: 7,
        procedures: {
          create: [
            { procedureCode: "MASSAGE", procedureName: "Massage", quotaTotal: 5, avoidAfterHour: 14 },
            { procedureCode: "USG", procedureName: "Ultrasound", quotaTotal: 2 },
          ],
        },
      },
    });
    console.log("Created ProgramTemplate DETOX-7");
  }

  let icd = await prisma.icdCode.findFirst({
    where: { code: "M54.5", selectable: true, active: true },
  });
  if (!icd) {
    console.warn("ICD-10 M54.5 missing — run node prisma/load-icd10.cjs first");
  }

  let ward = await prisma.ward.findFirst({ where: { code: "WARD-A" } });
  if (!ward) {
    ward = await prisma.ward.create({
      data: {
        code: "WARD-A",
        name: "Ward A",
        beds: {
          create: [
            { code: "A1", status: "AVAILABLE" },
            { code: "A2", status: "AVAILABLE" },
          ],
        },
      },
    });
    console.log("Created WARD-A");
  }

  return { template, icd };
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
    try {
      await prisma.procedureChargeLog.deleteMany({
        where: { patientRefId: { in: patientIds } },
      });
    } catch {
      /* optional */
    }
    try {
      await prisma.labOrder.deleteMany({
        where: {
          OR: [
            { patientRefId: { in: patientIds } },
            { telehealthUrl: "demo:lab-usg-v1" },
          ],
        },
      });
    } catch {
      /* optional if LabOrder absent */
    }
    try {
      await prisma.clinicReceipt.deleteMany({
        where: { patientRefId: { in: patientIds } },
      });
    } catch {
      /* optional */
    }
    try {
      const visits = await prisma.visit.findMany({
        where: { patientRefId: { in: patientIds } },
        select: { id: true },
      });
      const visitIds = visits.map((v) => v.id);
      if (visitIds.length) {
        await prisma.visitServiceLine.deleteMany({ where: { visitId: { in: visitIds } } });
        await prisma.cpoeEntry.deleteMany({ where: { visitId: { in: visitIds } } });
        await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
      }
    } catch {
      /* optional */
    }
    try {
      await prisma.appointment.deleteMany({
        where: { patientRefId: { in: patientIds } },
      });
    } catch {
      /* optional */
    }
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

  const { template, icd: bootIcd } = await ensureBootstrap();
  const openDaySource = buildOpenDaySourceMap(appointments);
  const windowMeta = openDaySource._meta || {};
  const allOpenDays = [...openDaySource.keys()]
    .filter((k) => typeof k === "string")
    .sort();
  const firstYmd = allOpenDays[0] || bakuYmd();
  const lastYmd = allOpenDays[allOpenDays.length - 1] || firstYmd;
  const todayYmd = bakuYmd();

  /** source dayOffset → appointments[] */
  const bySourceOffset = new Map();
  for (const appt of appointments) {
    const off = Number(appt.dayOffset) || 0;
    if (!bySourceOffset.has(off)) bySourceOffset.set(off, []);
    bySourceOffset.get(off).push(appt);
  }
  for (const [, list] of bySourceOffset) {
    list.sort((a, b) => a.time.localeCompare(b.time) || String(a.roomName).localeCompare(String(b.roomName)));
  }

  const practitioners = await ensureDemoPractitioners();
  if (!practitioners.length) throw new Error("No practitioners");

  const icd =
    bootIcd ||
    (await prisma.icdCode.findFirst({ where: { code: "M54.5" } })) ||
    (await prisma.icdCode.findFirst());

  const resourceCache = new Map();
  const procCache = new Map();
  const patientCache = new Map();
  const episodeCache = new Map();
  const nameToCode = loadRandevuProcedureMap();
  console.log("Randevu procedure map entries:", nameToCode.size);
  console.log("Demo window:", windowMeta);

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
    if (icd?.id) {
      await prisma.clinicalDiagnosis.create({
        data: {
          episodeId: episode.id,
          icdCodeId: icd.id,
          note: "Demo week diagnosis",
        },
      });
    }

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

  for (const ymd of allOpenDays) {
    const srcOffset = openDaySource.get(ymd);
    const dayAppts = bySourceOffset.get(srcOffset) || [];
    if (!dayAppts.length) {
      skippedClosed += 1;
      continue;
    }
    for (const appt of dayAppts) {
      const { h, m } = parseHm(appt.time);
      if (h >= 13 && h < 14) {
        skippedLunch += 1;
        continue;
      }

      const cached = patientCache.get(appt.patientName);
      if (!cached?.patient) continue;
      const { patient, reservationId } = cached;
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
      const isPastDay = ymd < todayYmd;
      const isTodayMorning = ymd === todayYmd && h < 11;
      let status = "SCHEDULED";
      if (isPastDay) {
        status =
          orderCount % 5 === 0 ? "COMPLETED" : orderCount % 5 === 1 ? "CHECKED_IN" : "SCHEDULED";
      } else if (isTodayMorning && orderCount % 7 === 0) {
        status = "COMPLETED";
      }

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

  const daySourceLog = {};
  for (const ymd of allOpenDays) daySourceLog[ymd] = openDaySource.get(ymd);
  console.log("DEMO-WEEK seed OK", {
    today: todayYmd,
    window: windowMeta,
    daySourceMap: daySourceLog,
    patients: uniqueNames.length,
    episodes: uniqueNames.length,
    orderCount,
    resources: resourceCache.size,
    procedureTypes: procCache.size,
    practitioners: practitioners.length,
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
