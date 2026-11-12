/**
 * Wave 2 SSOT: legacy hotel keys to fleet-canon api: and admin: prefixes.
 * Wave-1 keys (already canon) are not remapped.
 * Values must match PERMISSIONS in permissions.ts.
 */
export const HOTEL_PERMISSION_RENAME: Readonly<Record<string, string>> = {
  "reservations:read": "api:reservations.read",
  "reservations:write": "api:reservations.write",
  "reservations:checkin": "api:reservations.checkin",
  "reservations:checkout": "api:reservations.checkout",
  "reservations:cancel": "api:reservations.cancel",
  "folio:read": "api:folio.read",
  "folio:charge": "api:folio.charge",
  "folio:payment": "api:folio.payment",
  "folio:void": "api:folio.void",
  "rooms:status": "api:rooms.status",
  "housekeeping:manage": "api:housekeeping.manage",
  "medical:manage": "api:medical.manage",
  "channel:manage": "api:channel.manage",
  "night_audit:run": "api:night_audit.run",
  "reports:read": "api:reports.read",
  "cash:shift": "api:cash.shift",
  "master_data:manage": "admin:master_data",
  "users:manage": "admin:users",
  "access:manage": "admin:access_manage",
};

/** Legacy strings that must not appear in runtime after Wave-2 cutover. */
export const HOTEL_LEGACY_PERMISSION_STRINGS = Object.keys(
  HOTEL_PERMISSION_RENAME,
) as readonly string[];

/** Canonical fleet keys (must stay in sync with PERMISSIONS values). */
export const HOTEL_CANONICAL_PERMISSIONS = [
  "api:reservations.read",
  "api:reservations.write",
  "api:reservations.checkin",
  "api:reservations.checkout",
  "api:reservations.cancel",
  "api:reservations.agency_pick",
  "api:reservations.company_pick",
  "api:guests.read",
  "api:guests.write",
  "api:banquets.read",
  "api:banquets.write",
  "api:concierge.read",
  "api:concierge.write",
  "api:tours.write",
  "api:transfers.write",
  "api:fleet.write",
  "api:pos.read",
  "api:pos.write",
  "api:spa.places.read",
  "api:dispatch.read",
  "api:dispatch.write",
  "api:migration.registrations.read",
  "api:migration.registrations.write",
  "api:guests.mrz",
  "admin:rooms",
  "admin:stock",
  "admin:hotel_profile",
  "admin:parties",
  "admin:rates",
  "admin:seasons",
  "admin:yield",
  "admin:child_matrix",
  "admin:pricing",
  "admin:departments",
  "admin:allotment",
  "admin:contracts",
  "admin:promo",
  "admin:agency_commission",
  "admin:integration",
  "admin:revenue",
  "admin:lookups",
  "admin:spa_places",
  "api:meal_plans.read",
  "api:booking_sources.read",
  "api:rooms.list",
  "api:rate_plans.read",
  "api:room_types.read",
  "api:contracts.read",
  "api:revenue_codes.read",
  "api:lookups.read",
  "api:folio.read",
  "api:folio.charge",
  "api:folio.payment",
  "api:folio.void",
  "api:rooms.status",
  "api:housekeeping.manage",
  "api:duty_schedules.manage",
  "api:medical.manage",
  "api:channel.manage",
  "api:night_audit.run",
  "admin:master_data",
  "admin:users",
  "admin:access_manage",
  "api:reports.read",
  "api:cash.shift",
  "api:import.elektraweb",
  "api:integration.elektraweb_bridge",
  "screen:home",
  "screen:fo",
  "screen:guests",
  "screen:banquets",
  "screen:concierge",
  "screen:pos",
  "screen:migration",
  "screen:dispatch",
  "screen:service_guest",
  "screen:hk",
  "screen:schedules",
  "screen:medical",
  "screen:distribution",
  "screen:night_audit",
  "screen:front_cash",
  "screen:reports",
  "screen:folio",
  "screen:tours",
  "screen:admin",
  "screen:settings",
  "screen:settings.users",
  "screen:settings.access",
  "screen:settings.import",
] as const;

