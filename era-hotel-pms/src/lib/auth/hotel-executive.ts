import {
  PERMISSIONS,
  type Permission,
} from '@/lib/auth/permissions';
import {
  sessionHasHotelPermission,
  type HotelPermissionSession,
} from '@/lib/auth/permission-check';

/** Executive KPI pages/APIs: reports or reservations read (any-of). */
export const HOTEL_EXECUTIVE_PERMISSIONS: Permission[] = [
  PERMISSIONS.REPORTS_READ,
  PERMISSIONS.RESERVATIONS_READ,
];

export function canViewHotelExecutive(
  session: HotelPermissionSession | null | undefined,
): boolean {
  if (!session) return false;
  return HOTEL_EXECUTIVE_PERMISSIONS.some((p) =>
    sessionHasHotelPermission(session, p),
  );
}
