import {
  PERMISSIONS,
  effectiveRolePermissions,
  parsePermissions,
  permissionsForRole,
  permissionsJsonNeedsTemplate,
  resolveBankRoleCode,
  serializePermissions,
  tellerPermissions,
  branchManagerPermissions,
  amlOfficerPermissions,
} from "@/lib/auth/permissions";
import {
  ensureSystemBankRoles,
  templatePermissionsForReset,
} from "@/lib/auth/ensure-system-bank-roles";
import {
  hasBankPermissionBypass,
  sessionHasBankPermission,
} from "@/lib/auth/permission-check";
import { routePermissions } from "@/lib/auth/page-route-permissions";
import { requiredPermissionsForEngineProxy } from "@/lib/auth/bff-permission-map";

describe("bank rbac catalog", () => {
  it("teller has write but no approve", () => {
    const t = tellerPermissions();
    expect(t).toContain(PERMISSIONS.POSTINGS_WRITE);
    expect(t).not.toContain(PERMISSIONS.POSTINGS_APPROVE);
    expect(t).not.toContain(PERMISSIONS.PAYMENTS_APPROVE);
    expect(t).not.toContain(PERMISSIONS.ACCESS_MANAGE);
  });

  it("branch manager has approve and access; is not bypass", () => {
    const m = branchManagerPermissions();
    expect(m).toContain(PERMISSIONS.POSTINGS_APPROVE);
    expect(m).toContain(PERMISSIONS.ACCESS_MANAGE);
    expect(m).toContain(PERMISSIONS.SCREEN_ADMIN_ACCESS);
    expect(
      hasBankPermissionBypass({
        login: "mgr",
        role: "BRANCH_MANAGER",
        permissions: [],
      }),
    ).toBe(false);
  });

  it("aml officer cannot cards", () => {
    const a = amlOfficerPermissions();
    expect(a).toContain(PERMISSIONS.SCREEN_AML);
    expect(a).toContain(PERMISSIONS.AML_FMN);
    expect(a).not.toContain(PERMISSIONS.SCREEN_CARDS);
    expect(a).not.toContain(PERMISSIONS.CARDS_READ);
  });

  it("valid empty array sticks; invalid needs template", () => {
    expect(permissionsJsonNeedsTemplate("[]")).toBe(false);
    expect(permissionsJsonNeedsTemplate("")).toBe(true);
    expect(permissionsJsonNeedsTemplate("{")).toBe(true);
    expect(parsePermissions("[]")).toEqual([]);
  });

  it("effectiveRolePermissions honors stored strip", () => {
    const stripped = serializePermissions(
      branchManagerPermissions().filter(
        (p) => p !== PERMISSIONS.PAYMENTS_APPROVE,
      ),
    );
    const eff = effectiveRolePermissions("BRANCH_MANAGER", stripped);
    expect(eff).not.toContain(PERMISSIONS.PAYMENTS_APPROVE);
  });

  it("resolves aliases; unknown null", () => {
    expect(resolveBankRoleCode("MANAGER")).toBe("BRANCH_MANAGER");
    expect(resolveBankRoleCode("AML")).toBe("AML_OFFICER");
    expect(resolveBankRoleCode("BANANA")).toBeNull();
  });

  it("owner bypass; BUSINESS_OWNER expands", () => {
    expect(
      hasBankPermissionBypass({
        login: "owner",
        role: "BUSINESS_OWNER",
        permissions: [],
      }),
    ).toBe(true);
    expect(
      sessionHasBankPermission(
        {
          login: "owner",
          role: "BUSINESS_OWNER",
          permissions: [],
          isOwner: true,
        },
        PERMISSIONS.ACCESS_MANAGE,
      ),
    ).toBe(true);
  });

  it("empty permissions fail-closed for teller role name", () => {
    expect(
      sessionHasBankPermission(
        { login: "t", role: "TELLER", permissions: [] },
        PERMISSIONS.SCREEN_CIF,
      ),
    ).toBe(false);
  });

  it("routePermissions maps key screens", () => {
    expect(routePermissions("/admin/access")).toEqual([
      PERMISSIONS.SCREEN_ADMIN_ACCESS,
    ]);
    expect(routePermissions("/aml/alerts")).toEqual([PERMISSIONS.SCREEN_AML]);
    expect(routePermissions("/cards/issue")).toEqual([
      PERMISSIONS.SCREEN_CARDS,
    ]);
    expect(routePermissions("/unknown-xyz")).toBeNull();
  });

  it("bff map: approve and cards read", () => {
    expect(
      requiredPermissionsForEngineProxy({
        enginePrefix: "payments",
        method: "POST",
        pathSegments: ["x", "approve"],
      }),
    ).toEqual([PERMISSIONS.PAYMENTS_APPROVE]);
    expect(
      requiredPermissionsForEngineProxy({
        enginePrefix: "cards",
        method: "GET",
        pathSegments: [],
      }),
    ).toEqual([PERMISSIONS.CARDS_READ]);
  });

  it("ensureSystemBankRoles fills missing and leaves intentional []", async () => {
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
      opsRole: {
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
          store.set(`${data.organizationId}:${data.code}`, row);
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
          const next = { ...row, ...data } as typeof row;
          store.set(where.id, next);
          return next;
        },
      },
    };

    await ensureSystemBankRoles(db, "org-1");
    const teller = store.get("org-1:TELLER")!;
    expect(parsePermissions(teller.permissionsJson).length).toBeGreaterThan(0);

    store.set("org-1:TELLER", {
      ...teller,
      permissionsJson: "[]",
      permissionCatalogVersion: 1,
    });
    await ensureSystemBankRoles(db, "org-1");
    expect(store.get("org-1:TELLER")!.permissionsJson).toBe("[]");
  });

  it("templatePermissionsForReset uses system template", () => {
    expect(templatePermissionsForReset({ code: "TELLER", cloneFromCode: null })).toEqual(
      permissionsForRole("TELLER"),
    );
  });
});