const CANONICAL = new Set<string>(HOTEL_CANONICAL_PERMISSIONS);

/**
 * Dual-read: legacy → canonical; already-canonical → self; unknown → null.
 */
export function normalizeHotelPermission(raw: string): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (CANONICAL.has(s)) return s;
  const mapped = HOTEL_PERMISSION_RENAME[s];
  return mapped ?? null;
}

/** Remap a list; drop unknowns; dedupe; preserve order of first occurrence. */
export function remapPermissionList(raw: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const n = normalizeHotelPermission(item);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/**
 * Wave 3: pages use screen:*; APIs keep api:/admin:.
 * Expand stored API grants into the screens those APIs previously gated.
 */
export function screensImpliedByCanonKeys(keys: readonly string[]): string[] {
  const have = new Set(keys);
  const screens: string[] = [];
  const add = (s: string) => {
    if (!screens.includes(s)) screens.push(s);
  };
  if (have.has("api:reservations.read") || have.has("api:reports.read")) {
    add("screen:home");
  }
  if (have.has("api:reservations.read")) add("screen:fo");
  if (have.has("api:guests.read")) add("screen:guests");
  if (have.has("api:banquets.read")) add("screen:banquets");
  if (have.has("api:concierge.read")) add("screen:concierge");
  if (have.has("api:pos.read")) add("screen:pos");
  if (
    have.has("api:tours.write") ||
    have.has("api:transfers.write") ||
    have.has("api:fleet.write")
  ) {
    add("screen:tours");
  }
  if (have.has("api:import.elektraweb") || have.has("api:migration.registrations.read")) {
    add("screen:migration");
  }
  if (have.has("api:dispatch.read")) add("screen:dispatch");
  if (have.has("api:reservations.read")) add("screen:service_guest");
  if (have.has("api:folio.read")) add("screen:folio");
  if (
    have.has("api:folio.read") ||
    have.has("api:folio.payment") ||
    have.has("api:reports.read")
  ) {
    add("screen:front_cash");
  }
  if (have.has("api:reports.read")) add("screen:reports");
  if (have.has("api:housekeeping.manage") || have.has("api:rooms.status")) {
    add("screen:hk");
  }
  if (have.has("api:duty_schedules.manage")) add("screen:schedules");
  if (have.has("api:medical.manage")) add("screen:medical");
  if (have.has("api:channel.manage")) add("screen:distribution");
  if (have.has("api:night_audit.run") || have.has("api:reports.read")) {
    add("screen:night_audit");
  }
  if (have.has("admin:master_data") || have.has("api:channel.manage")) {
    add("screen:admin");
  }
  if (
    have.has("admin:master_data") ||
    have.has("admin:rates") ||
    have.has("admin:seasons") ||
    have.has("admin:yield") ||
    have.has("admin:rooms") ||
    have.has("admin:stock") ||
    have.has("admin:hotel_profile") ||
    have.has("admin:parties") ||
    have.has("admin:child_matrix") ||
    have.has("admin:pricing") ||
    have.has("admin:departments") ||
    have.has("admin:allotment") ||
    have.has("admin:contracts") ||
    have.has("admin:promo") ||
    have.has("admin:agency_commission") ||
    have.has("admin:integration") ||
    have.has("admin:revenue") ||
    have.has("admin:lookups") ||
    have.has("admin:spa_places")
  ) {
    add("screen:settings");
  }
  if (have.has("admin:users")) add("screen:settings.users");
  if (have.has("admin:access_manage")) add("screen:settings.access");
  if (have.has("api:import.elektraweb")) add("screen:settings.import");
  return screens;
}

export function withPairedScreens(keys: readonly string[]): string[] {
  return remapPermissionList([...keys, ...screensImpliedByCanonKeys(keys)]);
}

/**
 * Catalog v4: guest, banquet, concierge, tours, transfers, fleet, POS and spa
 * places used to ride on reservations.read / reservations.write.
 * One-shot expand so an existing grant keeps those doors until an admin unchecks them.
 */
export function expandEntityGrants(keys: readonly string[]): string[] {
  const out: string[] = [];
  const have = new Set<string>();
  const add = (s: string) => {
    if (!have.has(s)) {
      have.add(s);
      out.push(s);
    }
  };
  for (const key of keys) add(key);
  if (have.has("api:reservations.read")) {
    add("api:guests.read");
    add("api:banquets.read");
    add("api:concierge.read");
    add("api:pos.read");
    add("api:spa.places.read");
  }
  if (have.has("api:reservations.write")) {
    add("api:guests.write");
    add("api:banquets.write");
    add("api:concierge.write");
    add("api:tours.write");
    add("api:transfers.write");
    add("api:fleet.write");
    add("api:pos.write");
  }
  return out;
}

/** Catalog v5: dispatch, migration registrations, and the master-data split. */
export function expandCatalogV5(keys: readonly string[]): string[] {
  const out: string[] = [];
  const have = new Set<string>();
  const add = (s: string) => {
    if (!have.has(s)) {
      have.add(s);
      out.push(s);
    }
  };
  for (const key of keys) add(key);
  if (have.has("api:reservations.read")) {
    add("api:dispatch.read");
    add("api:migration.registrations.read");
    add("screen:service_guest");
  }
  if (have.has("api:reservations.write")) {
    add("api:dispatch.write");
    add("api:migration.registrations.write");
  }
  if (have.has("admin:master_data")) {
    add("admin:rooms");
    add("admin:stock");
    add("admin:hotel_profile");
    add("admin:parties");
  }
  return out;
}

/** Catalog v6: rates, seasons, yield and the booking pick-lists. */
export function expandCatalogV6(keys: readonly string[]): string[] {
  const out: string[] = [];
  const have = new Set<string>();
  const add = (s: string) => {
    if (!have.has(s)) {
      have.add(s);
      out.push(s);
    }
  };
  for (const key of keys) add(key);
  if (have.has("api:reservations.read")) {
    add("api:meal_plans.read");
    add("api:booking_sources.read");
    add("api:rooms.list");
  }
  if (have.has("admin:master_data")) {
    add("admin:rates");
    add("admin:seasons");
    add("admin:yield");
    add("admin:child_matrix");
    add("admin:pricing");
    add("admin:departments");
    add("admin:allotment");
    add("admin:contracts");
    add("admin:promo");
    add("admin:agency_commission");
    add("admin:integration");
    add("admin:revenue");
    add("admin:lookups");
    add("admin:spa_places");
  }
  return out;
}

/** Catalog v7: booking lists for rates and lookups; drop the inert master-data key. */
export function expandCatalogV7(keys: readonly string[]): string[] {
  const out: string[] = [];
  const have = new Set<string>();
  const add = (s: string) => {
    if (!have.has(s)) {
      have.add(s);
      out.push(s);
    }
  };
  for (const key of keys) {
    if (key !== "admin:master_data") add(key);
  }
  if (have.has("api:reservations.read")) {
    add("api:rate_plans.read");
    add("api:lookups.read");
  }
  return out.filter((key) => key !== "admin:master_data");
}

/** Catalog v8: lists the booking card and the folio charge dialog still need. */
export function expandCatalogV8(keys: readonly string[]): string[] {
  const out: string[] = [];
  const have = new Set<string>();
  const add = (s: string) => {
    if (!have.has(s)) {
      have.add(s);
      out.push(s);
    }
  };
  for (const key of keys) add(key);
  if (have.has("api:reservations.read")) {
    add("api:room_types.read");
    add("api:contracts.read");
  }
  if (have.has("api:folio.read") || have.has("api:folio.charge")) {
    add("api:revenue_codes.read");
  }
  if (
    have.has("api:guests.read") ||
    have.has("api:banquets.read") ||
    have.has("api:concierge.read")
  ) {
    add("api:lookups.read");
  }
  return out;
}
