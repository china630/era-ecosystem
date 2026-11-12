import {
  normalizeHotelPermission,
  remapPermissionList,
  withPairedScreens,
} from "@/lib/auth/hotel-permission-rename";

/** Fleet-canon keys (Wave 2). TS identifiers unchanged; values use api: / admin: prefixes. */
export const PERMISSIONS = {
  RESERVATIONS_READ: "api:reservations.read",
  RESERVATIONS_WRITE: "api:reservations.write",
  RESERVATIONS_CHECKIN: "api:reservations.checkin",
  RESERVATIONS_CHECKOUT: "api:reservations.checkout",
  RESERVATIONS_CANCEL: "api:reservations.cancel",
  /** Agency name list on a booking. Does not open reports. */
  BOOKING_AGENCY_PICK: "api:reservations.agency_pick",
  /** Company name list on a booking. Does not open reports. */
  BOOKING_COMPANY_PICK: "api:reservations.company_pick",
  GUESTS_READ: "api:guests.read",
  GUESTS_WRITE: "api:guests.write",
  BANQUETS_READ: "api:banquets.read",
  BANQUETS_WRITE: "api:banquets.write",
  CONCIERGE_READ: "api:concierge.read",
  CONCIERGE_WRITE: "api:concierge.write",
  TOURS_WRITE: "api:tours.write",
  TRANSFERS_WRITE: "api:transfers.write",
  FLEET_WRITE: "api:fleet.write",
  POS_READ: "api:pos.read",
  POS_WRITE: "api:pos.write",
  SPA_PLACES_READ: "api:spa.places.read",
  DISPATCH_READ: "api:dispatch.read",
  DISPATCH_WRITE: "api:dispatch.write",
  MIGRATION_REG_READ: "api:migration.registrations.read",
  MIGRATION_REG_WRITE: "api:migration.registrations.write",
  GUESTS_MRZ: "api:guests.mrz",
  ROOMS_ADMIN: "admin:rooms",
  STOCK_MANAGE: "admin:stock",
  HOTEL_PROFILE: "admin:hotel_profile",
  PARTIES_MANAGE: "admin:parties",
  RATES_ADMIN: "admin:rates",
  SEASONS_ADMIN: "admin:seasons",
  YIELD_ADMIN: "admin:yield",
  CHILD_MATRIX_ADMIN: "admin:child_matrix",
  PRICING_ADMIN: "admin:pricing",
  DEPARTMENTS_ADMIN: "admin:departments",
  ALLOTMENT_ADMIN: "admin:allotment",
  CONTRACTS_ADMIN: "admin:contracts",
  PROMO_ADMIN: "admin:promo",
  AGENCY_COMMISSION_ADMIN: "admin:agency_commission",
  INTEGRATION_ADMIN: "admin:integration",
  REVENUE_ADMIN: "admin:revenue",
  LOOKUPS_ADMIN: "admin:lookups",
  SPA_PLACES_WRITE: "admin:spa_places",
  MEAL_PLANS_READ: "api:meal_plans.read",
  BOOKING_SOURCES_READ: "api:booking_sources.read",
  ROOMS_LIST: "api:rooms.list",
  /** Rate names on a booking. Does not open the rate editor. */
  RATE_PLANS_READ: "api:rate_plans.read",
  /** Room-type names on a booking. Does not open the room catalog. */
  ROOM_TYPES_READ: "api:room_types.read",
  /** Active contract names on a booking. Does not open contract admin. */
  CONTRACTS_READ: "api:contracts.read",
  /** Charge codes on a folio. Does not open revenue-code admin. */
  REVENUE_CODES_READ: "api:revenue_codes.read",
  /** Walk-in and other lookup names on a booking. Does not open lookup admin. */
  LOOKUPS_READ: "api:lookups.read",
  FOLIO_READ: "api:folio.read",
  FOLIO_CHARGE: "api:folio.charge",
  FOLIO_PAYMENT: "api:folio.payment",
  FOLIO_VOID: "api:folio.void",
  ROOMS_STATUS: "api:rooms.status",
  HOUSEKEEPING_MANAGE: "api:housekeeping.manage",
  /** Reception / security / engineering week boards (not HK HkRosterWeek). */
  DUTY_SCHEDULES_MANAGE: "api:duty_schedules.manage",
  MEDICAL_MANAGE: "api:medical.manage",
  CHANNEL_MANAGE: "api:channel.manage",
  NIGHT_AUDIT_RUN: "api:night_audit.run",
  MASTER_DATA_MANAGE: "admin:master_data",
  USERS_MANAGE: "admin:users",
  /** Role matrix UI + role CRUD — default Hotel_Admin only. */
  ACCESS_MANAGE: "admin:access_manage",
  REPORTS_READ: "api:reports.read",
  CASH_SHIFT: "api:cash.shift",
  /** Elektraweb bulk import UI/API — grant ∩ hotel_migration_pro SKU. */
  API_IMPORT_ELEKTRAWEB: "api:import.elektraweb",
  /** Elektraweb bridge staff session — grant ∩ policy/env. */
  API_INTEGRATION_ELEKTRAWEB_BRIDGE: "api:integration.elektraweb_bridge",
  SCREEN_HOME: "screen:home",
  SCREEN_FO: "screen:fo",
  SCREEN_GUESTS: "screen:guests",
  SCREEN_BANQUETS: "screen:banquets",
  SCREEN_CONCIERGE: "screen:concierge",
  SCREEN_POS: "screen:pos",
  SCREEN_MIGRATION: "screen:migration",
  SCREEN_DISPATCH: "screen:dispatch",
  SCREEN_SERVICE_GUEST: "screen:service_guest",
  SCREEN_HK: "screen:hk",
  /** Department schedules hub + reception/security/engineering boards. */
  SCREEN_SCHEDULES: "screen:schedules",
  SCREEN_MEDICAL: "screen:medical",
  SCREEN_DISTRIBUTION: "screen:distribution",
  SCREEN_NIGHT_AUDIT: "screen:night_audit",
  SCREEN_FRONT_CASH: "screen:front_cash",
  SCREEN_REPORTS: "screen:reports",
  SCREEN_FOLIO: "screen:folio",
  SCREEN_TOURS: "screen:tours",
  SCREEN_ADMIN: "screen:admin",
  SCREEN_SETTINGS: "screen:settings",
  SCREEN_SETTINGS_USERS: "screen:settings.users",
  SCREEN_SETTINGS_ACCESS: "screen:settings.access",
  SCREEN_SETTINGS_IMPORT: "screen:settings.import",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_CODES = {
  HOTEL_ADMIN: "Hotel_Admin",
  MANAGER: "Manager",
  RECEPTIONIST: "Receptionist",
  NIGHT_AUDITOR: "NightAuditor",
  HOUSEKEEPER: "Housekeeper",
  DOCTOR: "Doctor",
  CRM: "CRM",
  FINANCIAL_AUDITOR: "Financial_Auditor",
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
    id: "screens",
    labelKey: "groupScreens",
    permissions: [
      PERMISSIONS.SCREEN_HOME,
      PERMISSIONS.SCREEN_FO,
      PERMISSIONS.SCREEN_FOLIO,
      PERMISSIONS.SCREEN_FRONT_CASH,
      PERMISSIONS.SCREEN_HK,
      PERMISSIONS.SCREEN_SCHEDULES,
      PERMISSIONS.SCREEN_MEDICAL,
      PERMISSIONS.SCREEN_DISTRIBUTION,
      PERMISSIONS.SCREEN_NIGHT_AUDIT,
      PERMISSIONS.SCREEN_REPORTS,
      PERMISSIONS.SCREEN_TOURS,
      PERMISSIONS.SCREEN_ADMIN,
      PERMISSIONS.SCREEN_SETTINGS,
      PERMISSIONS.SCREEN_SETTINGS_USERS,
      PERMISSIONS.SCREEN_SETTINGS_ACCESS,
      PERMISSIONS.SCREEN_SETTINGS_IMPORT,
    ],
  },
  {
    id: "fo",
    labelKey: "groupFo",
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
    id: "folio",
    labelKey: "groupFolio",
    permissions: [
      PERMISSIONS.FOLIO_READ,
      PERMISSIONS.FOLIO_CHARGE,
      PERMISSIONS.FOLIO_PAYMENT,
      PERMISSIONS.FOLIO_VOID,
    ],
  },
  {
    id: "hk",
    labelKey: "groupHk",
    permissions: [PERMISSIONS.HOUSEKEEPING_MANAGE, PERMISSIONS.ROOMS_STATUS],
  },
  {
    id: "schedules",
    labelKey: "groupSchedules",
    permissions: [PERMISSIONS.DUTY_SCHEDULES_MANAGE],
  },
  {
    id: "channel",
    labelKey: "groupChannel",
    permissions: [PERMISSIONS.CHANNEL_MANAGE],
  },
  {
    id: "medical",
    labelKey: "groupMedical",
    permissions: [PERMISSIONS.MEDICAL_MANAGE],
  },
  {
    id: "reports",
    labelKey: "groupReports",
    permissions: [PERMISSIONS.REPORTS_READ, PERMISSIONS.NIGHT_AUDIT_RUN],
  },
  {
    id: "admin",
    labelKey: "groupAdmin",
    permissions: [
      PERMISSIONS.MASTER_DATA_MANAGE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.ACCESS_MANAGE,
    ],
  },
  {
    id: "migration",
    labelKey: "groupMigration",
    permissions: [
      PERMISSIONS.API_IMPORT_ELEKTRAWEB,
      PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE,
    ],
  },
];

