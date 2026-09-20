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
  "api:folio.read",
  "api:folio.charge",
  "api:folio.payment",
  "api:folio.void",
  "api:rooms.status",
  "api:housekeeping.manage",
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
  "screen:hk",
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
  if (have.has("api:reservations.write")) add("screen:tours");
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
  if (have.has("api:medical.manage")) add("screen:medical");
  if (have.has("api:channel.manage")) add("screen:distribution");
  if (have.has("api:night_audit.run") || have.has("api:reports.read")) {
    add("screen:night_audit");
  }
  if (have.has("admin:master_data") || have.has("api:channel.manage")) {
    add("screen:admin");
  }
  if (have.has("admin:master_data")) add("screen:settings");
  if (have.has("admin:users")) add("screen:settings.users");
  if (have.has("admin:access_manage")) add("screen:settings.access");
  if (have.has("api:import.elektraweb")) add("screen:settings.import");
  return screens;
}

export function withPairedScreens(keys: readonly string[]): string[] {
  return remapPermissionList([...keys, ...screensImpliedByCanonKeys(keys)]);
}
