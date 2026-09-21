import {
  HOTEL_CANONICAL_PERMISSIONS,
  HOTEL_PERMISSION_RENAME,
  normalizeHotelPermission,
  remapPermissionList,
  withPairedScreens,
} from "@/lib/auth/hotel-permission-rename";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  isHotelPermission,
  parsePermissions,
  serializePermissions,
} from "@/lib/auth/permissions";
import {
  ensureSystemHotelRoles,
  HOTEL_PERMISSION_CATALOG_VERSION,
  bumpCatalogVersionPatch,
} from "@/lib/auth/ensure-system-hotel-roles";
import { ROLE_CODES } from "@/lib/auth/permissions";
import { sessionHasHotelPermission } from "@/lib/auth/permission-check";

describe("hotel permission rename (Wave 2)", () => {
  it("normalizeHotelPermission maps legacy and is idempotent on canon", () => {
    expect(normalizeHotelPermission("folio:void")).toBe("api:folio.void");
    expect(normalizeHotelPermission("api:folio.void")).toBe("api:folio.void");
    expect(normalizeHotelPermission("access:manage")).toBe("admin:access_manage");
    expect(normalizeHotelPermission("admin:access_manage")).toBe(
      "admin:access_manage",
    );
    expect(normalizeHotelPermission("not-a-perm")).toBeNull();
    expect(normalizeHotelPermission("")).toBeNull();
  });

  it("PERMISSIONS values match HOTEL_CANONICAL_PERMISSIONS", () => {
    expect([...ALL_PERMISSIONS].sort()).toEqual(
      [...HOTEL_CANONICAL_PERMISSIONS].sort(),
    );
  });

  it("rename map covers every legacy key once", () => {
    expect(Object.keys(HOTEL_PERMISSION_RENAME).length).toBe(19);
    for (const [legacy, canon] of Object.entries(HOTEL_PERMISSION_RENAME)) {
      expect(isHotelPermission(canon)).toBe(true);
      expect(isHotelPermission(legacy)).toBe(false);
    }
  });

  it("parsePermissions dual-reads legacy JSON", () => {
    const json = JSON.stringify([
      "folio:void",
      "reservations:read",
      "api:folio.void",
      "unknown",
    ]);
    expect(parsePermissions(json)).toEqual([
      PERMISSIONS.FOLIO_VOID,
      PERMISSIONS.RESERVATIONS_READ,
    ]);
  });

  it("serializePermissions never writes legacy", () => {
    const s = serializePermissions([
      PERMISSIONS.FOLIO_VOID,
      PERMISSIONS.ACCESS_MANAGE,
    ]);
    expect(s).toContain("api:folio.void");
    expect(s).toContain("admin:access_manage");
    expect(s).not.toContain("folio:void");
    expect(s).not.toContain("access:manage");
  });

  it("withPairedScreens adds folio screen without folio.void", () => {
    expect(
      withPairedScreens(["api:folio.read", "api:reservations.read"]),
    ).toEqual(
      expect.arrayContaining([
        "api:folio.read",
        "api:reservations.read",
        "screen:folio",
        "screen:fo",
      ]),
    );
    expect(
      withPairedScreens(["api:folio.read"]).includes("api:folio.void"),
    ).toBe(false);
  });

  it("remapPermissionList dedupes after normalize", () => {
    expect(
      remapPermissionList(["folio:void", "api:folio.void", "folio:void"]),
    ).toEqual(["api:folio.void"]);
  });

  it("JWT dual-read: sessionHasHotelPermission accepts legacy claim", () => {
    expect(
      sessionHasHotelPermission(
        {
          login: "x",
          role: ROLE_CODES.MANAGER,
          permissions: ["folio:void"],
        },
        PERMISSIONS.FOLIO_VOID,
      ),
    ).toBe(true);
  });
});