/** Display order for the role modal. Each permission appears once. */
export const PERMISSION_PROCESSES: PermissionGroup[] = [
  { id: "home", labelKey: "procHome", permissions: [PERMISSIONS.SCREEN_HOME] },
  {
    id: "booking",
    labelKey: "procBooking",
    permissions: [
      PERMISSIONS.SCREEN_FO,
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.RESERVATIONS_WRITE,
      PERMISSIONS.RESERVATIONS_CHECKIN,
      PERMISSIONS.RESERVATIONS_CHECKOUT,
      PERMISSIONS.RESERVATIONS_CANCEL,
    ],
  },
  {
    id: "party",
    labelKey: "procBooking",
    permissions: [PERMISSIONS.BOOKING_AGENCY_PICK, PERMISSIONS.BOOKING_COMPANY_PICK],
  },
  {
    id: "folio",
    labelKey: "procFolio",
    permissions: [
      PERMISSIONS.SCREEN_FOLIO,
      PERMISSIONS.FOLIO_READ,
      PERMISSIONS.FOLIO_CHARGE,
      PERMISSIONS.FOLIO_PAYMENT,
      PERMISSIONS.FOLIO_VOID,
    ],
  },
  {
    id: "cash",
    labelKey: "procCash",
    permissions: [PERMISSIONS.SCREEN_FRONT_CASH, PERMISSIONS.CASH_SHIFT],
  },
  { id: "rooms", labelKey: "procRooms", permissions: [PERMISSIONS.ROOMS_STATUS] },
  {
    id: "hk",
    labelKey: "procHk",
    permissions: [PERMISSIONS.SCREEN_HK, PERMISSIONS.HOUSEKEEPING_MANAGE],
  },
  {
    id: "schedules",
    labelKey: "procSchedules",
    permissions: [PERMISSIONS.SCREEN_SCHEDULES, PERMISSIONS.DUTY_SCHEDULES_MANAGE],
  },
  {
    id: "medical",
    labelKey: "procMedical",
    permissions: [PERMISSIONS.SCREEN_MEDICAL, PERMISSIONS.MEDICAL_MANAGE],
  },
  {
    id: "distribution",
    labelKey: "procDistribution",
    permissions: [PERMISSIONS.SCREEN_DISTRIBUTION, PERMISSIONS.CHANNEL_MANAGE],
  },
  {
    id: "night",
    labelKey: "procNight",
    permissions: [PERMISSIONS.SCREEN_NIGHT_AUDIT, PERMISSIONS.NIGHT_AUDIT_RUN],
  },
  {
    id: "reports",
    labelKey: "procReports",
    permissions: [PERMISSIONS.SCREEN_REPORTS, PERMISSIONS.REPORTS_READ],
  },
  { id: "tours", labelKey: "procTours", permissions: [PERMISSIONS.SCREEN_TOURS] },
  {
    id: "admin",
    labelKey: "procAdmin",
    permissions: [
      PERMISSIONS.SCREEN_ADMIN,
      PERMISSIONS.SCREEN_SETTINGS,
      PERMISSIONS.SCREEN_SETTINGS_USERS,
      PERMISSIONS.SCREEN_SETTINGS_ACCESS,
      PERMISSIONS.SCREEN_SETTINGS_IMPORT,
      PERMISSIONS.MASTER_DATA_MANAGE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.ACCESS_MANAGE,
    ],
  },
  {
    id: "import",
    labelKey: "procImport",
    permissions: [
      PERMISSIONS.API_IMPORT_ELEKTRAWEB,
      PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE,
      PERMISSIONS.SCREEN_MIGRATION,
    ],
  },
  {
    id: "entities",
    labelKey: "procEntities",
    permissions: [
      PERMISSIONS.GUESTS_READ,
      PERMISSIONS.GUESTS_WRITE,
      PERMISSIONS.SCREEN_GUESTS,
      PERMISSIONS.BANQUETS_READ,
      PERMISSIONS.BANQUETS_WRITE,
      PERMISSIONS.SCREEN_BANQUETS,
      PERMISSIONS.CONCIERGE_READ,
      PERMISSIONS.CONCIERGE_WRITE,
      PERMISSIONS.SCREEN_CONCIERGE,
      PERMISSIONS.TOURS_WRITE,
      PERMISSIONS.TRANSFERS_WRITE,
      PERMISSIONS.FLEET_WRITE,
      PERMISSIONS.POS_READ,
      PERMISSIONS.POS_WRITE,
      PERMISSIONS.SCREEN_POS,
      PERMISSIONS.SPA_PLACES_READ,
      PERMISSIONS.DISPATCH_READ,
      PERMISSIONS.DISPATCH_WRITE,
      PERMISSIONS.SCREEN_DISPATCH,
      PERMISSIONS.MIGRATION_REG_READ,
      PERMISSIONS.MIGRATION_REG_WRITE,
      PERMISSIONS.GUESTS_MRZ,
      PERMISSIONS.ROOMS_ADMIN,
      PERMISSIONS.STOCK_MANAGE,
      PERMISSIONS.HOTEL_PROFILE,
      PERMISSIONS.PARTIES_MANAGE,
      PERMISSIONS.SCREEN_SERVICE_GUEST,
      PERMISSIONS.RATES_ADMIN,
      PERMISSIONS.SEASONS_ADMIN,
      PERMISSIONS.YIELD_ADMIN,
      PERMISSIONS.CHILD_MATRIX_ADMIN,
      PERMISSIONS.PRICING_ADMIN,
      PERMISSIONS.DEPARTMENTS_ADMIN,
      PERMISSIONS.ALLOTMENT_ADMIN,
      PERMISSIONS.CONTRACTS_ADMIN,
      PERMISSIONS.PROMO_ADMIN,
      PERMISSIONS.AGENCY_COMMISSION_ADMIN,
      PERMISSIONS.INTEGRATION_ADMIN,
      PERMISSIONS.REVENUE_ADMIN,
      PERMISSIONS.LOOKUPS_ADMIN,
      PERMISSIONS.SPA_PLACES_WRITE,
      PERMISSIONS.MEAL_PLANS_READ,
      PERMISSIONS.BOOKING_SOURCES_READ,
      PERMISSIONS.ROOMS_LIST,
      PERMISSIONS.RATE_PLANS_READ,
      PERMISSIONS.ROOM_TYPES_READ,
      PERMISSIONS.CONTRACTS_READ,
      PERMISSIONS.REVENUE_CODES_READ,
      PERMISSIONS.LOOKUPS_READ,
    ],
  },
];

