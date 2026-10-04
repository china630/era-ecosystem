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
jest.mock("@/lib/prisma", () => ({ prisma: { project: { findMany } } }));

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

describe("Construction doors (CN-RBAC-01)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(headerValues)) delete headerValues[k];
    findMany.mockResolvedValue([]);
  });

  it("every ops package keeps act approve and the site flow; only the manager holds settings and access", () => {
    for (const code of [
      ROLE_CODES.SITE_MANAGER,
      ROLE_CODES.ESTIMATOR,
      ROLE_CODES.PLATFORM_MEMBER,
      ROLE_CODES.SATELLITE_OPERATOR,
    ]) {
      for (const p of [PERMISSIONS.ACTS_APPROVE, PERMISSIONS.DAILY_LOGS, PERMISSIONS.REQUISITIONS, PERMISSIONS.BOQ]) {
        expect(ROLE_TEMPLATES[code]).toContain(p);
      }
      expect(ROLE_TEMPLATES[code]).not.toContain(PERMISSIONS.SCREEN_ADMIN_SETTINGS);
      expect(ROLE_TEMPLATES[code]).not.toContain(PERMISSIONS.ACCESS_MANAGE);
    }
  });

  it("a site manager whose package lost acts.approve is denied on approve (grant, not name)", async () => {
    staffAs(
      ROLE_CODES.SITE_MANAGER,
      ROLE_TEMPLATES[ROLE_CODES.SITE_MANAGER].filter((p) => p !== PERMISSIONS.ACTS_APPROVE),
    );
    const { getSatelliteSession } = await import("@/lib/api-utils");
    headerValues["x-era-pathname"] = "/api/progress-acts/act-1/approve";
    await expect(getSatelliteSession()).rejects.toMatchObject({ name: "PermissionDeniedError" });
    headerValues["x-era-pathname"] = "/api/projects/p1/daily-logs";
    await expect(getSatelliteSession()).resolves.toMatchObject({ role: ROLE_CODES.SITE_MANAGER });
  });

  it("an estimator whose package lost api:projects gets 403 from the project list handler", async () => {
    headerValues["x-era-pathname"] = "/api/projects";
    const { GET } = await import("../app/api/projects/route");
    staffAs(ROLE_CODES.ESTIMATOR, ROLE_TEMPLATES[ROLE_CODES.ESTIMATOR].filter((p) => p !== PERMISSIONS.PROJECTS));
    expect((await GET()).status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("the central gate denies access-admin paths to the site manager", async () => {
    staffAs(ROLE_CODES.SITE_MANAGER);
    const { getSatelliteSession } = await import("@/lib/api-utils");
    for (const path of ["/api/admin/roles", "/api/admin/users"]) {
      headerValues["x-era-pathname"] = path;
      await expect(getSatelliteSession()).rejects.toMatchObject({ name: "PermissionDeniedError" });
    }
  });
});
