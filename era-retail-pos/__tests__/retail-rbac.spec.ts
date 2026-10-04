jest.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  ACCESS_MANAGER_ROLE,
  ALL_PERMISSIONS,
  LEGACY_FALLBACK_ROLE,
  PERMISSIONS,
  PERMISSION_CATALOG_VERSION,
  ROLE_TEMPLATES,
  SYSTEM_ROLE_CODES,
  type Permission,
} from "@/lib/auth/permissions";
import {
  effectiveRolePermissions,
  parsePermissions,
  serializePermissions,
} from "@/lib/auth/permission-catalog";
import {
  hasPermissionBypass,
  resolveSessionPermissions,
  sessionHasPermission,
} from "@/lib/auth/permission-check";
import { assertApiRouteGrant } from "@/lib/auth/require";
import { API_ROUTE_RULES, apiRoutePermissions } from "@/lib/auth/api-route-permissions";
import { routePermissions } from "@/lib/auth/page-route-permissions";
import {
  ensureSystemRoles,
  templatePermissionsForReset,
  type SeedRoleRow,
} from "@/lib/auth/ensure-system-retail-roles";
import {
  canDeleteRole,
  isValidCustomRoleCode,
  roleAssignDenied,
} from "@/lib/auth/retail-role-admin";
import { grantsForUser } from "@/lib/auth/retail-permission.service";

const ORG = "org-1";