export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  [ROLE_CODES.HOTEL_ADMIN]: ALL_PERMISSIONS.filter(
    (p) => p !== PERMISSIONS.MASTER_DATA_MANAGE,
  ),
  [ROLE_CODES.MANAGER]: withPairedScreens([
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.RESERVATIONS_WRITE,
    PERMISSIONS.RESERVATIONS_CHECKIN,
    PERMISSIONS.RESERVATIONS_CHECKOUT,
    PERMISSIONS.RESERVATIONS_CANCEL,
    PERMISSIONS.GUESTS_READ,
    PERMISSIONS.GUESTS_WRITE,
    PERMISSIONS.BANQUETS_READ,
    PERMISSIONS.BANQUETS_WRITE,
    PERMISSIONS.CONCIERGE_READ,
    PERMISSIONS.CONCIERGE_WRITE,
    PERMISSIONS.TOURS_WRITE,
    PERMISSIONS.TRANSFERS_WRITE,
    PERMISSIONS.FLEET_WRITE,
    PERMISSIONS.POS_READ,
    PERMISSIONS.POS_WRITE,
    PERMISSIONS.SPA_PLACES_READ,
    PERMISSIONS.DISPATCH_READ,
    PERMISSIONS.DISPATCH_WRITE,
    PERMISSIONS.MIGRATION_REG_READ,
    PERMISSIONS.MIGRATION_REG_WRITE,
    PERMISSIONS.ROOMS_ADMIN,
    PERMISSIONS.STOCK_MANAGE,
    PERMISSIONS.HOTEL_PROFILE,
    PERMISSIONS.PARTIES_MANAGE,
    PERMISSIONS.RATES_ADMIN,
    PERMISSIONS.SEASONS_ADMIN,
    PERMISSIONS.YIELD_ADMIN,
    PERMISSIONS.CHILD_MATRIX_ADMIN,
    PERMISSIONS.PRICING_ADMIN,
    PERMISSIONS.DEPARTMENTS_ADMIN,
    PERMISSIONS.ALLOTMENT_ADMIN,
    PERMISSIONS.CONTRACTS_ADMIN,
    PERMISSIONS.PROMO_ADMIN,
    PERMISSIONS.AGENCY_COMMISSION_ADMIN,
    PERMISSIONS.INTEGRATION_ADMIN,
    PERMISSIONS.REVENUE_ADMIN,
    PERMISSIONS.LOOKUPS_ADMIN,
    PERMISSIONS.SPA_PLACES_WRITE,
    PERMISSIONS.MEAL_PLANS_READ,
    PERMISSIONS.BOOKING_SOURCES_READ,
    PERMISSIONS.ROOMS_LIST,
    PERMISSIONS.RATE_PLANS_READ,
    PERMISSIONS.ROOM_TYPES_READ,
    PERMISSIONS.CONTRACTS_READ,
    PERMISSIONS.REVENUE_CODES_READ,
    PERMISSIONS.LOOKUPS_READ,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.FOLIO_CHARGE,
    PERMISSIONS.FOLIO_PAYMENT,
    PERMISSIONS.FOLIO_VOID,
    PERMISSIONS.ROOMS_STATUS,
    PERMISSIONS.HOUSEKEEPING_MANAGE,
    PERMISSIONS.DUTY_SCHEDULES_MANAGE,
    PERMISSIONS.MEDICAL_MANAGE,
    PERMISSIONS.CHANNEL_MANAGE,
    PERMISSIONS.NIGHT_AUDIT_RUN,
    PERMISSIONS.CASH_SHIFT,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.API_IMPORT_ELEKTRAWEB,
    PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE,
  ]) as Permission[],
  [ROLE_CODES.RECEPTIONIST]: withPairedScreens([
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.RESERVATIONS_WRITE,
    PERMISSIONS.RESERVATIONS_CHECKIN,
    PERMISSIONS.RESERVATIONS_CHECKOUT,
    PERMISSIONS.GUESTS_READ,
    PERMISSIONS.GUESTS_WRITE,
    PERMISSIONS.BANQUETS_READ,
    PERMISSIONS.BANQUETS_WRITE,
    PERMISSIONS.CONCIERGE_READ,
    PERMISSIONS.CONCIERGE_WRITE,
    PERMISSIONS.TOURS_WRITE,
    PERMISSIONS.TRANSFERS_WRITE,
    PERMISSIONS.FLEET_WRITE,
    PERMISSIONS.POS_READ,
    PERMISSIONS.POS_WRITE,
    PERMISSIONS.SPA_PLACES_READ,
    PERMISSIONS.DISPATCH_READ,
    PERMISSIONS.DISPATCH_WRITE,
    PERMISSIONS.MIGRATION_REG_READ,
    PERMISSIONS.MIGRATION_REG_WRITE,
    PERMISSIONS.MEAL_PLANS_READ,
    PERMISSIONS.BOOKING_SOURCES_READ,
    PERMISSIONS.ROOMS_LIST,
    PERMISSIONS.RATE_PLANS_READ,
    PERMISSIONS.ROOM_TYPES_READ,
    PERMISSIONS.CONTRACTS_READ,
    PERMISSIONS.REVENUE_CODES_READ,
    PERMISSIONS.LOOKUPS_READ,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.FOLIO_CHARGE,
    PERMISSIONS.FOLIO_PAYMENT,
    PERMISSIONS.ROOMS_STATUS,
    PERMISSIONS.CASH_SHIFT,
    PERMISSIONS.DUTY_SCHEDULES_MANAGE,
    PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE,
  ]) as Permission[],
  [ROLE_CODES.NIGHT_AUDITOR]: withPairedScreens([
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.RESERVATIONS_CHECKIN,
    PERMISSIONS.RESERVATIONS_CHECKOUT,
    PERMISSIONS.RESERVATIONS_CANCEL,
    PERMISSIONS.GUESTS_READ,
    PERMISSIONS.BANQUETS_READ,
    PERMISSIONS.CONCIERGE_READ,
    PERMISSIONS.POS_READ,
    PERMISSIONS.SPA_PLACES_READ,
    PERMISSIONS.DISPATCH_READ,
    PERMISSIONS.MIGRATION_REG_READ,
    PERMISSIONS.MEAL_PLANS_READ,
    PERMISSIONS.BOOKING_SOURCES_READ,
    PERMISSIONS.ROOMS_LIST,
    PERMISSIONS.RATE_PLANS_READ,
    PERMISSIONS.ROOM_TYPES_READ,
    PERMISSIONS.CONTRACTS_READ,
    PERMISSIONS.REVENUE_CODES_READ,
    PERMISSIONS.LOOKUPS_READ,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.NIGHT_AUDIT_RUN,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.CASH_SHIFT,
    PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE,
  ]) as Permission[],
  [ROLE_CODES.HOUSEKEEPER]: withPairedScreens([
    PERMISSIONS.ROOMS_STATUS,
    PERMISSIONS.HOUSEKEEPING_MANAGE,
  ]) as Permission[],
  [ROLE_CODES.DOCTOR]: withPairedScreens([
    PERMISSIONS.MEDICAL_MANAGE,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.GUESTS_READ,
    PERMISSIONS.BANQUETS_READ,
    PERMISSIONS.CONCIERGE_READ,
    PERMISSIONS.POS_READ,
    PERMISSIONS.SPA_PLACES_READ,
    PERMISSIONS.DISPATCH_READ,
    PERMISSIONS.MIGRATION_REG_READ,
    PERMISSIONS.MEAL_PLANS_READ,
    PERMISSIONS.BOOKING_SOURCES_READ,
    PERMISSIONS.ROOMS_LIST,
    PERMISSIONS.RATE_PLANS_READ,
    PERMISSIONS.ROOM_TYPES_READ,
    PERMISSIONS.CONTRACTS_READ,
    PERMISSIONS.REVENUE_CODES_READ,
    PERMISSIONS.LOOKUPS_READ,
  ]) as Permission[],
  [ROLE_CODES.CRM]: withPairedScreens([
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.GUESTS_READ,
    PERMISSIONS.BANQUETS_READ,
    PERMISSIONS.CONCIERGE_READ,
    PERMISSIONS.POS_READ,
    PERMISSIONS.SPA_PLACES_READ,
    PERMISSIONS.DISPATCH_READ,
    PERMISSIONS.MIGRATION_REG_READ,
    PERMISSIONS.MEAL_PLANS_READ,
    PERMISSIONS.BOOKING_SOURCES_READ,
    PERMISSIONS.ROOMS_LIST,
    PERMISSIONS.RATE_PLANS_READ,
    PERMISSIONS.ROOM_TYPES_READ,
    PERMISSIONS.CONTRACTS_READ,
    PERMISSIONS.REVENUE_CODES_READ,
    PERMISSIONS.LOOKUPS_READ,
    PERMISSIONS.CHANNEL_MANAGE,
    PERMISSIONS.FOLIO_READ,
  ]) as Permission[],
  [ROLE_CODES.FINANCIAL_AUDITOR]: withPairedScreens([
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.GUESTS_READ,
    PERMISSIONS.BANQUETS_READ,
    PERMISSIONS.CONCIERGE_READ,
    PERMISSIONS.POS_READ,
    PERMISSIONS.SPA_PLACES_READ,
    PERMISSIONS.DISPATCH_READ,
    PERMISSIONS.MIGRATION_REG_READ,
    PERMISSIONS.MEAL_PLANS_READ,
    PERMISSIONS.BOOKING_SOURCES_READ,
    PERMISSIONS.ROOMS_LIST,
    PERMISSIONS.RATE_PLANS_READ,
    PERMISSIONS.ROOM_TYPES_READ,
    PERMISSIONS.CONTRACTS_READ,
    PERMISSIONS.REVENUE_CODES_READ,
    PERMISSIONS.LOOKUPS_READ,
    PERMISSIONS.CASH_SHIFT,
  ]) as Permission[],
};

