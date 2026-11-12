import { ENTITY_ACCESS_MATRIX, ALL_PERMISSIONS, PERMISSIONS } from "@/lib/auth/permissions";
import { expandCatalogV5, expandCatalogV6, expandCatalogV7, expandCatalogV8, expandEntityGrants } from "@/lib/auth/hotel-permission-rename";

describe("hotel entity access matrix", () => {
  it("places every catalog key in exactly one cell", () => {
    const seen: string[] = [];
    for (const row of ENTITY_ACCESS_MATRIX) {
      for (const list of Object.values(row.cells)) {
        for (const key of list ?? []) seen.push(key);
      }
    }
    expect(seen.slice().sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it("expands reservations grants into guest and banquet keys once", () => {
    const next = expandEntityGrants([
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.RESERVATIONS_WRITE,
    ]);
    expect(next).toEqual(
      expect.arrayContaining([
        PERMISSIONS.GUESTS_READ,
        PERMISSIONS.GUESTS_WRITE,
        PERMISSIONS.BANQUETS_READ,
        PERMISSIONS.BANQUETS_WRITE,
        PERMISSIONS.TOURS_WRITE,
        PERMISSIONS.FLEET_WRITE,
        PERMISSIONS.POS_WRITE,
        PERMISSIONS.SPA_PLACES_READ,
      ]),
    );
    expect(expandEntityGrants(next)).toEqual(next);
  });

  it("does not invent guest write from read alone", () => {
    const next = expandEntityGrants([PERMISSIONS.RESERVATIONS_READ]);
    expect(next).toContain(PERMISSIONS.GUESTS_READ);
    expect(next).not.toContain(PERMISSIONS.GUESTS_WRITE);
    expect(next).not.toContain(PERMISSIONS.TOURS_WRITE);
  });

  it("splits master data and dispatch without opening passport scan", () => {
    const next = expandCatalogV5([
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.RESERVATIONS_WRITE,
      PERMISSIONS.MASTER_DATA_MANAGE,
    ]);
    expect(next).toEqual(
      expect.arrayContaining([
        PERMISSIONS.DISPATCH_WRITE,
        PERMISSIONS.MIGRATION_REG_WRITE,
        PERMISSIONS.ROOMS_ADMIN,
        PERMISSIONS.STOCK_MANAGE,
        PERMISSIONS.HOTEL_PROFILE,
        PERMISSIONS.PARTIES_MANAGE,
      ]),
    );
    expect(next).not.toContain(PERMISSIONS.GUESTS_MRZ);
  });

  it("splits rates from seasons and meal plans from reservation read", () => {
    const next = expandCatalogV6([
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.MASTER_DATA_MANAGE,
    ]);
    expect(next).toEqual(
      expect.arrayContaining([
        PERMISSIONS.RATES_ADMIN,
        PERMISSIONS.SEASONS_ADMIN,
        PERMISSIONS.MEAL_PLANS_READ,
        PERMISSIONS.BOOKING_SOURCES_READ,
        PERMISSIONS.ROOMS_LIST,
      ]),
    );
    expect(next).toContain(PERMISSIONS.RESERVATIONS_READ);
    expect(next).toContain(PERMISSIONS.MASTER_DATA_MANAGE);
  });

  it("drops inert master data and opens booking lists", () => {
    const next = expandCatalogV7([
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.MASTER_DATA_MANAGE,
    ]);
    expect(next).toContain(PERMISSIONS.RATE_PLANS_READ);
    expect(next).toContain(PERMISSIONS.LOOKUPS_READ);
    expect(next).not.toContain(PERMISSIONS.MASTER_DATA_MANAGE);
    expect(next).toContain(PERMISSIONS.RESERVATIONS_READ);
  });

  it("opens booking and folio pick-lists without the admin keys", () => {
    const next = expandCatalogV8([
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.FOLIO_CHARGE,
      PERMISSIONS.GUESTS_READ,
    ]);
    expect(next).toEqual(
      expect.arrayContaining([
        PERMISSIONS.ROOM_TYPES_READ,
        PERMISSIONS.CONTRACTS_READ,
        PERMISSIONS.REVENUE_CODES_READ,
        PERMISSIONS.LOOKUPS_READ,
      ]),
    );
    expect(next).not.toContain(PERMISSIONS.ROOMS_ADMIN);
    expect(next).not.toContain(PERMISSIONS.REVENUE_ADMIN);
  });
});