function memoryDb(seed: Partial<SeedRoleRow>[] = []) {
  let n = 0;
  const rows: SeedRoleRow[] = seed.map((r) => ({
    id: r.id ?? `r${++n}`,
    code: r.code ?? "X",
    name: r.name ?? r.code ?? "X",
    permissionsJson: r.permissionsJson ?? "[]",
    isSystem: r.isSystem ?? false,
    cloneFromCode: r.cloneFromCode ?? null,
    permissionCatalogVersion: r.permissionCatalogVersion ?? 0,
  }));
  return {
    rows,
    role: {
      findMany: async () => rows.map((r) => ({ ...r })),
      create: async ({ data }: { data: Omit<SeedRoleRow, "id" | "cloneFromCode"> }) => {
        const row = { ...data, id: `r${++n}`, cloneFromCode: null } as SeedRoleRow;
        rows.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
  };
}

function sampleApiPath(pattern: string): string {
  return pattern.replace(/\*\*/g, "x").replace(/\*/g, "x");
}

const session = (permissions?: string[], extra: Record<string, unknown> = {}) => ({
  login: "staff",
  email: "staff@example.az",
  role: "CUSTOM_ROLE",
  permissions,
  ...extra,
});

describe("RBAC catalog (Variant A)", () => {
  it("templates only use catalog codes", () => {
    for (const code of SYSTEM_ROLE_CODES) {
      for (const p of ROLE_TEMPLATES[code]) expect(ALL_PERMISSIONS).toContain(p);
    }
  });

  it("keeps the control-plane trio as system packages", () => {
    expect(SYSTEM_ROLE_CODES).toEqual(
      expect.arrayContaining(["BUSINESS_OWNER", "PLATFORM_MEMBER", "SATELLITE_OPERATOR"]),
    );
  });

  it("only the access-manager package and the owner hold admin:access_manage", () => {
    const holders = SYSTEM_ROLE_CODES.filter((c) =>
      ROLE_TEMPLATES[c].includes(PERMISSIONS.ACCESS_MANAGE),
    );
    expect(holders.sort()).toEqual([ACCESS_MANAGER_ROLE, "BUSINESS_OWNER"].sort());
  });

  it("serialize dedupes and drops unknown codes", () => {
    const json = serializePermissions([PERMISSIONS.ACCESS_MANAGE, PERMISSIONS.ACCESS_MANAGE, "nope"]);
    expect(parsePermissions(json)).toEqual([PERMISSIONS.ACCESS_MANAGE]);
  });
});

describe("empty list and missing claim", () => {
  it("an empty array on the current catalog version is authoritative", () => {
    expect(
      effectiveRolePermissions({
        code: ACCESS_MANAGER_ROLE,
        permissionsJson: "[]",
        permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
      }),
    ).toEqual([]);
  });

  it("a pre-matrix row (version 0, column default []) reads as its template", () => {
    expect(
      effectiveRolePermissions({ code: ACCESS_MANAGER_ROLE, permissionsJson: "[]", permissionCatalogVersion: 0 }),
    ).toEqual([...ROLE_TEMPLATES[ACCESS_MANAGER_ROLE]]);
  });

  it("an unknown legacy code takes the fallback package, not the matrix admin one", () => {
    expect(
      effectiveRolePermissions({ code: "LEGACY_STAFF", permissionsJson: "[]", permissionCatalogVersion: 0 }),
    ).toEqual([...ROLE_TEMPLATES[LEGACY_FALLBACK_ROLE]]);
  });

  it("a missing permissions claim is fail-closed", () => {
    expect(resolveSessionPermissions(session(undefined))).toEqual([]);
    expect(sessionHasPermission(session(undefined), PERMISSIONS.ACCESS_MANAGE)).toBe(false);
  });

  it("the access-manager role name does not bypass", () => {
    expect(hasPermissionBypass(session([], { role: ACCESS_MANAGER_ROLE }))).toBe(false);
    expect(sessionHasPermission(session([], { role: ACCESS_MANAGER_ROLE }), PERMISSIONS.ACCESS_MANAGE)).toBe(false);
  });

  it("owner and BUSINESS_OWNER bypass; a PIN session never does", () => {
    expect(hasPermissionBypass(session([], { isOwner: true }))).toBe(true);
    expect(hasPermissionBypass(session([], { role: "BUSINESS_OWNER" }))).toBe(true);
    expect(hasPermissionBypass(session([], { isOwner: true, pin: true }))).toBe(false);
    expect(grantsForUser({ login: "o", role: { code: "BUSINESS_OWNER", permissionsJson: "[]" } })).toEqual([
      ...ALL_PERMISSIONS,
    ]);
  });
});

describe("ensureSystemRoles", () => {
  it("creates every system package with its template on the current version", async () => {
    const db = memoryDb();
    await ensureSystemRoles(db, ORG);
    for (const code of SYSTEM_ROLE_CODES) {
      const row = db.rows.find((r) => r.code === code)!;
      expect(row.isSystem).toBe(true);
      expect(row.permissionCatalogVersion).toBe(PERMISSION_CATALOG_VERSION);
      expect(parsePermissions(row.permissionsJson).sort()).toEqual([...ROLE_TEMPLATES[code]].sort());
    }
  });

  it("leaves an intentional [] and a customized list alone", async () => {
    const db = memoryDb([
      { code: ACCESS_MANAGER_ROLE, permissionsJson: "[]", permissionCatalogVersion: PERMISSION_CATALOG_VERSION },
      {
        code: "CUSTOM_ONE",
        permissionsJson: JSON.stringify([PERMISSIONS.ACCESS_MANAGE]),
        permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
      },
    ]);
    await ensureSystemRoles(db, ORG);
    expect(db.rows.find((r) => r.code === ACCESS_MANAGER_ROLE)!.permissionsJson).toBe("[]");
    expect(parsePermissions(db.rows.find((r) => r.code === "CUSTOM_ONE")!.permissionsJson)).toEqual([
      PERMISSIONS.ACCESS_MANAGE,
    ]);
  });

  it("cuts a pre-matrix legacy row over once and records its donor", async () => {
    const db = memoryDb([{ code: "LEGACY_STAFF", permissionsJson: "[]", permissionCatalogVersion: 0 }]);
    await ensureSystemRoles(db, ORG);
    const row = db.rows.find((r) => r.code === "LEGACY_STAFF")!;
    expect(row.cloneFromCode).toBe(LEGACY_FALLBACK_ROLE);
    expect(row.permissionCatalogVersion).toBe(PERMISSION_CATALOG_VERSION);
    expect(parsePermissions(row.permissionsJson).sort()).toEqual([...ROLE_TEMPLATES[LEGACY_FALLBACK_ROLE]].sort());
  });

  it("reset restores the system template or the donor template", () => {
    expect(templatePermissionsForReset({ code: ACCESS_MANAGER_ROLE, cloneFromCode: null })).toEqual([
      ...ROLE_TEMPLATES[ACCESS_MANAGER_ROLE],
    ]);
    expect(templatePermissionsForReset({ code: "CUSTOM_ONE", cloneFromCode: LEGACY_FALLBACK_ROLE })).toEqual([
      ...ROLE_TEMPLATES[LEGACY_FALLBACK_ROLE],
    ]);
    expect(templatePermissionsForReset({ code: "CUSTOM_TWO", cloneFromCode: null })).toEqual([]);
  });
});

describe("API door: strip one grant → 403", () => {
  it.each(API_ROUTE_RULES.map(([pattern, grants]) => [pattern, grants] as const))(
    "%s",
    (pattern, grants) => {
      const path = sampleApiPath(pattern);
      const others = ALL_PERMISSIONS.filter((p) => !grants.includes(p));
      expect(() => assertApiRouteGrant(session(others), path)).toThrow(
        expect.objectContaining({ name: "PermissionDeniedError", status: 403 }),
      );
      expect(() => assertApiRouteGrant(session([grants[0] as Permission]), path)).not.toThrow();
    },
  );

  it("an API path outside the catalog denies; a missing path denies; session-only and non-API paths pass", () => {
    expect(apiRoutePermissions("/api/not-a-route")).toBeNull();
    expect(() => assertApiRouteGrant(session(ALL_PERMISSIONS as string[]), "/api/not-a-route")).toThrow(
      expect.objectContaining({ status: 403 }),
    );
    expect(() => assertApiRouteGrant(session([]), "/api/auth/me")).not.toThrow();
    expect(() => assertApiRouteGrant(session([]), "/")).not.toThrow();
    expect(() => assertApiRouteGrant(session([]), null)).toThrow(
      expect.objectContaining({ name: "PermissionDeniedError", status: 403 }),
    );
  });

  it("an unlisted staff page denies", () => {
    expect(routePermissions("/not-a-page")).toBeNull();
  });
});

describe("role admin", () => {
  it("custom codes cannot reuse a system code", () => {
    expect(isValidCustomRoleCode(ACCESS_MANAGER_ROLE)).toBe(false);
    expect(isValidCustomRoleCode("bad code")).toBe(false);
    expect(isValidCustomRoleCode("NIGHT_DESK")).toBe(true);
  });

  it("system and in-use roles cannot be deleted", () => {
    expect(canDeleteRole({ isSystem: true, code: ACCESS_MANAGER_ROLE, userCount: 0 })).toEqual({
      ok: false,
      reason: "system",
    });
    expect(canDeleteRole({ isSystem: false, code: "NIGHT_DESK", userCount: 2 })).toEqual({
      ok: false,
      reason: "in_use",
    });
    expect(canDeleteRole({ isSystem: false, code: "NIGHT_DESK", userCount: 0 })).toEqual({ ok: true });
  });

  it("only a bypass actor moves users into or out of the owner package", () => {
    expect(roleAssignDenied({ actorBypass: false, fromRoleCode: "X", toRoleCode: "BUSINESS_OWNER" })).toMatch(
      /Forbidden/,
    );
    expect(roleAssignDenied({ actorBypass: false, fromRoleCode: "BUSINESS_OWNER", toRoleCode: "X" })).toMatch(
      /Forbidden/,
    );
    expect(roleAssignDenied({ actorBypass: true, fromRoleCode: "X", toRoleCode: "BUSINESS_OWNER" })).toBeNull();
    expect(roleAssignDenied({ actorBypass: false, fromRoleCode: "X", toRoleCode: "Y" })).toBeNull();
  });
});
