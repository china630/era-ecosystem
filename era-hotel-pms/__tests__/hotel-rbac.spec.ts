import {
  PERMISSIONS,
  ROLE_CODES,
  ROLE_PERMISSIONS,
  effectiveRolePermissions,
  serializePermissions,
  parsePermissions,
} from "@/lib/auth/permissions";
import { assertPermission, assertAnyPermission } from "@/lib/auth/require";
import type { SessionPayload } from "@/lib/auth/jwt";
import { ensureSystemHotelRoles, HOTEL_PERMISSION_CATALOG_VERSION } from "@/lib/auth/ensure-system-hotel-roles";
import {
  canDeleteHotelRole,
  isValidCustomHotelRoleCode,
  normalizeHotelRoleCode,
} from "@/lib/auth/hotel-role-admin";
import { resolveSystemRoleAlias } from "@/lib/hotel-roles";
import { routePermissions } from "@/lib/auth/page-route-permissions";
import { canViewHotelExecutive } from "@/lib/auth/hotel-executive";
import {
  isElektrawebBridgeS2SRole,
  sessionMayUseBridge,
} from "@/lib/integration/elektraweb-bridge/grants";
import { sessionHasHotelPermission } from "@/lib/auth/permission-check";

describe("hotel page route permissions", () => {
  it("HK and front-cash use any-of grants", () => {
    expect(routePermissions("/hk")).toEqual([PERMISSIONS.SCREEN_HK]);
    expect(routePermissions("/front-cash")).toEqual([
      PERMISSIONS.SCREEN_FRONT_CASH,
    ]);
    expect(routePermissions("/folio/abc")).toEqual([PERMISSIONS.SCREEN_FOLIO]);
    expect(routePermissions("/settings/import")).toEqual([
      PERMISSIONS.SCREEN_SETTINGS_IMPORT,
    ]);
    expect(routePermissions("/spa")).toEqual([PERMISSIONS.SCREEN_MEDICAL]);
    expect(routePermissions("/executive")).toEqual(
      expect.arrayContaining([
        PERMISSIONS.SCREEN_REPORTS,
        PERMISSIONS.SCREEN_FO,
      ]),
    );
  });

  it("canViewHotelExecutive uses grants not role name", () => {
    expect(
      canViewHotelExecutive({
        login: "x",
        role: ROLE_CODES.HOUSEKEEPER,
        permissions: [PERMISSIONS.REPORTS_READ],
      }),
    ).toBe(true);
    expect(
      canViewHotelExecutive({
        login: "x",
        role: ROLE_CODES.HOTEL_ADMIN,
        permissions: [],
      }),
    ).toBe(false);
  });
});