export type AccessColumn = "view" | "change" | "operate" | "admin";

/** One row per entity. Each catalog key appears in exactly one cell. */
export const ENTITY_ACCESS_MATRIX: {
  id: string;
  cells: Partial<Record<AccessColumn, Permission[]>>;
}[] = [
  {
    id: "guest",
    cells: {
      view: [PERMISSIONS.GUESTS_READ, PERMISSIONS.SCREEN_GUESTS],
      change: [PERMISSIONS.GUESTS_WRITE],
      operate: [PERMISSIONS.GUESTS_MRZ],
    },
  },
  {
    id: "reservation",
    cells: {
      view: [PERMISSIONS.RESERVATIONS_READ, PERMISSIONS.SCREEN_FO, PERMISSIONS.SCREEN_HOME],
      change: [PERMISSIONS.RESERVATIONS_WRITE],
      operate: [
        PERMISSIONS.RESERVATIONS_CHECKIN,
        PERMISSIONS.RESERVATIONS_CHECKOUT,
        PERMISSIONS.RESERVATIONS_CANCEL,
        PERMISSIONS.BOOKING_AGENCY_PICK,
        PERMISSIONS.BOOKING_COMPANY_PICK,
      ],
    },
  },
  {
    id: "folio",
    cells: {
      view: [PERMISSIONS.FOLIO_READ, PERMISSIONS.SCREEN_FOLIO, PERMISSIONS.SCREEN_FRONT_CASH],
      operate: [PERMISSIONS.FOLIO_CHARGE, PERMISSIONS.FOLIO_PAYMENT, PERMISSIONS.FOLIO_VOID],
    },
  },
  { id: "cash", cells: { operate: [PERMISSIONS.CASH_SHIFT] } },
  { id: "roomStatus", cells: { change: [PERMISSIONS.ROOMS_STATUS] } },
  {
    id: "housekeeping",
    cells: {
      view: [PERMISSIONS.SCREEN_HK],
      change: [PERMISSIONS.HOUSEKEEPING_MANAGE],
    },
  },
  {
    id: "schedules",
    cells: {
      view: [PERMISSIONS.SCREEN_SCHEDULES],
      change: [PERMISSIONS.DUTY_SCHEDULES_MANAGE],
    },
  },
  {
    id: "medical",
    cells: {
      view: [PERMISSIONS.SCREEN_MEDICAL],
      change: [PERMISSIONS.MEDICAL_MANAGE],
    },
  },
  {
    id: "distribution",
    cells: {
      view: [PERMISSIONS.SCREEN_DISTRIBUTION, PERMISSIONS.SCREEN_ADMIN],
      change: [PERMISSIONS.CHANNEL_MANAGE],
    },
  },
  {
    id: "nightAudit",
    cells: {
      view: [PERMISSIONS.SCREEN_NIGHT_AUDIT],
      operate: [PERMISSIONS.NIGHT_AUDIT_RUN],
    },
  },
  {
    id: "reports",
    cells: {
      view: [PERMISSIONS.REPORTS_READ, PERMISSIONS.SCREEN_REPORTS],
    },
  },
  {
    id: "tours",
    cells: {
      view: [PERMISSIONS.SCREEN_TOURS],
      change: [PERMISSIONS.TOURS_WRITE],
    },
  },
  { id: "transfers", cells: { change: [PERMISSIONS.TRANSFERS_WRITE] } },
  { id: "fleet", cells: { change: [PERMISSIONS.FLEET_WRITE] } },
  {
    id: "banquets",
    cells: {
      view: [PERMISSIONS.BANQUETS_READ, PERMISSIONS.SCREEN_BANQUETS],
      change: [PERMISSIONS.BANQUETS_WRITE],
    },
  },
  {
    id: "concierge",
    cells: {
      view: [PERMISSIONS.CONCIERGE_READ, PERMISSIONS.SCREEN_CONCIERGE],
      change: [PERMISSIONS.CONCIERGE_WRITE],
    },
  },
  {
    id: "pos",
    cells: {
      view: [PERMISSIONS.POS_READ, PERMISSIONS.SCREEN_POS],
      change: [PERMISSIONS.POS_WRITE],
    },
  },
  {
    id: "spaPlaces",
    cells: {
      view: [PERMISSIONS.SPA_PLACES_READ],
      admin: [PERMISSIONS.SPA_PLACES_WRITE],
    },
  },
  {
    id: "dispatch",
    cells: {
      view: [PERMISSIONS.DISPATCH_READ, PERMISSIONS.SCREEN_DISPATCH],
      change: [PERMISSIONS.DISPATCH_WRITE],
    },
  },
  {
    id: "migrationReg",
    cells: {
      view: [PERMISSIONS.MIGRATION_REG_READ],
      change: [PERMISSIONS.MIGRATION_REG_WRITE],
    },
  },
  { id: "serviceGuest", cells: { view: [PERMISSIONS.SCREEN_SERVICE_GUEST] } },
  { id: "roomsCatalog", cells: { view: [PERMISSIONS.ROOM_TYPES_READ], admin: [PERMISSIONS.ROOMS_ADMIN] } },
  { id: "rates", cells: { view: [PERMISSIONS.RATE_PLANS_READ], admin: [PERMISSIONS.RATES_ADMIN] } },
  { id: "seasons", cells: { admin: [PERMISSIONS.SEASONS_ADMIN] } },
  { id: "yield", cells: { admin: [PERMISSIONS.YIELD_ADMIN] } },
  { id: "childMatrix", cells: { admin: [PERMISSIONS.CHILD_MATRIX_ADMIN] } },
  { id: "pricing", cells: { admin: [PERMISSIONS.PRICING_ADMIN] } },
  { id: "departments", cells: { admin: [PERMISSIONS.DEPARTMENTS_ADMIN] } },
  { id: "allotment", cells: { admin: [PERMISSIONS.ALLOTMENT_ADMIN] } },
  { id: "contracts", cells: { view: [PERMISSIONS.CONTRACTS_READ], admin: [PERMISSIONS.CONTRACTS_ADMIN] } },
  { id: "promo", cells: { admin: [PERMISSIONS.PROMO_ADMIN] } },
  { id: "agencyCommission", cells: { admin: [PERMISSIONS.AGENCY_COMMISSION_ADMIN] } },
  { id: "integration", cells: { admin: [PERMISSIONS.INTEGRATION_ADMIN] } },
  { id: "revenue", cells: { view: [PERMISSIONS.REVENUE_CODES_READ], admin: [PERMISSIONS.REVENUE_ADMIN] } },
  { id: "lookups", cells: { view: [PERMISSIONS.LOOKUPS_READ], admin: [PERMISSIONS.LOOKUPS_ADMIN] } },
  { id: "mealPlans", cells: { view: [PERMISSIONS.MEAL_PLANS_READ] } },
  { id: "bookingSources", cells: { view: [PERMISSIONS.BOOKING_SOURCES_READ] } },
  { id: "roomsList", cells: { view: [PERMISSIONS.ROOMS_LIST] } },
  { id: "stock", cells: { admin: [PERMISSIONS.STOCK_MANAGE] } },
  { id: "hotelProfile", cells: { admin: [PERMISSIONS.HOTEL_PROFILE] } },
  { id: "parties", cells: { admin: [PERMISSIONS.PARTIES_MANAGE] } },
  { id: "settingsScreen", cells: { view: [PERMISSIONS.SCREEN_SETTINGS] } },
  {
    id: "masterData",
    cells: {
      admin: [PERMISSIONS.MASTER_DATA_MANAGE],
    },
  },
  {
    id: "users",
    cells: {
      view: [PERMISSIONS.SCREEN_SETTINGS_USERS],
      admin: [PERMISSIONS.USERS_MANAGE],
    },
  },
  {
    id: "access",
    cells: {
      view: [PERMISSIONS.SCREEN_SETTINGS_ACCESS],
      admin: [PERMISSIONS.ACCESS_MANAGE],
    },
  },
  {
    id: "import",
    cells: {
      view: [PERMISSIONS.SCREEN_SETTINGS_IMPORT, PERMISSIONS.SCREEN_MIGRATION],
      operate: [PERMISSIONS.API_IMPORT_ELEKTRAWEB, PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE],
    },
  },
];

export function permissionsForRole(roleCode: string): Permission[] {
  return ROLE_PERMISSIONS[roleCode as RoleCode] ?? [];
}

/** @deprecated Prefer session/DB grants — role name alone must not grant rights. */
export function hasPermission(roleCode: string, permission: Permission): boolean {
  return permissionsForRole(roleCode).includes(permission);
}

/** Persist canonical keys only. */
export function serializePermissions(perms: Permission[]): string {
  return JSON.stringify(remapPermissionList(perms) as Permission[]);
}

/** Accepts only fleet-canon strings (after Wave 2 cutover). */
export function isHotelPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

/**
 * Parse stored JSON. Dual-read: legacy aliases → canonical; unknowns dropped.
 * Writes must use serializePermissions / isHotelPermission (canonical only).
 */
export function parsePermissions(json: string): Permission[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return remapPermissionList(parsed.map(String)) as Permission[];
  } catch {
    return [];
  }
}

/** Dual-read a single JWT/session claim string. */
export function coerceHotelPermission(raw: string): Permission | null {
  const n = normalizeHotelPermission(raw);
  return n && isHotelPermission(n) ? n : null;
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
