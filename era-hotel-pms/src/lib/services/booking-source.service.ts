import { prisma } from '@/lib/prisma';
import {
  bookingSourceKind,
  inferSourceKindFromAgency,
  type BookingSourceKind,
} from '@/lib/booking-source-kind';

/** FO sell paths every org gets: manual (reception) + automatic (channel / website). */
export const FO_BOOKING_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ['WALKIN', 'Walk-in'],
  ['AGENCY', 'Agency'],
  ['CORPORATE', 'Corporate'],
  ['BOOKING', 'OTA'],
  ['WEB', 'Direct website'],
];

const CODE_BY_KIND: Partial<Record<BookingSourceKind, readonly [string, string]>> =
  Object.fromEntries(FO_BOOKING_SOURCES.map((row) => [bookingSourceKind(row[0]), row]));

export async function ensureFoBookingSources(organizationId: string): Promise<void> {
  for (const [code, name] of FO_BOOKING_SOURCES) {
    await prisma.bookingSource.upsert({
      where: { organizationId_code: { organizationId, code } },
      create: { organizationId, code, name },
      update: {},
    });
  }
}

/** Canonical source row for a sell path; prefers the FO code, then any row of that kind. */
export async function bookingSourceIdForKind(
  organizationId: string,
  kind: BookingSourceKind,
): Promise<string | null> {
  const canonical = CODE_BY_KIND[kind];
  if (!canonical) return null;
  const rows = await prisma.bookingSource.findMany({ select: { id: true, code: true } });
  const hit =
    rows.find((r) => r.code.toUpperCase() === canonical[0]) ??
    rows.find((r) => bookingSourceKind(r.code) === kind);
  if (hit) return hit.id;
  const [code, name] = canonical;
  const created = await prisma.bookingSource.upsert({
    where: { organizationId_code: { organizationId, code } },
    create: { organizationId, code, name },
    update: {},
    select: { id: true },
  });
  return created.id;
}

/** Legacy imports carry only an Agency row (`EXPEDIA`, `WALKIN MEDICAL`, …); derive the sell path. */
export async function bookingSourceIdFromAgency(
  organizationId: string,
  agencyId: string | null | undefined,
): Promise<string | null> {
  if (!agencyId) return null;
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { code: true, name: true },
  });
  if (!agency) return null;
  const kind = inferSourceKindFromAgency(agency.code, agency.name);
  return kind ? bookingSourceIdForKind(organizationId, kind) : null;
}