describe("hotel RBAC Variant A", () => {
  it("assertPermission uses session permissions, not role code template", () => {
    const session: SessionPayload = {
      sub: "u1",
      login: "admin",
      role: ROLE_CODES.HOTEL_ADMIN,
      fullName: "Admin",
      permissions: [PERMISSIONS.RESERVATIONS_READ],
    };
    expect(() =>
      assertPermission(session, PERMISSIONS.RESERVATIONS_READ),
    ).not.toThrow();
    expect(() => assertPermission(session, PERMISSIONS.FOLIO_VOID)).toThrow(
      /Forbidden/,
    );
  });

  it("Hotel_Admin without grants is denied (no role-name bypass)", () => {
    const session: SessionPayload = {
      sub: "u1",
      login: "admin",
      role: ROLE_CODES.HOTEL_ADMIN,
      fullName: "Admin",
      permissions: [],
    };
    expect(() =>
      assertPermission(session, PERMISSIONS.ACCESS_MANAGE),
    ).toThrow(/Forbidden/);
  });

  it("OrgOwner bypasses matrix", () => {
    const session: SessionPayload = {
      sub: "u1",
      login: "owner",
      role: "BUSINESS_OWNER",
      fullName: "Owner",
      permissions: [],
      isOwner: true,
    };
    expect(() =>
      assertPermission(session, PERMISSIONS.FOLIO_VOID),
    ).not.toThrow();
  });

  it("assertAnyPermission accepts any listed grant", () => {
    const session: SessionPayload = {
      sub: "u1",
      login: "hk",
      role: ROLE_CODES.HOUSEKEEPER,
      fullName: "HK",
      permissions: [PERMISSIONS.ROOMS_STATUS],
    };
    expect(() =>
      assertAnyPermission(session, [
        PERMISSIONS.HOUSEKEEPING_MANAGE,
        PERMISSIONS.ROOMS_STATUS,
      ]),
    ).not.toThrow();
  });

  it("effectiveRolePermissions honors stored JSON including empty", () => {
    const custom = serializePermissions([PERMISSIONS.REPORTS_READ]);
    expect(
      effectiveRolePermissions(ROLE_CODES.HOTEL_ADMIN, custom),
    ).toEqual([PERMISSIONS.REPORTS_READ]);
    expect(effectiveRolePermissions(ROLE_CODES.HOTEL_ADMIN, "[]")).toEqual([]);
    expect(
      effectiveRolePermissions(ROLE_CODES.HOTEL_ADMIN, "not-json").length,
    ).toBe(ROLE_PERMISSIONS[ROLE_CODES.HOTEL_ADMIN].length);
  });

  it("custom role code rules", () => {
    expect(isValidCustomHotelRoleCode("NIGHT_MANAGER")).toBe(true);
    expect(isValidCustomHotelRoleCode(ROLE_CODES.HOTEL_ADMIN)).toBe(false);
    expect(isValidCustomHotelRoleCode("HOTEL_ADMIN")).toBe(false);
    expect(isValidCustomHotelRoleCode(normalizeHotelRoleCode("night_manager"))).toBe(
      true,
    );
    expect(
      canDeleteHotelRole({
        isSystem: false,
        code: "NIGHT_MANAGER",
        userCount: 0,
      }),
    ).toEqual({ ok: true });
    expect(
      canDeleteHotelRole({
        isSystem: true,
        code: ROLE_CODES.MANAGER,
        userCount: 0,
      }),
    ).toEqual({ ok: false, reason: "system" });
  });

  it("resolveSystemRoleAlias maps CP aliases only", () => {
    expect(resolveSystemRoleAlias("RECEPTION")).toBe(ROLE_CODES.RECEPTIONIST);
    expect(resolveSystemRoleAlias("HOUSEKEEPING")).toBe(ROLE_CODES.HOUSEKEEPER);
    expect(resolveSystemRoleAlias("Receptionist")).toBe(ROLE_CODES.RECEPTIONIST);
    expect(resolveSystemRoleAlias("NIGHT_MANAGER")).toBe("NIGHT_MANAGER");
  });
});