describe("ensure catalogVersion remap (Wave 3 screens)", () => {
  function makeDb(
    seed: Array<{
      code: string;
      permissionsJson: string;
      name?: string;
      cloneFromCode?: string | null;
      permissionCatalogVersion?: number;
    }>,
  ) {
    const store = new Map(
      seed.map((r) => [
        r.code,
        {
          id: `id-${r.code}`,
          code: r.code,
          name: r.name ?? r.code,
          permissionsJson: r.permissionsJson,
          isSystem: true,
          cloneFromCode: r.cloneFromCode ?? null,
          permissionCatalogVersion: r.permissionCatalogVersion ?? 0,
        },
      ]),
    );
    return {
      role: {
        findFirst: jest.fn(async ({ where }: { where: { code: string } }) =>
          store.get(where.code) ?? null,
        ),
        findMany: jest.fn(async () => [...store.values()]),
        create: jest.fn(
          async ({
            data,
          }: {
            data: {
              code: string;
              name: string;
              permissionsJson: string;
              isSystem: boolean;
              permissionCatalogVersion?: number;
              cloneFromCode?: string | null;
            };
          }) => {
            const row = {
              id: `id-${data.code}`,
              code: data.code,
              name: data.name,
              permissionsJson: data.permissionsJson,
              isSystem: data.isSystem,
              cloneFromCode: data.cloneFromCode ?? null,
              permissionCatalogVersion:
                data.permissionCatalogVersion ?? HOTEL_PERMISSION_CATALOG_VERSION,
            };
            store.set(data.code, row);
            return row;
          },
        ),
        update: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => {
            const row = [...store.values()].find((r) => r.id === where.id)!;
            Object.assign(row, data);
            return row;
          },
        ),
      },
      store,
    };
  }

  it("v1 legacy JSON remaps to canon at v2 without restoring strips", async () => {
    const legacy = JSON.stringify([
      "reservations:read",
      "reports:read",
      // folio:void intentionally absent
      "api:import.elektraweb",
      "api:integration.elektraweb_bridge",
    ]);
    const db = makeDb([
      {
        code: ROLE_CODES.MANAGER,
        permissionsJson: legacy,
        permissionCatalogVersion: 1,
      },
    ]);
    await ensureSystemHotelRoles(db, "org-1");
    const manager = db.store.get(ROLE_CODES.MANAGER)!;
    const perms = parsePermissions(manager.permissionsJson);
    expect(perms).toEqual(
      expect.arrayContaining([
        PERMISSIONS.RESERVATIONS_READ,
        PERMISSIONS.REPORTS_READ,
        PERMISSIONS.API_IMPORT_ELEKTRAWEB,
        PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE,
      ]),
    );
    expect(perms).toContain(PERMISSIONS.SCREEN_FO);
    expect(perms).toContain(PERMISSIONS.SCREEN_REPORTS);
    expect(perms).not.toContain(PERMISSIONS.FOLIO_VOID);
    expect(manager.permissionsJson).not.toContain("reservations:read");
    expect(manager.permissionCatalogVersion).toBe(
      HOTEL_PERMISSION_CATALOG_VERSION,
    );
  });

  it("empty [] stays empty and bumps to current catalog version", async () => {
    const db = makeDb([
      {
        code: ROLE_CODES.MANAGER,
        permissionsJson: "[]",
        permissionCatalogVersion: 1,
      },
    ]);
    await ensureSystemHotelRoles(db, "org-1");
    const manager = db.store.get(ROLE_CODES.MANAGER)!;
    expect(manager.permissionsJson).toBe("[]");
    expect(manager.permissionCatalogVersion).toBe(
      HOTEL_PERMISSION_CATALOG_VERSION,
    );
  });

  it("v0 legacy gets Wave-1 additive then Wave-2 remap", async () => {
    const legacy = JSON.stringify(["reservations:read", "reports:read"]);
    const db = makeDb([
      {
        code: ROLE_CODES.MANAGER,
        permissionsJson: legacy,
        permissionCatalogVersion: 0,
      },
    ]);
    await ensureSystemHotelRoles(db, "org-1");
    const manager = db.store.get(ROLE_CODES.MANAGER)!;
    const perms = parsePermissions(manager.permissionsJson);
    expect(perms).toEqual(
      expect.arrayContaining([
        PERMISSIONS.RESERVATIONS_READ,
        PERMISSIONS.REPORTS_READ,
        PERMISSIONS.API_IMPORT_ELEKTRAWEB,
        PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE,
      ]),
    );
    expect(perms).not.toContain(PERMISSIONS.FOLIO_VOID);
    expect(manager.permissionCatalogVersion).toBe(
      HOTEL_PERMISSION_CATALOG_VERSION,
    );
  });

  it("v2 canonical JSON gains paired screens at v3 without restoring strips", async () => {
    const canon = serializePermissions([
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.REPORTS_READ,
    ]);
    const db = makeDb([
      {
        code: ROLE_CODES.MANAGER,
        permissionsJson: canon,
        permissionCatalogVersion: 2,
      },
    ]);
    await ensureSystemHotelRoles(db, "org-1");
    const manager = db.store.get(ROLE_CODES.MANAGER)!;
    const perms = parsePermissions(manager.permissionsJson);
    expect(perms).toEqual(
      expect.arrayContaining([
        PERMISSIONS.RESERVATIONS_READ,
        PERMISSIONS.REPORTS_READ,
        PERMISSIONS.SCREEN_FO,
        PERMISSIONS.SCREEN_REPORTS,
      ]),
    );
    expect(perms).not.toContain(PERMISSIONS.FOLIO_VOID);
    expect(manager.permissionCatalogVersion).toBe(
      HOTEL_PERMISSION_CATALOG_VERSION,
    );
  });

  it("v2 with leftover legacy JSON heals without restoring strips", async () => {
    const legacyStuck = JSON.stringify([
      "reservations:read",
      "reports:read",
      // folio:void intentionally absent
    ]);
    const db = makeDb([
      {
        code: ROLE_CODES.MANAGER,
        permissionsJson: legacyStuck,
        permissionCatalogVersion: 2,
      },
    ]);
    await ensureSystemHotelRoles(db, "org-1");
    const manager = db.store.get(ROLE_CODES.MANAGER)!;
    const perms = parsePermissions(manager.permissionsJson);
    expect(perms).toEqual(
      expect.arrayContaining([
        PERMISSIONS.RESERVATIONS_READ,
        PERMISSIONS.REPORTS_READ,
        PERMISSIONS.SCREEN_FO,
      ]),
    );
    expect(perms).not.toContain(PERMISSIONS.FOLIO_VOID);
    expect(manager.permissionsJson).not.toContain("reservations:read");
    expect(manager.permissionCatalogVersion).toBe(
      HOTEL_PERMISSION_CATALOG_VERSION,
    );
  });

  it("bumpCatalogVersionPatch is pure remap for custom subset", () => {
    const patch = bumpCatalogVersionPatch({
      id: "1",
      code: "NIGHT_MANAGER",
      name: "NM",
      isSystem: false,
      cloneFromCode: ROLE_CODES.NIGHT_AUDITOR,
      permissionsJson: JSON.stringify([
        "night_audit:run",
        "reports:read",
      ]),
      permissionCatalogVersion: 1,
    });
    expect(patch.permissionCatalogVersion).toBe(
      HOTEL_PERMISSION_CATALOG_VERSION,
    );
    expect(parsePermissions(patch.permissionsJson!)).toEqual(
      expect.arrayContaining([
        PERMISSIONS.NIGHT_AUDIT_RUN,
        PERMISSIONS.REPORTS_READ,
        PERMISSIONS.SCREEN_NIGHT_AUDIT,
        PERMISSIONS.SCREEN_REPORTS,
      ]),
    );
    expect(parsePermissions(patch.permissionsJson!)).not.toContain(
      PERMISSIONS.FOLIO_VOID,
    );
  });
});
