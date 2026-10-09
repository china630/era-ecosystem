import type { ImportTx } from '@/lib/import/types';
import { bookingSourceKind, isOtaAgency } from '@/lib/booking-source-kind';
import { ensureBarBasePlan } from '@/lib/pricing/bar-bootstrap.service';
import { bridgeRequestOrganizationId } from '@/lib/integration/elektraweb-bridge/config';
import { resolveOrCreateAgencyIdFromLabel } from '@/lib/integration/elektraweb-bridge/resolve-agency-from-ew';

/**
 * One Elektraweb sell-path resolver for the Rate Codes import and the live reservation bridge.
 * Elektra stores OTA channels (Booking.com, Expedia, …) as rate codes. Here they become
 * source `BOOKING` (OTA) + channel `Agency`, and the stay is priced on `BAR`. Real rate codes
 * (BAR, packages, contract rates) still resolve to a `RatePlan` by code.
 */

export type ElektraRateCodeInput = { code?: string | null; name?: string | null };

export type ElektraRateClassification =
  | { kind: 'channel'; channelLabel: string }
  | { kind: 'rate'; code: string | null };

const CHANNEL_LABELS: ReadonlyArray<readonly [RegExp, string]> = [
  [/BOOKING/i, 'Booking.com'],
  [/EXPEDIA/i, 'Expedia'],
  [/AGODA/i, 'Agoda'],
  [/AIRBNB/i, 'Airbnb'],
  [/HALAL/i, 'HalalBooking'],
  [/OSTROVOK/i, 'Ostrovok'],
  [/EXELY/i, 'Exely'],
  [/CHANNEX/i, 'Channex'],
];

const OTA_SOURCE = { code: 'BOOKING', name: 'OTA' } as const;

function clean(value: string | null | undefined): string | null {
  const t = value?.replace(/\s+/g, ' ').trim();
  return t ? t : null;
}

/** BAR family and packages are always real prices, even when their group mentions a channel. */
function isProtectedRateCode(code: string): boolean {
  const c = code.toUpperCase();
  return c === 'BAR' || /^BAR[-_\s]/.test(c) || /^PKG/.test(c);
}

export function channelLabelForRateCode(code: string, name?: string | null): string {
  const blob = `${code} ${name ?? ''}`;
  for (const [re, label] of CHANNEL_LABELS) {
    if (re.test(blob)) return label;
  }
  return clean(name) ?? code;
}

export function classifyElektraRateCode(input: ElektraRateCodeInput): ElektraRateClassification {
  const code = clean(input.code);
  const name = clean(input.name);
  if (code && !isProtectedRateCode(code) && isOtaAgency(code, name)) {
    return { kind: 'channel', channelLabel: channelLabelForRateCode(code, name) };
  }
  if (!code && name && isOtaAgency(null, name)) {
    return { kind: 'channel', channelLabel: channelLabelForRateCode(name, name) };
  }
  return { kind: 'rate', code };
}

export type SellPathDb = Pick<ImportTx, 'ratePlan' | 'agency' | 'bookingSource'>;

export async function otaBookingSourceId(db: SellPathDb, organizationId: string): Promise<string> {
  const rows = await db.bookingSource.findMany({ select: { id: true, code: true } });
  const hit =
    rows.find((r) => r.code.toUpperCase() === OTA_SOURCE.code) ??
    rows.find((r) => bookingSourceKind(r.code) === 'BOOKING');
  if (hit) return hit.id;
  const created = await db.bookingSource.upsert({
    where: { organizationId_code: { organizationId, code: OTA_SOURCE.code } },
    create: { organizationId, code: OTA_SOURCE.code, name: OTA_SOURCE.name },
    update: {},
    select: { id: true },
  });
  return created.id;
}

/** Existing OTA agency for the same channel keyword (e.g. `BOOKING.COM LLC`), else find-or-create by label. */
export async function channelAgencyId(db: SellPathDb, label: string, organizationId: string): Promise<string> {
  const keyword = CHANNEL_LABELS.find(([, l]) => l === label)?.[0];
  if (keyword) {
    const agencies = await db.agency.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    const hit = agencies.find((a) => keyword.test(a.code) || keyword.test(a.name));
    if (hit) return hit.id;
  }
  return resolveOrCreateAgencyIdFromLabel(label, db as never, organizationId);
}

export type ElektraSellPath = {
  ratePlanId: string;
  /** Set only for channel rows: OTA source + channel agency. */
  sourceId: string | null;
  agencyId: string | null;
  channel: boolean;
};

/** Bridge path: rate code from a reservation row → price plan, and for channels the OTA source + agency. */
export async function resolveElektraSellPath(
  db: SellPathDb,
  input: ElektraRateCodeInput,
  organizationId: string = bridgeRequestOrganizationId(),
): Promise<ElektraSellPath> {
  const cls = classifyElektraRateCode(input);
  if (cls.kind === 'channel') {
    const { ratePlanId } = await ensureBarBasePlan(db);
    const [sourceId, agencyId] = await Promise.all([
      otaBookingSourceId(db, organizationId),
      channelAgencyId(db, cls.channelLabel, organizationId),
    ]);
    return { ratePlanId, sourceId, agencyId, channel: true };
  }
  if (cls.code) {
    const plan = await db.ratePlan.findFirst({
      where: {
        OR: [
          { code: { equals: cls.code, mode: 'insensitive' } },
          { name: { equals: cls.code, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (plan) return { ratePlanId: plan.id, sourceId: null, agencyId: null, channel: false };
  }
  const { ratePlanId } = await ensureBarBasePlan(db);
  return { ratePlanId, sourceId: null, agencyId: null, channel: false };
}

/**
 * Import path for one `07-Rate-Codes` row. Channel codes never become rate plans:
 * they ensure the OTA source and channel agency instead and report `skipped`.
 */
export async function upsertElektraRateCode(
  db: SellPathDb,
  row: { code: string; name: string },
  dryRun: boolean,
  organizationId: string = bridgeRequestOrganizationId(),
): Promise<'created' | 'updated' | 'skipped'> {
  const cls = classifyElektraRateCode(row);
  if (cls.kind === 'channel') {
    if (!dryRun) {
      await otaBookingSourceId(db, organizationId);
      await channelAgencyId(db, cls.channelLabel, organizationId);
    }
    return 'skipped';
  }
  const existing = await db.ratePlan.findFirst({ where: { code: row.code }, select: { id: true } });
  if (dryRun) return existing ? 'updated' : 'created';
  // Flat Elektra tariff: own pricePerNight, no BAR parent. Night audit must not
  // treat a missing derivedFromId as a derivation (see usesBarCalendar).
  await db.ratePlan.upsert({
    where: { code: row.code } as never,
    create: {
      code: row.code,
      name: row.name,
      type: 'DERIVED',
      pricePerNight: 0,
      active: true,
    } as never,
    update: { name: row.name, active: true },
  });
  return existing ? 'updated' : 'created';
}
