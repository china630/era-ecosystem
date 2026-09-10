export const PERMISSIONS = {
  RESERVATIONS_READ: 'reservations:read',
  RESERVATIONS_WRITE: 'reservations:write',
  RESERVATIONS_CHECKIN: 'reservations:checkin',
  RESERVATIONS_CHECKOUT: 'reservations:checkout',
  RESERVATIONS_CANCEL: 'reservations:cancel',
  FOLIO_READ: 'folio:read',
  FOLIO_CHARGE: 'folio:charge',
  FOLIO_PAYMENT: 'folio:payment',
  FOLIO_VOID: 'folio:void',
  ROOMS_STATUS: 'rooms:status',
  HOUSEKEEPING_MANAGE: 'housekeeping:manage',
  MEDICAL_MANAGE: 'medical:manage',
  CHANNEL_MANAGE: 'channel:manage',
  NIGHT_AUDIT_RUN: 'night_audit:run',
  MASTER_DATA_MANAGE: 'master_data:manage',
  USERS_MANAGE: 'users:manage',
  /** Role matrix UI + role CRUD — default Hotel_Admin only. */
  ACCESS_MANAGE: 'access:manage',
  REPORTS_READ: 'reports:read',
  CASH_SHIFT: 'cash:shift',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_CODES = {
  HOTEL_ADMIN: 'Hotel_Admin',
  MANAGER: 'Manager',
  RECEPTIONIST: 'Receptionist',
  NIGHT_AUDITOR: 'NightAuditor',
  HOUSEKEEPER: 'Housekeeper',
  DOCTOR: 'Doctor',
  CRM: 'CRM',
  FINANCIAL_AUDITOR: 'Financial_Auditor',
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export type PermissionGroup = {
  id: string;
  labelKey: string;
  permissions: Permission[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'fo',
    labelKey: 'groupFo',
    permissions: [
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.RESERVATIONS_WRITE,
      PERMISSIONS.RESERVATIONS_CHECKIN,
      PERMISSIONS.RESERVATIONS_CHECKOUT,
      PERMISSIONS.RESERVATIONS_CANCEL,
      PERMISSIONS.ROOMS_STATUS,
      PERMISSIONS.CASH_SHIFT,
    ],
  },
  {
    id: 'folio',
    labelKey: 'groupFolio',
    permissions: [
      PERMISSIONS.FOLIO_READ,
      PERMISSIONS.FOLIO_CHARGE,
      PERMISSIONS.FOLIO_PAYMENT,
      PERMISSIONS.FOLIO_VOID,
    ],
  },
  {
    id: 'hk',
    labelKey: 'groupHk',
    permissions: [PERMISSIONS.HOUSEKEEPING_MANAGE, PERMISSIONS.ROOMS_STATUS],
  },
  {
    id: 'channel',
    labelKey: 'groupChannel',
    permissions: [PERMISSIONS.CHANNEL_MANAGE],
  },
  {
    id: 'medical',
    labelKey: 'groupMedical',
    permissions: [PERMISSIONS.MEDICAL_MANAGE],
  },
  {
    id: 'reports',
    labelKey: 'groupReports',
    permissions: [PERMISSIONS.REPORTS_READ, PERMISSIONS.NIGHT_AUDIT_RUN],
  },
  {
    id: 'admin',
    labelKey: 'groupAdmin',
    permissions: [
      PERMISSIONS.MASTER_DATA_MANAGE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.ACCESS_MANAGE,
    ],
  },
];

export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  [ROLE_CODES.HOTEL_ADMIN]: [...ALL_PERMISSIONS],
  [ROLE_CODES.MANAGER]: [
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.RESERVATIONS_WRITE,
    PERMISSIONS.RESERVATIONS_CHECKIN,
    PERMISSIONS.RESERVATIONS_CHECKOUT,
    PERMISSIONS.RESERVATIONS_CANCEL,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.FOLIO_CHARGE,
    PERMISSIONS.FOLIO_PAYMENT,
    PERMISSIONS.FOLIO_VOID,
    PERMISSIONS.ROOMS_STATUS,
    PERMISSIONS.HOUSEKEEPING_MANAGE,
    PERMISSIONS.MEDICAL_MANAGE,
    PERMISSIONS.CHANNEL_MANAGE,
    PERMISSIONS.NIGHT_AUDIT_RUN,
    PERMISSIONS.MASTER_DATA_MANAGE,
    PERMISSIONS.CASH_SHIFT,
    PERMISSIONS.REPORTS_READ,
  ],
  [ROLE_CODES.RECEPTIONIST]: [
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.RESERVATIONS_WRITE,
    PERMISSIONS.RESERVATIONS_CHECKIN,
    PERMISSIONS.RESERVATIONS_CHECKOUT,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.FOLIO_CHARGE,
    PERMISSIONS.FOLIO_PAYMENT,
    PERMISSIONS.ROOMS_STATUS,
    PERMISSIONS.CASH_SHIFT,
  ],
  [ROLE_CODES.NIGHT_AUDITOR]: [
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.RESERVATIONS_CHECKIN,
    PERMISSIONS.RESERVATIONS_CHECKOUT,
    PERMISSIONS.RESERVATIONS_CANCEL,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.NIGHT_AUDIT_RUN,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.CASH_SHIFT,
  ],
  [ROLE_CODES.HOUSEKEEPER]: [
    PERMISSIONS.ROOMS_STATUS,
    PERMISSIONS.HOUSEKEEPING_MANAGE,
  ],
  [ROLE_CODES.DOCTOR]: [
    PERMISSIONS.MEDICAL_MANAGE,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.RESERVATIONS_READ,
  ],
  [ROLE_CODES.CRM]: [
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.CHANNEL_MANAGE,
    PERMISSIONS.FOLIO_READ,
  ],
  [ROLE_CODES.FINANCIAL_AUDITOR]: [
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.CASH_SHIFT,
  ],
};

export function permissionsForRole(roleCode: string): Permission[] {
  return ROLE_PERMISSIONS[roleCode as RoleCode] ?? [];
}

/** @deprecated Prefer session/DB grants — role name alone must not grant rights. */
export function hasPermission(roleCode: string, permission: Permission): boolean {
  return permissionsForRole(roleCode).includes(permission);
}

export function serializePermissions(perms: Permission[]): string {
  return JSON.stringify(perms);
}

export function isHotelPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

export function parsePermissions(json: string): Permission[] {
  try {
    const parsed = JSON.parse(json) as string[];
    return parsed.filter((p): p is Permission => isHotelPermission(p));
  } catch {
    return [];
  }
}

/** Valid JSON array (incl. empty) is authoritative; invalid/missing → role template. */
export function effectiveRolePermissions(
  roleCode: string,
  permissionsJson: string,
): Permission[] {
  try {
    const parsed = JSON.parse(permissionsJson) as unknown;
    if (Array.isArray(parsed)) {
      return parsePermissions(permissionsJson);
    }
  } catch {
    // fall through to template
  }
  return permissionsForRole(roleCode);
}

/** True when permissionsJson is missing, blank, or not a JSON array (bootstrap fill). */
export function permissionsJsonNeedsTemplate(
  permissionsJson: string | null | undefined,
): boolean {
  if (permissionsJson == null || !String(permissionsJson).trim()) return true;
  try {
    return !Array.isArray(JSON.parse(permissionsJson));
  } catch {
    return true;
  }
}
