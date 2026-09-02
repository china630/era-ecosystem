/**
 * Standalone MDM patient backfill (droplet-safe, no path aliases).
 *
 * Usage:
 *   MDM_INTERNAL_SERVICE_TOKEN=... DATABASE_URL=... ORCHESTRATOR_EVENT_URL=... \
 *     HOTEL_PMS_URL=... SATELLITE_EVENT_SERVICE_TOKEN=... \
 *     node scripts/ops/backfill-patient-mdm.mjs [--dry-run] [--limit=N]
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number.parseInt(limitArg.slice(8), 10) : undefined;

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '../../package.json'));
const { PrismaClient } = require('@prisma/client');

const baseUrl = (process.env.ORCHESTRATOR_EVENT_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const hotelUrl = (process.env.HOTEL_PMS_URL || 'http://127.0.0.1:3201').replace(/\/$/, '');
const token =
  process.env.MDM_INTERNAL_SERVICE_TOKEN?.trim() ||
  process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN?.trim() ||
  process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
  process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
  '';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
if (!token) {
  console.error('service token env is required');
  process.exit(1);
}

const prisma = new PrismaClient();

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-service-token': token,
  };
}

function isValidAzFin(fin) {
  return /^[0-9A-HJ-NP-Za-hj-np-z]{7}$/.test(fin.trim());
}

async function lookupHotelGuestByIdentity(fullName, birthDate, phone) {
  const bd = (birthDate ?? '').slice(0, 10);
  if (!fullName?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(bd)) return null;
  const qs = new URLSearchParams({ fullName: fullName.trim(), birthDate: bd });
  if (phone?.trim()) qs.set('phone', phone.trim());
  const res = await fetch(`${hotelUrl}/api/internal/v1/guests/by-identity?${qs}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const id = data.data?.globalPersonId ?? data.globalPersonId;
  return id?.trim() || null;
}

async function lookupHotelStayGlobalPerson(hotelResNo, folioPerson) {
  if (!hotelResNo?.trim()) return null;
  const qs = new URLSearchParams({ externalRef: hotelResNo.trim() });
  if (folioPerson) qs.set('folioPerson', String(folioPerson));
  const res = await fetch(`${hotelUrl}/api/internal/v1/stays/by-external-ref?${qs}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const id = data.data?.globalPersonId ?? data.globalPersonId;
  return id?.trim() || null;
}

async function linkPersonIdentity(body) {
  const res = await fetch(`${baseUrl}/internal/v1/mdm/persons/resolve`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MDM resolve ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.globalPersonId ?? data.id ?? null;
}

async function resolvePatientMdm(patient, hotelResNo) {
  const fullName = patient.fullName?.trim();
  if (!fullName) return null;

  const birthDate = patient.birthDate?.toISOString().slice(0, 10);
  let seed =
    (await lookupHotelGuestByIdentity(fullName, birthDate, patient.phone)) ||
    (hotelResNo ? await lookupHotelStayGlobalPerson(hotelResNo) : null);

  const sex = patient.sex === 'MALE' ? 'M' : patient.sex === 'FEMALE' ? 'F' : undefined;

  try {
    const linked = await linkPersonIdentity({
      firstName: patient.firstName || undefined,
      middleName: patient.middleName || undefined,
      lastName: patient.lastName || undefined,
      fullName,
      phone: patient.phone ?? undefined,
      nationality: patient.nationality ?? undefined,
      sex,
      birthDate,
      globalPersonId: seed || undefined,
    });
    return linked?.trim() || seed || null;
  } catch {
    return seed || null;
  }
}

async function main() {
  const patients = await prisma.patientRef.findMany({
    where: { globalPersonId: null },
    orderBy: { id: 'asc' },
    ...(limit && Number.isFinite(limit) ? { take: limit } : {}),
  });

  console.log(`Found ${patients.length} patients without globalPersonId (dryRun=${dryRun})`);

  let linked = 0;
  let failed = 0;

  for (const patient of patients) {
    const episode = await prisma.clinicalEpisode.findFirst({
      where: { patientRefId: patient.id },
      orderBy: { openedAt: 'desc' },
      select: { reservationId: true },
    });

    if (dryRun) {
      linked += 1;
      continue;
    }

    const globalPersonId = await resolvePatientMdm(patient, episode?.reservationId ?? undefined);
    if (globalPersonId?.trim()) {
      await prisma.patientRef.update({
        where: { id: patient.id },
        data: { globalPersonId: globalPersonId.trim() },
      });
      linked += 1;
    } else {
      failed += 1;
    }
  }

  console.log(JSON.stringify({ total: patients.length, linked, failed, dryRun }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
