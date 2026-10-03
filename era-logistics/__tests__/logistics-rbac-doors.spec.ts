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
jest.mock("@/lib/prisma", () => ({ prisma: { trip: { findMany } } }));

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

describe("Logistics doors (LOG-RBAC-01)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(headerValues)) delete headerValues[k];
    findMany.mockResolvedValue([]);
  });

  it("driver and dispatcher both hold the trip flow and driver.trips; only the dispatcher manages access", () => {
    for (const code of [ROLE_CODES.DRIVER, ROLE_CODES.DISPATCHER, ROLE_CODES.PLATFORM_MEMBER, ROLE_CODES.SATELLITE_OPERATOR]) {
      for (const p of [PERMISSIONS.TRIPS, PERMISSIONS.TRIPS_POD, PERMISSIONS.TRIPS_COMPLETE, PERMISSIONS.DRIVER_TRIPS]) {
        expect(ROLE_TEMPLATES[code]).toContain(p);
      }
    }
    expect(ROLE_TEMPLATES[ROLE_CODES.DRIVER]).not.toContain(PERMISSIONS.ACCESS_MANAGE);
    expect(ROLE_TEMPLATES[ROLE_CODES.DRIVER]).not.toContain(PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    expect(ROLE_TEMPLATES[ROLE_CODES.DISPATCHER]).toContain(PERMISSIONS.ACCESS_MANAGE);
  });

  it("a driver whose package lost driver.trips gets 403 from the handler; the seed package passes", async () => {
    headerValues["x-era-pathname"] = "/api/driver/trips";
    const { GET } = await import("../app/api/driver/trips/route");
    staffAs(ROLE_CODES.DRIVER, ROLE_TEMPLATES[ROLE_CODES.DRIVER].filter((p) => p !== PERMISSIONS.DRIVER_TRIPS));
    expect((await GET()).status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
    staffAs(ROLE_CODES.DRIVER);
    expect((await GET()).status).toBe(200);
  });

  it("a dispatcher whose package lost trips.complete is denied (grant, not name)", async () => {
    staffAs(
      ROLE_CODES.DISPATCHER,
      ROLE_TEMPLATES[ROLE_CODES.DISPATCHER].filter((p) => p !== PERMISSIONS.TRIPS_COMPLETE),
    );
    const { getSatelliteSession } = await import("@/lib/api-utils");
    headerValues["x-era-pathname"] = "/api/trips/t1/complete";
    await expect(getSatelliteSession()).rejects.toMatchObject({ name: "PermissionDeniedError" });
    headerValues["x-era-pathname"] = "/api/trips/t1";
    await expect(getSatelliteSession()).resolves.toMatchObject({ role: ROLE_CODES.DISPATCHER });
  });

  it("the central gate denies access-admin paths to the driver", async () => {
    staffAs(ROLE_CODES.DRIVER);
    const { getSatelliteSession } = await import("@/lib/api-utils");
    for (const path of ["/api/admin/roles", "/api/admin/users"]) {
      headerValues["x-era-pathname"] = path;
      await expect(getSatelliteSession()).rejects.toMatchObject({ name: "PermissionDeniedError" });
    }
  });

  it("tracking is any staff session; the path token selects the trip", () => {
    expect(HANDLER_GATE_EXCEPTIONS).toEqual([]);
    expect(apiRoutePermissions("/api/tracking/abc")).toBe("auth");
  });
});
