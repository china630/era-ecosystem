import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  effectiveRolePermissions,
  parsePermissions,
  permissionsJsonNeedsTemplate,
  rolePermissionsForEdition,
  resolveFnbRoleCode,
  serializePermissions,
  waiterPermissions,
} from "@/lib/auth/permissions";
import {
  FNB_PERMISSION_CATALOG_VERSION,
  ensureSystemFnbRoles,
  resolveFnbEdition,
  templatePermissionsForReset,
} from "@/lib/auth/ensure-system-fnb-roles";
import {
  hasFnbPermissionBypass,
  sessionHasFnbPermission,
} from "@/lib/auth/permission-check";
import { routePermissions } from "@/lib/auth/page-route-permissions";

describe("fnb rbac catalog", () => {
  it("kafe waiter omits pay; hotel waiter includes pay", () => {
    expect(waiterPermissions("kafe")).not.toContain(PERMISSIONS.TICKETS_PAY);
    expect(waiterPermissions("hotel")).toContain(PERMISSIONS.TICKETS_PAY);
  });

  it("manager hotel template includes void and access", () => {
    const m = rolePermissionsForEdition("FB_MANAGER", "hotel");
    expect(m).toContain(PERMISSIONS.TICKETS_VOID);
    expect(m).toContain(PERMISSIONS.ACCESS_MANAGE);
    expect(m).toContain(PERMISSIONS.SCREEN_ADMIN_ACCESS);
  });

  it("kitchen is kds-only screens", () => {
    const k = rolePermissionsForEdition("FB_KITCHEN", "hotel");
    expect(k).toContain(PERMISSIONS.KDS_BUMP);
    expect(k).not.toContain(PERMISSIONS.MENU_MANAGE);
    expect(k).not.toContain(PERMISSIONS.SCREEN_ADMIN_MENU);
  });

  it("valid empty array sticks; invalid needs template", () => {
    expect(permissionsJsonNeedsTemplate("[]")).toBe(false);
    expect(permissionsJsonNeedsTemplate("")).toBe(true);
    expect(permissionsJsonNeedsTemplate("{")).toBe(true);
    expect(parsePermissions("[]")).toEqual([]);
  });

  it("effectiveRolePermissions honors stored strip", () => {
    const stripped = serializePermissions(
      waiterPermissions("hotel").filter((p) => p !== PERMISSIONS.TICKETS_VOID),
    );
    const eff = effectiveRolePermissions("FB_MANAGER", stripped, "hotel");
    expect(eff).not.toContain(PERMISSIONS.TICKETS_VOID);
  });

  it("resolves CP aliases; unknown null", () => {
    expect(resolveFnbRoleCode("WAITER")).toBe("FB_WAITER");
    expect(resolveFnbRoleCode("CHEF")).toBe("FB_KITCHEN");
    expect(resolveFnbRoleCode("BANANA")).toBeNull();
  });

  it("edition resolve", () => {
    expect(resolveFnbEdition("kafe")).toBe("kafe");
    expect(resolveFnbEdition("hotel", false)).toBe("kafe");
    expect(resolveFnbEdition("hotel", true)).toBe("hotel");
  });

  it("FB_MANAGER does not bypass; owner and pin rules", () => {
    expect(
      hasFnbPermissionBypass({
        login: "mgr",
        role: "FB_MANAGER",
        permissions: [],
      }),
    ).toBe(false);
    expect(
      hasFnbPermissionBypass({
        login: "o",
        role: "BUSINESS_OWNER",
        isOwner: true,
      }),
    ).toBe(true);
    expect(
      hasFnbPermissionBypass({
        login: "pin",
        role: "FB_MANAGER",
        isOwner: true,
        pin: true,
      }),
    ).toBe(false);
  });

  it("strip void → sessionHasFnbPermission false", () => {
    const session = {
      login: "mgr",
      role: "FB_MANAGER",
      permissions: ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.TICKETS_VOID),
    };
    expect(sessionHasFnbPermission(session, PERMISSIONS.TICKETS_VOID)).toBe(
      false,
    );
    expect(sessionHasFnbPermission(session, PERMISSIONS.TICKETS_PAY)).toBe(
      true,
    );
  });

  it("ensure fills missing json and honors empty", async () => {
    const store = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        permissionsJson: string;
        isSystem: boolean;
        cloneFromCode: string | null;
        permissionCatalogVersion: number;
      }
    >();
    const db = {
      role: {
        findFirst: async ({
          where,
        }: {
          where: { organizationId: string; code: string };
        }) => store.get(`${where.organizationId}:${where.code}`) ?? null,
        findMany: async ({
          where,
        }: {
          where: { organizationId: string };
        }) =>
          [...store.values()].filter((r) =>
            r.id.startsWith(where.organizationId),
          ),
        create: async ({
          data,
        }: {
          data: {
            organizationId: string;
            code: string;
            name: string;
            isSystem: boolean;
            permissionsJson: string;
            permissionCatalogVersion: number;
          };
        }) => {
          const row = {
            id: `${data.organizationId}:${data.code}`,
            code: data.code,
            name: data.name,
            permissionsJson: data.permissionsJson,
            isSystem: data.isSystem,
            cloneFromCode: null,
            permissionCatalogVersion: data.permissionCatalogVersion,
          };
          store.set(row.id, row);
          return row;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = store.get(where.id)!;
          Object.assign(row, data);
          return row;
        },
      },
    };

    await ensureSystemFnbRoles(db as never, "org-1", "hotel");
    expect(store.size).toBe(4);
    const mgr = store.get("org-1:FB_MANAGER")!;
    expect(mgr.permissionCatalogVersion).toBe(FNB_PERMISSION_CATALOG_VERSION);
    expect(parsePermissions(mgr.permissionsJson).length).toBeGreaterThan(0);

    // intentional empty sticks
    store.set("org-1:FB_WAITER", {
      ...store.get("org-1:FB_WAITER")!,
      permissionsJson: "[]",
    });
    await ensureSystemFnbRoles(db as never, "org-1", "hotel");
    expect(store.get("org-1:FB_WAITER")!.permissionsJson).toBe("[]");
  });

  it("template reset for system role", () => {
    const t = templatePermissionsForReset(
      { code: "FB_CASHIER", cloneFromCode: null },
      "kafe",
    );
    expect(t).toContain(PERMISSIONS.TICKETS_PAY);
    expect(t).not.toContain(PERMISSIONS.TICKETS_VOID);
  });

  it("floor and admin access map to screens", () => {
    expect(routePermissions("/floor")).toContain(PERMISSIONS.SCREEN_FLOOR);
    expect(routePermissions("/admin/access")).toContain(
      PERMISSIONS.SCREEN_ADMIN_ACCESS,
    );
    expect(routePermissions("/unknown-path")).toBeNull();
  });
});
