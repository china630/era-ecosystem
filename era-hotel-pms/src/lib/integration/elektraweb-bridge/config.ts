import { ROLE_CODES, type RoleCode } from '@/lib/auth/permissions';
import { satelliteOrganizationId } from '@era/satellite-kit';

const BRIDGE_ROLES = new Set<string>([
  ROLE_CODES.HOTEL_ADMIN,
  ROLE_CODES.MANAGER,
  ROLE_CODES.RECEPTIONIST,
  ROLE_CODES.NIGHT_AUDITOR,
]);

export function isElektrawebBridgeEnabled(): boolean {
  return process.env.ELEKTRAWEB_BRIDGE_ENABLED === '1';
}

/** ERA tenant for this hotel-pms deployment (single-org satellite). */
export function getBridgeOrganizationId(): string {
  return satelliteOrganizationId();
}

/** Elektraweb property id (e.g. Nafta 31606) — must match payload HOTELID. */
export function getExpectedElektrawebHotelId(): number {
  const raw = process.env.ELEKTRAWEB_HOTEL_ID?.trim();
  if (!raw) {
    throw new Error('ELEKTRAWEB_HOTEL_ID is not configured');
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('ELEKTRAWEB_HOTEL_ID must be a positive number');
  }
  return n;
}

export function getOptionalBridgeSharedToken(): string | null {
  const t = process.env.ELEKTRAWEB_BRIDGE_TOKEN?.trim();
  return t || null;
}

export function roleMayUseBridge(role: string): boolean {
  return BRIDGE_ROLES.has(role as RoleCode) || role === 'DIRECTOR' || role === 'OWNER';
}

export function assertHotelIdMatches(hotelId: number | string | null | undefined): void {
  const expected = getExpectedElektrawebHotelId();
  const actual = Number(hotelId);
  if (!Number.isFinite(actual) || actual !== expected) {
    throw new Error(
      `Elektraweb HOTELID mismatch: got ${hotelId ?? 'missing'}, expected ${expected} for org ${getBridgeOrganizationId()}`,
    );
  }
}
