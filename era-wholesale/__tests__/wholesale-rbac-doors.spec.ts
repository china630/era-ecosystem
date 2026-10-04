jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

const headerValues: Record<string, string | null> = {};
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => undefined })),
  headers: jest.fn(async () => ({ get: (name: string) => headerValues[name] ?? null })),
}));

const findMany = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { importPurchaseOrder: { findMany } } }));

jest.mock("@era/satellite-kit", () => {
  class IndustryModuleInactiveError extends Error {}
  return {
    IndustryModuleInactiveError,
    requireSatelliteModule: jest.fn(async () => undefined),
    readSatelliteStaffSession: jest.fn(async () => null),
  };
});

import { readSatelliteStaffSession } from "@era/satellite-kit";
import { PERMISSIONS, ROLE_CODES, ROLE_TEMPLATES, PERMISSION_CATALOG_VERSION } from "@/lib/auth/permissions";

function staffAs(roleCode: string, permissions: readonly string[] = ROLE_TEMPLATES[roleCode as keyof typeof ROLE_TEMPLATES]) {
  (readSatelliteStaffSession as jest.Mock).mockResolvedValue({
    session: { sub: "u-1", login: "staff", role: roleCode, fullName: "Staff", organizationId: "org-1" },
    user: {
      organizationId: "org-1",
      active: true,
      login: "staff",
      email: null,
      role: {
        code: roleCode,
        permissionsJson: JSON.stringify(permissions),
        permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
      },
    },
  });
}

describe("Wholesale doors (WS-RBAC-01)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(headerValues)) delete headerValues[k];
    findMany.mockResolvedValue([]);
  });

  it("every ops package keeps the full order and pick flow; only the manager imports and manages access", () => {
    for (const code of [
      ROLE_CODES.SALES_REP,
      ROLE_CODES.WAREHOUSE_PICKER,
      ROLE_CODES.PLATFORM_MEMBER,
      ROLE_CODES.SATELLITE_OPERATOR,
    ]) {
      for (const p of [PERMISSIONS.ORDERS_CONFIRM, PERMISSIONS.ORDERS_PAY, PERMISSIONS.PICK, PERMISSIONS.PICK_WAVES]) {
        expect(ROLE_TEMPLATES[code]).toContain(p);
      }
      expect(ROLE_TEMPLATES[code]).not.toContain(PERMISSIONS.ADMIN_IMPORT_ORDERS);
      expect(ROLE_TEMPLATES[code]).not.toContain(PERMISSIONS.ACCESS_MANAGE);
    }
    expect(ROLE_TEMPLATES[ROLE_CODES.WHOLESALE_MANAGER]).toContain(PERMISSIONS.ADMIN_IMPORT_ORDERS);
  });

  it("sales rep import orders → 403 from the handler; manager passes", async () => {
    headerValues["x-era-pathname"] = "/api/import-orders";
    const { GET } = await import("../app/api/import-orders/route");
    staffAs(ROLE_CODES.SALES_REP);
    expect((await GET()).status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
    staffAs(ROLE_CODES.WHOLESALE_MANAGER);
    expect((await GET()).status).toBe(200);
  });

  it("a picker whose package lost orders.confirm is denied (grant, not name)", async () => {
    staffAs(
      ROLE_CODES.WAREHOUSE_PICKER,
      ROLE_TEMPLATES[ROLE_CODES.WAREHOUSE_PICKER].filter((p) => p !== PERMISSIONS.ORDERS_CONFIRM),
    );
    const { getSatelliteSession } = await import("@/lib/api-utils");
    headerValues["x-era-pathname"] = "/api/orders/o1/confirm";
    await expect(getSatelliteSession()).rejects.toMatchObject({ name: "PermissionDeniedError" });
    headerValues["x-era-pathname"] = "/api/pick-lists";
    await expect(getSatelliteSession()).resolves.toMatchObject({ role: ROLE_CODES.WAREHOUSE_PICKER });
  });

  it("the central gate denies admin paths to the sales rep", async () => {
    staffAs(ROLE_CODES.SALES_REP);
    const { getSatelliteSession } = await import("@/lib/api-utils");
    for (const path of ["/api/import-orders", "/api/admin/roles", "/api/admin/users"]) {
      headerValues["x-era-pathname"] = path;
      await expect(getSatelliteSession()).rejects.toMatchObject({ name: "PermissionDeniedError" });
    }
  });
});
