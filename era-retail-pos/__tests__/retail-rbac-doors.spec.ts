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

const findUnique = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { receipt: { findUnique } } }));

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

describe("Retail doors (RET-RBAC-01)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(headerValues)) delete headerValues[k];
    findUnique.mockResolvedValue(null);
  });

  it("void and import stay on supervisor and outlet admin; cashier and CP members do not get them", () => {
    for (const code of [ROLE_CODES.CASHIER, ROLE_CODES.PLATFORM_MEMBER, ROLE_CODES.SATELLITE_OPERATOR]) {
      expect(ROLE_TEMPLATES[code]).not.toContain(PERMISSIONS.RECEIPTS_VOID_LINE);
      expect(ROLE_TEMPLATES[code]).not.toContain(PERMISSIONS.ADMIN_IMPORT);
    }
    for (const code of [ROLE_CODES.SHIFT_SUPERVISOR, ROLE_CODES.OUTLET_ADMIN]) {
      expect(ROLE_TEMPLATES[code]).toContain(PERMISSIONS.RECEIPTS_VOID_LINE);
      expect(ROLE_TEMPLATES[code]).toContain(PERMISSIONS.ADMIN_IMPORT);
    }
    expect(ROLE_TEMPLATES[ROLE_CODES.SHIFT_SUPERVISOR]).not.toContain(PERMISSIONS.ACCESS_MANAGE);
  });

  it("cashier void line → 403 from the handler", async () => {
    headerValues["x-era-pathname"] = "/api/receipts/r1/lines/l1/void";
    staffAs(ROLE_CODES.CASHIER);
    const { POST } = await import("../app/api/receipts/[id]/lines/[lineId]/void/route");
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "r1", lineId: "l1" }) });
    expect(res.status).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("cashier receipt void → 403 from the handler", async () => {
    headerValues["x-era-pathname"] = "/api/receipts/r1/void";
    staffAs(ROLE_CODES.CASHIER);
    const { POST } = await import("../app/api/receipts/[id]/void/route");
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(403);
  });

  it("supervisor passes the void door (then 404 on the missing receipt)", async () => {
    headerValues["x-era-pathname"] = "/api/receipts/r1/void";
    staffAs(ROLE_CODES.SHIFT_SUPERVISOR);
    const { POST } = await import("../app/api/receipts/[id]/void/route");
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(404);
  });

  it("a supervisor whose package lost void_line is denied (grant, not name)", async () => {
    headerValues["x-era-pathname"] = "/api/receipts/r1/void";
    staffAs(
      ROLE_CODES.SHIFT_SUPERVISOR,
      ROLE_TEMPLATES[ROLE_CODES.SHIFT_SUPERVISOR].filter((p) => p !== PERMISSIONS.RECEIPTS_VOID_LINE),
    );
    const { POST } = await import("../app/api/receipts/[id]/void/route");
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(403);
  });

  it("the central gate denies a stamped API path the package lacks", async () => {
    staffAs(ROLE_CODES.CASHIER);
    headerValues["x-era-pathname"] = "/api/import";
    const { getSatelliteSession } = await import("@/lib/api-utils");
    await expect(getSatelliteSession()).rejects.toMatchObject({ name: "PermissionDeniedError" });
    headerValues["x-era-pathname"] = "/api/receipts";
    await expect(getSatelliteSession()).resolves.toMatchObject({ role: ROLE_CODES.CASHIER });
  });

  it("import helper requires admin:import", async () => {
    headerValues["x-era-pathname"] = "/api/import";
    staffAs(ROLE_CODES.CASHIER);
    const { assertRetailImportAccess } = await import("@/lib/import/auth");
    await expect(assertRetailImportAccess()).rejects.toMatchObject({ name: "PermissionDeniedError" });
    staffAs(ROLE_CODES.OUTLET_ADMIN);
    await expect(assertRetailImportAccess()).resolves.toEqual({ userId: "u-1" });
  });
});