describe("ensureSystemHotelRoles", () => {
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
          organizationId: "org-1",
          code: r.code,
          name: r.name ?? r.code,
          permissionsJson: r.permissionsJson,
          isSystem: false,
          cloneFromCode: r.cloneFromCode ?? null,
          permissionCatalogVersion: r.permissionCatalogVersion ?? 0,
        },
      ]),
    );
    return {
      role: {
        findFirst: jest.fn(async ({ where }: { where: { code: string } }) => {
          return store.get(where.code) ?? null;
        }),
        findMany: jest.fn(async () => [...store.values()]),
        create: jest.fn(
          async ({
            data,
          }: {
            data: {
              code: string;
              permissionsJson: string;
              name: string;
              permissionCatalogVersion?: number;
            };
          }) => {
            const row = {
              id: `id-${data.code}`,
              organizationId: "org-1",
              isSystem: true,
              cloneFromCode: null as string | null,
              permissionCatalogVersion:
                data.permissionCatalogVersion ?? HOTEL_PERMISSION_CATALOG_VERSION,
              ...data,
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
            const found = [...store.values()].find((r) => r.id === where.id);
            if (!found) throw new Error("missing");
            Object.assign(found, data);
            return found;
          },
        ),
      },
      store,
    };
  }

  it("creates all system roles when empty", async () => {
    const db = makeDb([]);
    await ensureSystemHotelRoles(db, "org-1");
    expect(db.role.create).toHaveBeenCalledTimes(
      Object.keys(ROLE_PERMISSIONS).length,
    );
    for (const code of Object.keys(ROLE_PERMISSIONS)) {
      expect(db.store.get(code)!.isSystem).toBe(true);
      expect(db.store.get(code)!.permissionCatalogVersion).toBe(
        HOTEL_PERMISSION_CATALOG_VERSION,
      );
    }
  });

  it("does not overwrite customized permissionsJson at catalog v2+", async () => {
    const custom = serializePermissions([PERMISSIONS.FOLIO_READ]);
    const db = makeDb([
      {
        code: ROLE_CODES.RECEPTIONIST,
        permissionsJson: custom,
        permissionCatalogVersion: HOTEL_PERMISSION_CATALOG_VERSION,
      },
    ]);
    await ensureSystemHotelRoles(db, "org-1");
    expect(db.store.get(ROLE_CODES.RECEPTIONIST)!.permissionsJson).toBe(custom);
    const updates = (db.role.update as jest.Mock).mock.calls.filter(
      (c) => c[0].where.id === `id-${ROLE_CODES.RECEPTIONIST}`,
    );
    for (const call of updates) {
      expect(call[0].data.permissionsJson).toBeUndefined();
    }
  });

  it("Wave-1 additive: v0 Manager gains import+bridge; stripped keys stay stripped", async () => {
    const stripped = serializePermissions([
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.REPORTS_READ,
    ]);
    const db = makeDb([
      {
        code: ROLE_CODES.MANAGER,
        permissionsJson: stripped,
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
    expect(manager.permissionCatalogVersion).toBe(HOTEL_PERMISSION_CATALOG_VERSION);
  });

  it("Wave-1: v1 after strip import keeps strip", async () => {
    const withoutImport = serializePermissions([
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE,
    ]);
    const db = makeDb([
      {
        code: ROLE_CODES.MANAGER,
        permissionsJson: withoutImport,
        permissionCatalogVersion: HOTEL_PERMISSION_CATALOG_VERSION,
      },
    ]);
    await ensureSystemHotelRoles(db, "org-1");
    expect(parsePermissions(db.store.get(ROLE_CODES.MANAGER)!.permissionsJson)).toEqual(
      parsePermissions(withoutImport),
    );
  });

  it("Wave-1: custom clone NightAuditor does not get import", async () => {
    const custom = serializePermissions([
      PERMISSIONS.NIGHT_AUDIT_RUN,
      PERMISSIONS.REPORTS_READ,
    ]);
    const db = makeDb([
      {
        code: "NIGHT_MANAGER",
        permissionsJson: custom,
        cloneFromCode: ROLE_CODES.NIGHT_AUDITOR,
        permissionCatalogVersion: 0,
      },
    ]);
    await ensureSystemHotelRoles(db, "org-1");
    const row = db.store.get("NIGHT_MANAGER")!;
    const perms = parsePermissions(row.permissionsJson);
    expect(perms).toContain(PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE);
    expect(perms).not.toContain(PERMISSIONS.API_IMPORT_ELEKTRAWEB);
    expect(row.permissionCatalogVersion).toBe(HOTEL_PERMISSION_CATALOG_VERSION);
  });

  it("does not refill intentional empty permissionsJson", async () => {
    const db = makeDb([
      { code: ROLE_CODES.MANAGER, permissionsJson: "[]", name: "" },
    ]);
    await ensureSystemHotelRoles(db, "org-1");
    const manager = db.store.get(ROLE_CODES.MANAGER)!;
    expect(manager.permissionsJson).toBe("[]");
    expect(manager.isSystem).toBe(true);
    expect(manager.name).toBeTruthy();
    expect(manager.permissionCatalogVersion).toBe(HOTEL_PERMISSION_CATALOG_VERSION);
  });

  it("fills invalid permissionsJson from template", async () => {
    const db = makeDb([
      { code: ROLE_CODES.MANAGER, permissionsJson: "{broken", name: "" },
    ]);
    await ensureSystemHotelRoles(db, "org-1");
    const manager = db.store.get(ROLE_CODES.MANAGER)!;
    expect(parsePermissions(manager.permissionsJson).length).toBeGreaterThan(0);
    expect(manager.isSystem).toBe(true);
    expect(manager.permissionCatalogVersion).toBe(HOTEL_PERMISSION_CATALOG_VERSION);
  });
});

describe("Wave 1 import/bridge grant helpers", () => {
  it("sessionMayUseBridge is grant-based, not role-name", () => {
    expect(
      sessionMayUseBridge({
        login: "hk",
        role: ROLE_CODES.HOUSEKEEPER,
        permissions: [PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE],
      }),
    ).toBe(true);
    expect(
      sessionMayUseBridge({
        login: "mgr",
        role: ROLE_CODES.MANAGER,
        permissions: [PERMISSIONS.RESERVATIONS_READ],
      }),
    ).toBe(false);
    expect(isElektrawebBridgeS2SRole("bridge")).toBe(true);
    expect(isElektrawebBridgeS2SRole("Manager")).toBe(false);
  });

  it("import grant is fail-closed without permissions[]", () => {
    expect(
      sessionHasHotelPermission(
        {
          login: "admin",
          role: ROLE_CODES.HOTEL_ADMIN,
        },
        PERMISSIONS.API_IMPORT_ELEKTRAWEB,
      ),
    ).toBe(false);
    expect(
      sessionHasHotelPermission(
        {
          login: "admin",
          role: ROLE_CODES.HOTEL_ADMIN,
          permissions: [PERMISSIONS.API_IMPORT_ELEKTRAWEB],
        },
        PERMISSIONS.API_IMPORT_ELEKTRAWEB,
      ),
    ).toBe(true);
  });
});
