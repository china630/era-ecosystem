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
jest.mock("@/lib/prisma", () => ({ prisma: { workOrder: { findMany } } }));

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
import { HANDLER_GATE_EXCEPTIONS, apiRoutePermissions } from "@/lib/auth/api-route-permissions";

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

describe("Auto doors (AS-RBAC-01)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(headerValues)) delete headerValues[k];
    findMany.mockResolvedValue([]);
  });

  it("advisor and technician keep the full workshop flow; only the manager holds settings and access", () => {
    for (const code of [
      ROLE_CODES.SERVICE_ADVISOR,
      ROLE_CODES.TECHNICIAN,
      ROLE_CODES.PLATFORM_MEMBER,
      ROLE_CODES.SATELLITE_OPERATOR,
    ]) {
      for (const p of [PERMISSIONS.WORK_ORDERS, PERMISSIONS.APPOINTMENTS, PERMISSIONS.TOOLS, PERMISSIONS.PARTS_CATALOG]) {
        expect(ROLE_TEMPLATES[code]).toContain(p);
      }
      expect(ROLE_TEMPLATES[code]).not.toContain(PERMISSIONS.ADMIN_SETTINGS);
      expect(ROLE_TEMPLATES[code]).not.toContain(PERMISSIONS.ACCESS_MANAGE);
    }
  });

  it("a technician whose package lost api:work_orders gets 403 from the handler", async () => {
    headerValues["x-era-pathname"] = "/api/work-orders";
    const { GET } = await import("../app/api/work-orders/route");
    staffAs(
      ROLE_CODES.TECHNICIAN,
      ROLE_TEMPLATES[ROLE_CODES.TECHNICIAN].filter((p) => p !== PERMISSIONS.WORK_ORDERS),
    );
    expect((await GET()).status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
    staffAs(ROLE_CODES.TECHNICIAN);
    expect((await GET()).status).toBe(200);
  });

  it("the central gate denies access-admin paths to the advisor", async () => {
    staffAs(ROLE_CODES.SERVICE_ADVISOR);
    const { getSatelliteSession } = await import("@/lib/api-utils");
    for (const path of ["/api/admin/roles", "/api/admin/users"]) {
      headerValues["x-era-pathname"] = path;
      await expect(getSatelliteSession()).rejects.toMatchObject({ name: "PermissionDeniedError" });
    }
    headerValues["x-era-pathname"] = "/api/work-orders/wo-1/labor-lines";
    await expect(getSatelliteSession()).resolves.toMatchObject({ role: ROLE_CODES.SERVICE_ADVISOR });
  });

  it("the service-due cron stays on its own secret and carries no staff grant", () => {
    expect(HANDLER_GATE_EXCEPTIONS).toContain("/api/cron/service-due");
    expect(apiRoutePermissions("/api/cron/service-due")).toBeNull();
  });
});
