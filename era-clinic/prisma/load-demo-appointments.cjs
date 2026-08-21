/**
 * DEMO-WEEK outpatient appointments for /appointments + /doctor queues.
 * Safe to re-run: wipes appointments/visits for DEMO-WEEK patients first.
 *
 * Run: node prisma/load-demo-appointments.cjs
 * Optional: DEMO_SANATORIUM_FROM / DEMO_SANATORIUM_TO (defaults last Mon → next Sat Baku)
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const PREFIX = "DEMO-WEEK";

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

function mondayOfWeek(ymd) {
  const dow = weekdaySun0(ymd);
  const daysSinceMon = dow === 0 ? 6 : dow - 1;
  return addDaysYmd(ymd, -daysSinceMon);
}

function resolveWindow() {
  const fromEnv = process.env.DEMO_SANATORIUM_FROM?.trim();
  const toEnv = process.env.DEMO_SANATORIUM_TO?.trim();
  if (fromEnv && toEnv) return { from: fromEnv, to: toEnv };
  const today = bakuYmd();
  const thisMon = mondayOfWeek(today);
  return { from: addDaysYmd(thisMon, -7), to: addDaysYmd(thisMon, 12) };
}

function openWeekdays(fromYmd, toYmd) {
  const days = [];
  let cursor = fromYmd;
  while (cursor <= toYmd) {
    if (weekdaySun0(cursor) !== 0) days.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return days;
}

function bakuAt(ymd, hour, minute) {
  return new Date(
    `${ymd}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+04:00`,
  );
}

/** Prefer chief / therapists for outpatient demo slots. */
const DOC_CODES = ["DOC-RENA", "DOC-KEMAL", "DOC-AZADE", "DOC-TURAN", "DOC-RAFIQ"];

/** Slots per day (avoid lunch 13–14). */
const DAY_SLOTS = [
  { h: 9, m: 0 },
  { h: 9, m: 30 },
  { h: 10, m: 0 },
  { h: 10, m: 30 },
  { h: 11, m: 0 },
  { h: 11, m: 30 },
  { h: 12, m: 0 },
  { h: 14, m: 0 },
  { h: 14, m: 30 },
  { h: 15, m: 0 },
  { h: 15, m: 30 },
  { h: 16, m: 0 },
];

async function wipeDemoAppointments(patientIds) {
  if (!patientIds.length) return { appointments: 0, visits: 0 };

  const appointments = await prisma.appointment.findMany({
    where: { patientRefId: { in: patientIds } },
    select: { id: true },
  });
  const apptIds = appointments.map((a) => a.id);

  const visits = await prisma.visit.findMany({
    where: {
      OR: [
        { patientRefId: { in: patientIds } },
        ...(apptIds.length ? [{ appointmentId: { in: apptIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const visitIds = visits.map((v) => v.id);

  if (visitIds.length) {
    try {
      await prisma.visitServiceLine.deleteMany({ where: { visitId: { in: visitIds } } });
    } catch {
      /* optional */
    }
    try {
      await prisma.cpoeEntry.deleteMany({ where: { visitId: { in: visitIds } } });
    } catch {
      /* optional */
    }
    await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
  }

  if (apptIds.length) {
    await prisma.resourceBooking.deleteMany({
      where: { appointmentId: { in: apptIds } },
    });
    await prisma.appointment.deleteMany({ where: { id: { in: apptIds } } });
  }

  console.log("DEMO appointments wipe", {
    appointments: apptIds.length,
    visits: visitIds.length,
  });
  return { appointments: apptIds.length, visits: visitIds.length };
}

async function main() {
  const patients = await prisma.patientRef.findMany({
    where: { refCode: { startsWith: `${PREFIX}-P` } },
    orderBy: { refCode: "asc" },
    select: { id: true, refCode: true, fullName: true },
  });
  if (!patients.length) {
    throw new Error("No DEMO-WEEK patients — run load-sanatorium-week.cjs first");
  }

  await wipeDemoAppointments(patients.map((p) => p.id));

  const practitioners = [];
  for (const code of DOC_CODES) {
    const row = await prisma.practitioner.findUnique({ where: { code } });
    if (row) practitioners.push(row);
  }
  if (!practitioners.length) {
    const any = await prisma.practitioner.findMany({
      where: { active: true, staffKind: "DOCTOR" },
      take: 5,
      orderBy: { code: "asc" },
    });
    practitioners.push(...any);
  }
  if (!practitioners.length) throw new Error("No practitioners");

  const { from, to } = resolveWindow();
  const days = openWeekdays(from, to);
  // Dense but not huge: ~3 appointments × practitioners on selected showcase days
  const showcase = days.filter((_, i) => i % 2 === 0).slice(0, 8);
  if (!showcase.length) showcase.push(...days.slice(0, 3));

  const today = bakuYmd();
  let created = 0;
  let withVisit = 0;
  let patientIdx = 0;

  for (const ymd of showcase) {
    for (let pi = 0; pi < practitioners.length; pi += 1) {
      const pract = practitioners[pi];
      // 2–3 slots per doctor per showcase day
      const slotsForDoc = DAY_SLOTS.filter((_, si) => (si + pi) % 4 === 0).slice(0, 3);
      for (const slot of slotsForDoc) {
        const patient = patients[patientIdx % patients.length];
        patientIdx += 1;
        const scheduledAt = bakuAt(ymd, slot.h, slot.m);
        const isPast = ymd < today;
        const isTodayMorning = ymd === today && slot.h < 12;
        let status = "SCHEDULED";
        if (isPast) {
          status = created % 3 === 0 ? "COMPLETED" : created % 3 === 1 ? "CHECKED_IN" : "SCHEDULED";
        } else if (isTodayMorning) {
          status = "CHECKED_IN";
        }

        const appt = await prisma.appointment.create({
          data: {
            patientRefId: patient.id,
            practitionerId: pract.id,
            scheduledAt,
            roomCode: `${PREFIX}-CAB`,
            status,
          },
        });
        created += 1;

        if (status === "CHECKED_IN" || status === "COMPLETED") {
          await prisma.visit.create({
            data: {
              appointmentId: appt.id,
              patientRefId: patient.id,
              practitionerId: pract.id,
              status: status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
              patientOrigin: "IN_HOUSE",
              amountNet: 50,
              completedAt: status === "COMPLETED" ? scheduledAt : undefined,
            },
          });
          withVisit += 1;
        }
      }
    }
  }

  console.log("DEMO appointments seed OK", {
    today,
    window: { from, to },
    showcaseDays: showcase,
    patients: patients.length,
    practitioners: practitioners.map((p) => p.code),
    appointments: created,
    visits: withVisit,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
