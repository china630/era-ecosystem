import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";

/**
 * Coarse pathname → permission(s) for page middleware (any-of).
 * Uses existing catalog keys (no screen:* in this wave).
 */
export function routePermissions(pathname: string): Permission[] | null {
  if (pathname === "/settings/access" || pathname.startsWith("/settings/access/")) {
    return [PERMISSIONS.ACCESS_MANAGE];
  }
  if (pathname === "/settings/users" || pathname.startsWith("/settings/users/")) {
    return [PERMISSIONS.USERS_MANAGE];
  }
  if (pathname === "/fo/rack" || pathname.startsWith("/fo/rack")) {
    return [PERMISSIONS.RESERVATIONS_READ];
  }
  if (pathname.startsWith("/fo/") || pathname.startsWith("/bookings/")) {
    return [PERMISSIONS.RESERVATIONS_READ];
  }
  if (pathname.startsWith("/hk")) {
    // Align with nav: housekeeper or FO with rooms:status
    return [PERMISSIONS.HOUSEKEEPING_MANAGE, PERMISSIONS.ROOMS_STATUS];
  }
  if (pathname.startsWith("/medical")) {
    return [PERMISSIONS.MEDICAL_MANAGE];
  }
  if (pathname.startsWith("/distribution")) {
    return [PERMISSIONS.CHANNEL_MANAGE];
  }
  if (pathname.startsWith("/night-audit")) {
    return [PERMISSIONS.NIGHT_AUDIT_RUN, PERMISSIONS.REPORTS_READ];
  }
  if (pathname.startsWith("/front-cash")) {
    // Receptionist FO cash: folio grants, not only reports
    return [
      PERMISSIONS.FOLIO_READ,
      PERMISSIONS.FOLIO_PAYMENT,
      PERMISSIONS.REPORTS_READ,
    ];
  }
  if (pathname.startsWith("/reports")) {
    return [PERMISSIONS.REPORTS_READ];
  }
  if (pathname.startsWith("/folio")) {
    return [PERMISSIONS.FOLIO_READ];
  }
  if (pathname.startsWith("/executive")) {
    return [PERMISSIONS.REPORTS_READ, PERMISSIONS.RESERVATIONS_READ];
  }
  if (pathname.startsWith("/settings/")) {
    return [PERMISSIONS.MASTER_DATA_MANAGE];
  }
  return null;
}

/** @deprecated Prefer routePermissions (any-of). */
export function routePermission(pathname: string): Permission | null {
  const list = routePermissions(pathname);
  return list?.[0] ?? null;
}
