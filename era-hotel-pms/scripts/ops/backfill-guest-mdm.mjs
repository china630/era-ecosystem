/**
 * Standalone MDM guest backfill (no @/ path aliases — safe on droplet host).
 *
 * Usage:
 *   MDM_INTERNAL_SERVICE_TOKEN=... DATABASE_URL=... ORCHESTRATOR_EVENT_URL=http://127.0.0.1:4000 \
 *     node scripts/ops/backfill-guest-mdm.mjs [--dry-run] [--limit=N]
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

const baseUrl = (process.env.ORCHESTRATOR_EVENT_URL || process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const token =
  process.env.MDM_INTERNAL_SERVICE_TOKEN?.trim() ||
  process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN?.trim() ||
  process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
  '';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
if (!token) {
  console.error('MDM_INTERNAL_SERVICE_TOKEN (or ORCHESTRATOR_INTERNAL / CONTROL_PLANE) is required');
  process.exit(1);
}

const prisma = new PrismaClient();
const FIN_DOC_TYPES = new Set(['ID_CARD', 'FIN', 'NATIONAL_ID']);
const PASSPORT_DOC_TYPES = new Set(['PASSPORT']);

function pickDocNumber(documents, types) {
  const match = documents.find((d) => types.has(d.docType) && d.docNumber?.trim());
  return match?.docNumber.trim();
}

async function resolvePersonIdentity(input) {
  const res = await fetch(`${baseUrl}/internal/v1/mdm/persons/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-service-token': token,
    },
    body: JSON.stringify({
      fin: input.fin,
      passport: input.passport,
      issuingCountry: input.issuingCountry,
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: input.fullName,
      phone: input.phone,
      nationality: input.nationality,
      sex: input.sex,
      birthDate: input.birthDate,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`MDM resolve ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.globalPersonId ?? data.id ?? null;
}

async function main() {
  const guests = await prisma.guest.findMany({
    where: { globalPersonId: null },
    include: { documents: true },
    orderBy: { id: 'asc' },
    ...(limit && Number.isFinite(limit) ? { take: limit } : {}),
  });

  console.log(`Found ${guests.length} guests without globalPersonId (dryRun=${dryRun})`);

  let linked = 0;
  let failed = 0;
  let skipped = 0;

  for (const guest of guests) {
    const fin = pickDocNumber(guest.documents, FIN_DOC_TYPES);
    const passport = pickDocNumber(guest.documents, PASSPORT_DOC_TYPES);
    if (!fin && !passport && !guest.fullName?.trim()) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      linked += 1;
      continue;
    }

    try {
      const globalPersonId = await resolvePersonIdentity({
        fin: fin || undefined,
        passport: passport || undefined,
        issuingCountry: guest.nationality || 'AZ',
        firstName: guest.firstName ?? undefined,
        lastName: guest.lastName ?? undefined,
        fullName: guest.fullName,
        phone: guest.phone ?? undefined,
        nationality: guest.nationality || 'AZ',
        sex: guest.sex ?? undefined,
        birthDate: guest.birthDate?.toISOString().slice(0, 10),
      });

      if (globalPersonId?.trim()) {
        await prisma.guest.update({
          where: { id: guest.id },
          data: { globalPersonId: globalPersonId.trim() },
        });
        linked += 1;
        if (linked % 100 === 0) console.log(`... linked ${linked}`);
      } else {
        failed += 1;
      }
    } catch (err) {
      failed += 1;
      console.warn(`Guest ${guest.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(JSON.stringify({ total: guests.length, linked, failed, skipped, dryRun }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
